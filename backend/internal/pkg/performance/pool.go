package performance

import (
	"bytes"
	"sync"

	"github.com/mimi6060/festivals/backend/internal/infrastructure/profiling"
)

// Pool is a generic object pool interface
type Pool[T any] interface {
	Get() T
	Put(T)
	Stats() PoolStats
}

// PoolStats holds statistics about pool usage
type PoolStats struct {
	Gets      uint64
	Puts      uint64
	Misses    uint64
	Hits      uint64
	PoolSize  int
	HitRate   float64
}

// SyncPool wraps sync.Pool with metrics and type safety
type SyncPool[T any] struct {
	pool    sync.Pool
	metrics *profiling.PerformanceMetrics
	name    string
	stats   poolStatsInternal
	mu      sync.RWMutex
}

type poolStatsInternal struct {
	gets   uint64
	puts   uint64
	misses uint64
	hits   uint64
}

// NewSyncPool creates a new generic sync pool
func NewSyncPool[T any](name string, newFunc func() T) *SyncPool[T] {
	metrics := profiling.GetPerformanceMetrics()
	return &SyncPool[T]{
		pool: sync.Pool{
			New: func() any {
				if metrics != nil {
					metrics.RecordPoolMiss(name)
				}
				return newFunc()
			},
		},
		metrics: metrics,
		name:    name,
	}
}

// Get retrieves an object from the pool
func (p *SyncPool[T]) Get() T {
	p.mu.Lock()
	p.stats.gets++
	p.mu.Unlock()

	obj := p.pool.Get().(T)

	if p.metrics != nil {
		p.metrics.RecordPoolReuse(p.name)
	}

	return obj
}

// Put returns an object to the pool
func (p *SyncPool[T]) Put(obj T) {
	p.mu.Lock()
	p.stats.puts++
	p.mu.Unlock()

	p.pool.Put(obj)
}

// Stats returns pool statistics
func (p *SyncPool[T]) Stats() PoolStats {
	p.mu.RLock()
	defer p.mu.RUnlock()

	hitRate := float64(0)
	if p.stats.gets > 0 {
		hitRate = float64(p.stats.gets-p.stats.misses) / float64(p.stats.gets)
	}

	return PoolStats{
		Gets:    p.stats.gets,
		Puts:    p.stats.puts,
		Misses:  p.stats.misses,
		Hits:    p.stats.gets - p.stats.misses,
		HitRate: hitRate,
	}
}

// BufferPool is a specialized pool for bytes.Buffer
type BufferPool struct {
	pool    sync.Pool
	metrics *profiling.PerformanceMetrics
	name    string
	initCap int
	maxCap  int
}

// NewBufferPool creates a new buffer pool
func NewBufferPool(name string, initialCapacity, maxCapacity int) *BufferPool {
	metrics := profiling.GetPerformanceMetrics()
	return &BufferPool{
		pool: sync.Pool{
			New: func() any {
				return bytes.NewBuffer(make([]byte, 0, initialCapacity))
			},
		},
		metrics: metrics,
		name:    name,
		initCap: initialCapacity,
		maxCap:  maxCapacity,
	}
}

// Get retrieves a buffer from the pool
func (p *BufferPool) Get() *bytes.Buffer {
	if p.metrics != nil {
		p.metrics.RecordPoolReuse(p.name)
	}
	return p.pool.Get().(*bytes.Buffer)
}

// Put returns a buffer to the pool
func (p *BufferPool) Put(buf *bytes.Buffer) {
	if buf == nil {
		return
	}

	// Don't return oversized buffers to avoid memory bloat
	if buf.Cap() > p.maxCap {
		if p.metrics != nil {
			p.metrics.RecordPoolMiss(p.name)
		}
		return
	}

	buf.Reset()
	p.pool.Put(buf)
}

// SlicePool is a pool for byte slices
type SlicePool struct {
	pool    sync.Pool
	metrics *profiling.PerformanceMetrics
	name    string
	size    int
}

// NewSlicePool creates a new slice pool
func NewSlicePool(name string, sliceSize int) *SlicePool {
	metrics := profiling.GetPerformanceMetrics()
	return &SlicePool{
		pool: sync.Pool{
			New: func() any {
				return make([]byte, sliceSize)
			},
		},
		metrics: metrics,
		name:    name,
		size:    sliceSize,
	}
}

// Get retrieves a slice from the pool
func (p *SlicePool) Get() []byte {
	if p.metrics != nil {
		p.metrics.RecordPoolReuse(p.name)
	}
	return p.pool.Get().([]byte)
}

// Put returns a slice to the pool
func (p *SlicePool) Put(slice []byte) {
	if slice == nil || cap(slice) != p.size {
		return
	}
	// Clear the slice before returning
	clear(slice)
	p.pool.Put(slice[:p.size])
}

// MapPool is a pool for maps
type MapPool[K comparable, V any] struct {
	pool    sync.Pool
	metrics *profiling.PerformanceMetrics
	name    string
	initCap int
}

