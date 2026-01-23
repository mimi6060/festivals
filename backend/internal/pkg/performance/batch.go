package performance

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/mimi6060/festivals/backend/internal/infrastructure/profiling"
	"github.com/rs/zerolog/log"
)

// BatchConfig holds configuration for batch processing
type BatchConfig struct {
	// MaxSize is the maximum batch size
	MaxSize int
	// MaxWait is the maximum time to wait for a full batch
	MaxWait time.Duration
	// Workers is the number of concurrent workers
	Workers int
	// RetryAttempts is the number of retry attempts for failed items
	RetryAttempts int
	// RetryDelay is the delay between retries
	RetryDelay time.Duration
}

// DefaultBatchConfig returns default batch configuration
func DefaultBatchConfig() BatchConfig {
	return BatchConfig{
		MaxSize:       100,
		MaxWait:       100 * time.Millisecond,
		Workers:       4,
		RetryAttempts: 3,
		RetryDelay:    100 * time.Millisecond,
	}
}

// BatchProcessor processes items in batches
type BatchProcessor[T any, R any] struct {
	config    BatchConfig
	process   func(ctx context.Context, items []T) ([]R, error)
	items     []batchItem[T, R]
	mu        sync.Mutex
	metrics   *profiling.PerformanceMetrics
	name      string
	flushCh   chan struct{}
	stopCh    chan struct{}
	wg        sync.WaitGroup
	timer     *time.Timer
}

type batchItem[T any, R any] struct {
	item     T
	resultCh chan batchResult[R]
}

type batchResult[R any] struct {
	result R
	err    error
}

// NewBatchProcessor creates a new batch processor
func NewBatchProcessor[T any, R any](
	name string,
	config BatchConfig,
	process func(ctx context.Context, items []T) ([]R, error),
) *BatchProcessor[T, R] {
	bp := &BatchProcessor[T, R]{
		config:  config,
		process: process,
		items:   make([]batchItem[T, R], 0, config.MaxSize),
		metrics: profiling.GetPerformanceMetrics(),
		name:    name,
		flushCh: make(chan struct{}, 1),
		stopCh:  make(chan struct{}),
	}

	bp.start()
	return bp
}

// Submit submits an item for batch processing
func (bp *BatchProcessor[T, R]) Submit(ctx context.Context, item T) (R, error) {
	var zero R

	resultCh := make(chan batchResult[R], 1)

	bp.mu.Lock()
	bp.items = append(bp.items, batchItem[T, R]{
		item:     item,
		resultCh: resultCh,
	})

	if len(bp.items) >= bp.config.MaxSize {
		select {
		case bp.flushCh <- struct{}{}:
		default:
		}
	} else if bp.timer == nil {
		bp.timer = time.AfterFunc(bp.config.MaxWait, func() {
			select {
			case bp.flushCh <- struct{}{}:
			default:
			}
		})
	}
	bp.mu.Unlock()

	select {
	case result := <-resultCh:
		return result.result, result.err
	case <-ctx.Done():
		return zero, ctx.Err()
	}
}

func (bp *BatchProcessor[T, R]) start() {
	bp.wg.Add(1)
	go func() {
		defer bp.wg.Done()
		for {
			select {
			case <-bp.flushCh:
				bp.flush()
			case <-bp.stopCh:
				bp.flush() // Final flush
				return
			}
		}
	}()
}

func (bp *BatchProcessor[T, R]) flush() {
	bp.mu.Lock()
	if len(bp.items) == 0 {
		bp.mu.Unlock()
		return
	}

	items := bp.items
	bp.items = make([]batchItem[T, R], 0, bp.config.MaxSize)
	if bp.timer != nil {
		bp.timer.Stop()
		bp.timer = nil
	}
	bp.mu.Unlock()

	// Extract items for processing
	batchItems := make([]T, len(items))
	for i, item := range items {
		batchItems[i] = item.item
	}

	start := time.Now()
	results, err := bp.process(context.Background(), batchItems)
	duration := time.Since(start)

	// Record metrics
	if bp.metrics != nil {
		bp.metrics.RecordBatch(bp.name, len(items), duration, err)
	}

	// Send results
	if err != nil {
		for _, item := range items {
			var zero R
			item.resultCh <- batchResult[R]{result: zero, err: err}
		}
		return
	}

	for i, item := range items {
		if i < len(results) {
			item.resultCh <- batchResult[R]{result: results[i], err: nil}
		} else {
			var zero R
			item.resultCh <- batchResult[R]{result: zero, err: errors.New("result not found")}
		}
	}
}

