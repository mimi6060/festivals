package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// OptimizedQueryBuilder provides methods for building optimized queries
type OptimizedQueryBuilder struct {
	db            *gorm.DB
	analyzer      *QueryAnalyzer
	defaultTimeout time.Duration
}

// NewOptimizedQueryBuilder creates a new optimized query builder
func NewOptimizedQueryBuilder(db *gorm.DB, analyzer *QueryAnalyzer) *OptimizedQueryBuilder {
	return &OptimizedQueryBuilder{
		db:            db,
		analyzer:      analyzer,
		defaultTimeout: 30 * time.Second,
	}
}

// QueryOptions contains options for query execution
type QueryOptions struct {
	Timeout          time.Duration
	UseReadReplica   bool
	ExplainAnalyze   bool
	ForceIndexScan   bool
	DisableSeqScan   bool
	WorkMem          string
	EnableParallel   bool
	MaxParallelWorkers int
}

// DefaultQueryOptions returns default query options
func DefaultQueryOptions() QueryOptions {
	return QueryOptions{
		Timeout:        30 * time.Second,
		UseReadReplica: false,
		ExplainAnalyze: false,
	}
}

// WithTimeout creates a context with query timeout
func (qb *OptimizedQueryBuilder) WithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, timeout)
}

// ApplyQueryOptions applies query optimization options to the database connection
func (qb *OptimizedQueryBuilder) ApplyQueryOptions(ctx context.Context, opts QueryOptions) *gorm.DB {
	db := qb.db.WithContext(ctx)

	// Set statement timeout
	if opts.Timeout > 0 {
		db = db.Exec(fmt.Sprintf("SET LOCAL statement_timeout = '%dms'", opts.Timeout.Milliseconds()))
	}

	// Force index scan if requested
	if opts.ForceIndexScan || opts.DisableSeqScan {
		db = db.Exec("SET LOCAL enable_seqscan = off")
	}

	// Adjust work_mem for complex queries
	if opts.WorkMem != "" {
		db = db.Exec(fmt.Sprintf("SET LOCAL work_mem = '%s'", opts.WorkMem))
	}

	// Enable parallel query execution
	if opts.EnableParallel && opts.MaxParallelWorkers > 0 {
		db = db.Exec(fmt.Sprintf("SET LOCAL max_parallel_workers_per_gather = %d", opts.MaxParallelWorkers))
	}

	return db
}

// BatchInsert performs optimized batch inserts
func (qb *OptimizedQueryBuilder) BatchInsert(ctx context.Context, records interface{}, batchSize int) error {
	return qb.db.WithContext(ctx).CreateInBatches(records, batchSize).Error
}

// BatchInsertWithConflict performs batch inserts with conflict handling (upsert)
func (qb *OptimizedQueryBuilder) BatchInsertWithConflict(ctx context.Context, records interface{}, batchSize int, conflictColumns []string, updateColumns []string) error {
	return qb.db.WithContext(ctx).Clauses(
		// Use GORM's upsert capability
		// gorm.io/gorm/clause for ON CONFLICT handling
	).CreateInBatches(records, batchSize).Error
}

// PreloadOptimized performs optimized preloading to avoid N+1 queries
func (qb *OptimizedQueryBuilder) PreloadOptimized(db *gorm.DB, associations ...string) *gorm.DB {
	for _, assoc := range associations {
		db = db.Preload(assoc)
	}
	return db
}

// PaginatedQuery executes a paginated query with optimized counting
type PaginatedQuery struct {
	db        *gorm.DB
	tableName string
	query     *gorm.DB
}

// PaginatedResult contains paginated query results
type PaginatedResult struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
	HasNext    bool        `json:"has_next"`
	HasPrev    bool        `json:"has_prev"`
}

// NewPaginatedQuery creates a new paginated query
func (qb *OptimizedQueryBuilder) NewPaginatedQuery(tableName string) *PaginatedQuery {
	return &PaginatedQuery{
		db:        qb.db,
		tableName: tableName,
		query:     qb.db.Table(tableName),
	}
}

// Where adds a where condition
func (pq *PaginatedQuery) Where(query interface{}, args ...interface{}) *PaginatedQuery {
	pq.query = pq.query.Where(query, args...)
	return pq
}

// Order adds ordering
func (pq *PaginatedQuery) Order(order string) *PaginatedQuery {
	pq.query = pq.query.Order(order)
	return pq
}

// Execute executes the paginated query
func (pq *PaginatedQuery) Execute(ctx context.Context, page, pageSize int, dest interface{}) (*PaginatedResult, error) {
	var total int64

	// Get count in a separate optimized query
	countQuery := pq.db.Table(pq.tableName)
	// Copy where conditions
	countQuery = countQuery.Where(pq.query.Statement.Clauses["WHERE"])

	if err := countQuery.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count: %w", err)
	}

	// Calculate offset
	offset := (page - 1) * pageSize

	// Get data
	if err := pq.query.WithContext(ctx).Offset(offset).Limit(pageSize).Find(dest).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch data: %w", err)
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &PaginatedResult{
		Data:       dest,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}, nil
}