// NewMapPool creates a new map pool
func NewMapPool[K comparable, V any](name string, initialCapacity int) *MapPool[K, V] {
	metrics := profiling.GetPerformanceMetrics()
	return &MapPool[K, V]{
		pool: sync.Pool{
			New: func() any {
				return make(map[K]V, initialCapacity)
			},
		},
		metrics: metrics,
		name:    name,
		initCap: initialCapacity,
	}
}

// Get retrieves a map from the pool
func (p *MapPool[K, V]) Get() map[K]V {
	if p.metrics != nil {
		p.metrics.RecordPoolReuse(p.name)
	}
	return p.pool.Get().(map[K]V)
}

// Put returns a map to the pool after clearing it
func (p *MapPool[K, V]) Put(m map[K]V) {
	if m == nil {
		return
	}
	clear(m)
	p.pool.Put(m)
}

// StringBuilderPool is a pool for strings.Builder
type StringBuilderPool struct {
	pool    sync.Pool
	metrics *profiling.PerformanceMetrics
	name    string
	maxCap  int
}

// StringBuilder wraps strings.Builder for pooling
type StringBuilder struct {
	builder *bytes.Buffer
}

// NewStringBuilderPool creates a new string builder pool
func NewStringBuilderPool(name string, maxCapacity int) *StringBuilderPool {
	metrics := profiling.GetPerformanceMetrics()
	return &StringBuilderPool{
		pool: sync.Pool{
			New: func() any {
				return &StringBuilder{builder: bytes.NewBuffer(make([]byte, 0, 256))}
			},
		},
		metrics: metrics,
		name:    name,
		maxCap:  maxCapacity,
	}
}

// Get retrieves a string builder from the pool
func (p *StringBuilderPool) Get() *StringBuilder {
	if p.metrics != nil {
		p.metrics.RecordPoolReuse(p.name)
	}
	return p.pool.Get().(*StringBuilder)
}

// Put returns a string builder to the pool
func (p *StringBuilderPool) Put(sb *StringBuilder) {
	if sb == nil || sb.builder == nil {
		return
	}
	if sb.builder.Cap() > p.maxCap {
		return
	}
	sb.builder.Reset()
	p.pool.Put(sb)
}

// WriteString writes a string to the builder
func (sb *StringBuilder) WriteString(s string) {
	sb.builder.WriteString(s)
}

// WriteByte writes a byte to the builder
func (sb *StringBuilder) WriteByte(c byte) error {
	return sb.builder.WriteByte(c)
}

// String returns the built string
func (sb *StringBuilder) String() string {
	return sb.builder.String()
}

// Len returns the current length
func (sb *StringBuilder) Len() int {
	return sb.builder.Len()
}

// Reset resets the builder
func (sb *StringBuilder) Reset() {
	sb.builder.Reset()
}

// Global pool instances for common use cases
var (
	// JSONBufferPool is a global pool for JSON serialization buffers
	JSONBufferPool = NewBufferPool("json_buffer", 1024, 64*1024)

	// ResponseBufferPool is a global pool for HTTP response buffers
	ResponseBufferPool = NewBufferPool("response_buffer", 4096, 256*1024)

	// SmallSlicePool is a global pool for small byte slices (1KB)
	SmallSlicePool = NewSlicePool("small_slice", 1024)

	// MediumSlicePool is a global pool for medium byte slices (8KB)
	MediumSlicePool = NewSlicePool("medium_slice", 8192)

	// LargeSlicePool is a global pool for large byte slices (64KB)
	LargeSlicePool = NewSlicePool("large_slice", 65536)

	// StringPool is a global string builder pool
	StringPool = NewStringBuilderPool("string_builder", 16*1024)
)

// GetBufferForSize returns an appropriate buffer pool based on expected size
func GetBufferForSize(expectedSize int) *bytes.Buffer {
	if expectedSize <= 1024 {
		return JSONBufferPool.Get()
	}
	return ResponseBufferPool.Get()
}

// PutBuffer returns a buffer to the appropriate pool
func PutBuffer(buf *bytes.Buffer) {
	if buf.Cap() <= 64*1024 {
		JSONBufferPool.Put(buf)
	} else {
		ResponseBufferPool.Put(buf)
	}
}

// GetSliceForSize returns an appropriate slice based on expected size
func GetSliceForSize(expectedSize int) []byte {
	if expectedSize <= 1024 {
		return SmallSlicePool.Get()
	}
	if expectedSize <= 8192 {
		return MediumSlicePool.Get()
	}
	return LargeSlicePool.Get()
}

// PutSlice returns a slice to the appropriate pool
func PutSlice(slice []byte) {
	switch cap(slice) {
	case 1024:
		SmallSlicePool.Put(slice)
	case 8192:
		MediumSlicePool.Put(slice)
	case 65536:
		LargeSlicePool.Put(slice)
	}
}