// Stop stops the batch processor
func (bp *BatchProcessor[T, R]) Stop() {
	close(bp.stopCh)
	bp.wg.Wait()
}

// Flush forces a flush of pending items
func (bp *BatchProcessor[T, R]) Flush() {
	select {
	case bp.flushCh <- struct{}{}:
	default:
	}
}

// ParallelBatch processes items in parallel batches
type ParallelBatch[T any, R any] struct {
	workers int
	process func(ctx context.Context, item T) (R, error)
	metrics *profiling.PerformanceMetrics
	name    string
}

// NewParallelBatch creates a new parallel batch processor
func NewParallelBatch[T any, R any](
	name string,
	workers int,
	process func(ctx context.Context, item T) (R, error),
) *ParallelBatch[T, R] {
	return &ParallelBatch[T, R]{
		workers: workers,
		process: process,
		metrics: profiling.GetPerformanceMetrics(),
		name:    name,
	}
}

// BatchResult holds the result of a batch operation
type BatchResult[R any] struct {
	Index  int
	Result R
	Error  error
}

// Process processes items in parallel
func (pb *ParallelBatch[T, R]) Process(ctx context.Context, items []T) []BatchResult[R] {
	if len(items) == 0 {
		return nil
	}

	start := time.Now()

	// Create channels
	jobs := make(chan struct {
		index int
		item  T
	}, len(items))
	results := make(chan BatchResult[R], len(items))

	// Start workers
	var wg sync.WaitGroup
	for i := 0; i < pb.workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				result, err := pb.process(ctx, job.item)
				results <- BatchResult[R]{
					Index:  job.index,
					Result: result,
					Error:  err,
				}
			}
		}()
	}

	// Send jobs
	for i, item := range items {
		jobs <- struct {
			index int
			item  T
		}{index: i, item: item}
	}
	close(jobs)

	// Wait for completion
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	output := make([]BatchResult[R], len(items))
	hasError := false
	for result := range results {
		output[result.Index] = result
		if result.Error != nil {
			hasError = true
		}
	}

	duration := time.Since(start)

	// Record metrics
	if pb.metrics != nil {
		var err error
		if hasError {
			err = errors.New("batch had errors")
		}
		pb.metrics.RecordBatch(pb.name, len(items), duration, err)
	}

	return output
}

// ChunkedProcessor processes large datasets in chunks
type ChunkedProcessor[T any] struct {
	chunkSize int
	process   func(ctx context.Context, chunk []T) error
	metrics   *profiling.PerformanceMetrics
	name      string
}

// NewChunkedProcessor creates a new chunked processor
func NewChunkedProcessor[T any](
	name string,
	chunkSize int,
	process func(ctx context.Context, chunk []T) error,
) *ChunkedProcessor[T] {
	return &ChunkedProcessor[T]{
		chunkSize: chunkSize,
		process:   process,
		metrics:   profiling.GetPerformanceMetrics(),
		name:      name,
	}
}

// Process processes all items in chunks
func (cp *ChunkedProcessor[T]) Process(ctx context.Context, items []T) error {
	if len(items) == 0 {
		return nil
	}

	start := time.Now()
	totalChunks := (len(items) + cp.chunkSize - 1) / cp.chunkSize
	processedChunks := 0

	for i := 0; i < len(items); i += cp.chunkSize {
		end := i + cp.chunkSize
		if end > len(items) {
			end = len(items)
		}

		chunk := items[i:end]
		chunkStart := time.Now()

		if err := cp.process(ctx, chunk); err != nil {
			log.Error().
				Err(err).
				Str("processor", cp.name).
				Int("chunk", processedChunks).
				Int("total_chunks", totalChunks).
				Msg("Chunk processing failed")
			return err
		}

		processedChunks++
		log.Debug().
			Str("processor", cp.name).
			Int("chunk", processedChunks).
			Int("total_chunks", totalChunks).
			Int("chunk_size", len(chunk)).
			Dur("chunk_duration", time.Since(chunkStart)).
			Msg("Chunk processed")
	}

	duration := time.Since(start)
	if cp.metrics != nil {
		cp.metrics.RecordBatch(cp.name, len(items), duration, nil)
	}

	return nil
}