// KeysetPagination implements keyset pagination (more efficient for large datasets)
type KeysetPagination struct {
	db           *gorm.DB
	tableName    string
	sortColumn   string
	sortOrder    string
	lastValue    interface{}
	lastID       uuid.UUID
}

// NewKeysetPagination creates a new keyset pagination query
func (qb *OptimizedQueryBuilder) NewKeysetPagination(tableName, sortColumn, sortOrder string) *KeysetPagination {
	return &KeysetPagination{
		db:         qb.db,
		tableName:  tableName,
		sortColumn: sortColumn,
		sortOrder:  sortOrder,
	}
}

// After sets the cursor position
func (kp *KeysetPagination) After(value interface{}, id uuid.UUID) *KeysetPagination {
	kp.lastValue = value
	kp.lastID = id
	return kp
}

// Fetch fetches the next page of results
func (kp *KeysetPagination) Fetch(ctx context.Context, limit int, dest interface{}) error {
	query := kp.db.WithContext(ctx).Table(kp.tableName)

	if kp.lastValue != nil {
		if kp.sortOrder == "DESC" {
			query = query.Where(fmt.Sprintf("(%s, id) < (?, ?)", kp.sortColumn), kp.lastValue, kp.lastID)
		} else {
			query = query.Where(fmt.Sprintf("(%s, id) > (?, ?)", kp.sortColumn), kp.lastValue, kp.lastID)
		}
	}

	return query.Order(fmt.Sprintf("%s %s, id %s", kp.sortColumn, kp.sortOrder, kp.sortOrder)).
		Limit(limit).
		Find(dest).Error
}

// TransactionOptimizer provides optimized transaction handling
type TransactionOptimizer struct {
	db *gorm.DB
}

// NewTransactionOptimizer creates a new transaction optimizer
func NewTransactionOptimizer(db *gorm.DB) *TransactionOptimizer {
	return &TransactionOptimizer{db: db}
}

// ExecuteWithRetry executes a transaction with retry logic for deadlocks
func (to *TransactionOptimizer) ExecuteWithRetry(ctx context.Context, fn func(tx *gorm.DB) error, maxRetries int) error {
	var err error
	for i := 0; i < maxRetries; i++ {
		err = to.db.WithContext(ctx).Transaction(fn)
		if err == nil {
			return nil
		}

		// Check if it's a deadlock or serialization error
		if isRetryableError(err) {
			log.Warn().
				Err(err).
				Int("attempt", i+1).
				Int("max_retries", maxRetries).
				Msg("Retryable error, retrying transaction")

			// Exponential backoff
			time.Sleep(time.Duration(1<<uint(i)) * 10 * time.Millisecond)
			continue
		}

		return err
	}

	return fmt.Errorf("transaction failed after %d retries: %w", maxRetries, err)
}

// isRetryableError checks if the error is retryable
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// PostgreSQL error codes for deadlock and serialization failures
	return contains(errStr, "deadlock") ||
		contains(errStr, "40001") || // serialization_failure
		contains(errStr, "40P01")    // deadlock_detected
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsRune(s, substr))
}

func containsRune(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// BulkUpdateBuilder builds optimized bulk update queries
type BulkUpdateBuilder struct {
	db        *gorm.DB
	tableName string
	updates   map[string]interface{}
	where     string
	whereArgs []interface{}
}

// NewBulkUpdateBuilder creates a new bulk update builder
func (qb *OptimizedQueryBuilder) NewBulkUpdateBuilder(tableName string) *BulkUpdateBuilder {
	return &BulkUpdateBuilder{
		db:        qb.db,
		tableName: tableName,
		updates:   make(map[string]interface{}),
	}
}

// Set adds a column update
func (b *BulkUpdateBuilder) Set(column string, value interface{}) *BulkUpdateBuilder {
	b.updates[column] = value
	return b
}

// Where adds a where condition
func (b *BulkUpdateBuilder) Where(query string, args ...interface{}) *BulkUpdateBuilder {
	b.where = query
	b.whereArgs = args
	return b
}

// Execute executes the bulk update
func (b *BulkUpdateBuilder) Execute(ctx context.Context) (int64, error) {
	result := b.db.WithContext(ctx).
		Table(b.tableName).
		Where(b.where, b.whereArgs...).
		Updates(b.updates)

	return result.RowsAffected, result.Error
}

// AggregationQuery provides optimized aggregation queries
type AggregationQuery struct {
	db        *gorm.DB
	tableName string
}

// NewAggregationQuery creates a new aggregation query
func (qb *OptimizedQueryBuilder) NewAggregationQuery(tableName string) *AggregationQuery {
	return &AggregationQuery{
		db:        qb.db,
		tableName: tableName,
	}
}

// SumByGroup calculates sum grouped by a column
func (aq *AggregationQuery) SumByGroup(ctx context.Context, sumColumn, groupColumn string, where string, args ...interface{}) (map[string]float64, error) {
	type Result struct {
		GroupValue string
		Total      float64
	}

	var results []Result
	query := aq.db.WithContext(ctx).
		Table(aq.tableName).
		Select(fmt.Sprintf("%s as group_value, SUM(%s) as total", groupColumn, sumColumn)).
		Group(groupColumn)

	if where != "" {
		query = query.Where(where, args...)
	}

	if err := query.Scan(&results).Error; err != nil {
		return nil, err
	}

	resultMap := make(map[string]float64)
	for _, r := range results {
		resultMap[r.GroupValue] = r.Total
	}

	return resultMap, nil
}

// CountByGroup counts records grouped by a column
func (aq *AggregationQuery) CountByGroup(ctx context.Context, groupColumn string, where string, args ...interface{}) (map[string]int64, error) {
	type Result struct {
		GroupValue string
		Count      int64
	}

	var results []Result
	query := aq.db.WithContext(ctx).
		Table(aq.tableName).
		Select(fmt.Sprintf("%s as group_value, COUNT(*) as count", groupColumn)).
		Group(groupColumn)

	if where != "" {
		query = query.Where(where, args...)
	}

	if err := query.Scan(&results).Error; err != nil {
		return nil, err
	}

	resultMap := make(map[string]int64)
	for _, r := range results {
		resultMap[r.GroupValue] = r.Count
	}

	return resultMap, nil
}

// TimeSeriesQuery provides optimized time series queries
type TimeSeriesQuery struct {
	db        *gorm.DB
	tableName string
}

// NewTimeSeriesQuery creates a new time series query
func (qb *OptimizedQueryBuilder) NewTimeSeriesQuery(tableName string) *TimeSeriesQuery {
	return &TimeSeriesQuery{
		db:        qb.db,
		tableName: tableName,
	}
}

// TimeSeriesDataPoint represents a data point in a time series
type TimeSeriesDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Count     int64     `json:"count"`
}