// RetryBatch wraps a batch processor with retry logic
type RetryBatch[T any, R any] struct {
	process func(ctx context.Context, items []T) ([]R, error)
	config  BatchConfig
	metrics *profiling.PerformanceMetrics
	name    string
}

// NewRetryBatch creates a new retry batch processor
func NewRetryBatch[T any, R any](
	name string,
	config BatchConfig,
	process func(ctx context.Context, items []T) ([]R, error),
) *RetryBatch[T, R] {
	return &RetryBatch[T, R]{
		process: process,
		config:  config,
		metrics: profiling.GetPerformanceMetrics(),
		name:    name,
	}
}

// Process processes items with retry logic
func (rb *RetryBatch[T, R]) Process(ctx context.Context, items []T) ([]R, error) {
	var lastErr error

	for attempt := 0; attempt <= rb.config.RetryAttempts; attempt++ {
		results, err := rb.process(ctx, items)
		if err == nil {
			return results, nil
		}

		lastErr = err
		log.Warn().
			Err(err).
			Str("processor", rb.name).
			Int("attempt", attempt+1).
			Int("max_attempts", rb.config.RetryAttempts+1).
			Msg("Batch processing failed, retrying")

		if attempt < rb.config.RetryAttempts {
			select {
			case <-time.After(rb.config.RetryDelay * time.Duration(attempt+1)):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
	}

	return nil, lastErr
}

// Debouncer debounces function calls
type Debouncer struct {
	duration time.Duration
	timer    *time.Timer
	mu       sync.Mutex
}

// NewDebouncer creates a new debouncer
func NewDebouncer(duration time.Duration) *Debouncer {
	return &Debouncer{
		duration: duration,
	}
}

// Debounce debounces a function call
func (d *Debouncer) Debounce(fn func()) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.timer != nil {
		d.timer.Stop()
	}

	d.timer = time.AfterFunc(d.duration, fn)
}

// Throttler throttles function calls
type Throttler struct {
	interval time.Duration
	lastCall time.Time
	mu       sync.Mutex
}

// NewThrottler creates a new throttler
func NewThrottler(interval time.Duration) *Throttler {
	return &Throttler{
		interval: interval,
	}
}

// Allow checks if a call is allowed
func (t *Throttler) Allow() bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	if now.Sub(t.lastCall) >= t.interval {
		t.lastCall = now
		return true
	}
	return false
}

// Execute executes a function if allowed
func (t *Throttler) Execute(fn func()) bool {
	if t.Allow() {
		fn()
		return true
	}
	return false
}

// RateLimiter implements a token bucket rate limiter
type RateLimiter struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	mu         sync.Mutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxTokens float64, refillRate float64) *RateLimiter {
	return &RateLimiter{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// Allow checks if a request is allowed
func (rl *RateLimiter) Allow() bool {
	return rl.AllowN(1)
}

// AllowN checks if n requests are allowed
func (rl *RateLimiter) AllowN(n float64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.refill()

	if rl.tokens >= n {
		rl.tokens -= n
		return true
	}
	return false
}

// Wait waits until a request is allowed
func (rl *RateLimiter) Wait(ctx context.Context) error {
	for {
		if rl.Allow() {
			return nil
		}

		select {
		case <-time.After(10 * time.Millisecond):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (rl *RateLimiter) refill() {
	now := time.Now()
	elapsed := now.Sub(rl.lastRefill).Seconds()
	rl.tokens = min(rl.maxTokens, rl.tokens+elapsed*rl.refillRate)
	rl.lastRefill = now
}