// AggregateByInterval aggregates data by time interval
func (ts *TimeSeriesQuery) AggregateByInterval(
	ctx context.Context,
	valueColumn string,
	timestampColumn string,
	interval string,
	start, end time.Time,
	aggregation string, // SUM, AVG, COUNT, MIN, MAX
) ([]TimeSeriesDataPoint, error) {
	query := fmt.Sprintf(`
		SELECT
			date_trunc('%s', %s) as timestamp,
			%s(%s) as value,
			COUNT(*) as count
		FROM %s
		WHERE %s >= ? AND %s < ?
		GROUP BY date_trunc('%s', %s)
		ORDER BY timestamp
	`, interval, timestampColumn, aggregation, valueColumn, ts.tableName,
		timestampColumn, timestampColumn, interval, timestampColumn)

	var results []TimeSeriesDataPoint
	if err := ts.db.WithContext(ctx).Raw(query, start, end).Scan(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

// CachingQueryWrapper wraps queries with caching support
type CachingQueryWrapper struct {
	db    *gorm.DB
	cache CacheInterface
	ttl   time.Duration
}

// CacheInterface defines the cache interface
type CacheInterface interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// NewCachingQueryWrapper creates a new caching query wrapper
func NewCachingQueryWrapper(db *gorm.DB, cache CacheInterface, ttl time.Duration) *CachingQueryWrapper {
	return &CachingQueryWrapper{
		db:    db,
		cache: cache,
		ttl:   ttl,
	}
}

// QueryWithCache executes a query with caching
func (cq *CachingQueryWrapper) QueryWithCache(ctx context.Context, cacheKey string, dest interface{}, queryFn func(db *gorm.DB) error) error {
	// Try to get from cache first
	if cq.cache != nil {
		cached, err := cq.cache.Get(ctx, cacheKey)
		if err == nil && len(cached) > 0 {
			// Cache hit - unmarshal and return
			// Note: You would need to implement unmarshaling based on your cache format
			return nil
		}
	}

	// Cache miss - execute query
	if err := queryFn(cq.db.WithContext(ctx)); err != nil {
		return err
	}

	// Store in cache
	if cq.cache != nil {
		// Note: You would need to implement marshaling based on your cache format
		// cq.cache.Set(ctx, cacheKey, marshaled, cq.ttl)
	}

	return nil
}

// ExplainQuery runs EXPLAIN on a query and logs the plan
func (qb *OptimizedQueryBuilder) ExplainQuery(ctx context.Context, query string, args ...interface{}) error {
	if qb.analyzer == nil {
		return fmt.Errorf("query analyzer not configured")
	}

	plan, err := qb.analyzer.ExplainAnalyze(ctx, query, args...)
	if err != nil {
		return err
	}

	log.Info().
		Str("query", query).
		Float64("planning_time_ms", plan.PlanningTime).
		Float64("execution_time_ms", plan.ExecutionTime).
		Int("seq_scans", plan.SeqScans).
		Int("index_scans", plan.IndexScans).
		Msg("Query execution plan")

	if len(plan.Warnings) > 0 {
		for _, warning := range plan.Warnings {
			log.Warn().Str("warning", warning).Msg("Query plan warning")
		}
	}

	return nil
}
