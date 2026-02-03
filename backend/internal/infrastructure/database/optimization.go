package database

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// QueryAnalyzer provides tools for analyzing and optimizing database queries
type QueryAnalyzer struct {
	db              *gorm.DB
	slowQueryLog    *SlowQueryLogger
	indexMonitor    *IndexUsageMonitor
	mu              sync.RWMutex
	enabled         bool
	slowThreshold   time.Duration
	samplingRate    float64
}

// ExplainPlan represents a PostgreSQL EXPLAIN ANALYZE result
type ExplainPlan struct {
	Query          string                 `json:"query"`
	Plan           []ExplainPlanNode      `json:"plan"`
	PlanningTime   float64                `json:"planning_time"`
	ExecutionTime  float64                `json:"execution_time"`
	TotalCost      float64                `json:"total_cost"`
	ActualRows     int64                  `json:"actual_rows"`
	EstimatedRows  int64                  `json:"estimated_rows"`
	SeqScans       int                    `json:"seq_scans"`
	IndexScans     int                    `json:"index_scans"`
	SortOperations int                    `json:"sort_operations"`
	HashJoins      int                    `json:"hash_joins"`
	NestedLoops    int                    `json:"nested_loops"`
	Warnings       []string               `json:"warnings,omitempty"`
	RawPlan        map[string]interface{} `json:"raw_plan,omitempty"`
}

// ExplainPlanNode represents a node in the execution plan
type ExplainPlanNode struct {
	NodeType       string            `json:"node_type"`
	RelationName   string            `json:"relation_name,omitempty"`
	IndexName      string            `json:"index_name,omitempty"`
	StartupCost    float64           `json:"startup_cost"`
	TotalCost      float64           `json:"total_cost"`
	PlanRows       int64             `json:"plan_rows"`
	ActualRows     int64             `json:"actual_rows"`
	ActualLoops    int64             `json:"actual_loops"`
	ActualTime     float64           `json:"actual_time"`
	Filter         string            `json:"filter,omitempty"`
	RowsRemoved    int64             `json:"rows_removed,omitempty"`
	Children       []ExplainPlanNode `json:"children,omitempty"`
}

// SlowQuery represents a slow query log entry
type SlowQuery struct {
	Query         string        `json:"query"`
	Duration      time.Duration `json:"duration"`
	RowsAffected  int64         `json:"rows_affected"`
	CallerInfo    string        `json:"caller_info"`
	Timestamp     time.Time     `json:"timestamp"`
	ExplainPlan   *ExplainPlan  `json:"explain_plan,omitempty"`
}

// SlowQueryLogger logs and tracks slow queries
type SlowQueryLogger struct {
	mu           sync.RWMutex
	queries      []SlowQuery
	maxEntries   int
	threshold    time.Duration
	callback     func(SlowQuery)
}

// IndexUsageStats represents index usage statistics
type IndexUsageStats struct {
	SchemaName     string  `json:"schema_name"`
	TableName      string  `json:"table_name"`
	IndexName      string  `json:"index_name"`
	IndexScans     int64   `json:"index_scans"`
	TuplesRead     int64   `json:"tuples_read"`
	TuplesFetched  int64   `json:"tuples_fetched"`
	IndexSize      int64   `json:"index_size"`
	UsageRatio     float64 `json:"usage_ratio"`
	IsUnused       bool    `json:"is_unused"`
	IsDuplicate    bool    `json:"is_duplicate"`
	Recommendation string  `json:"recommendation,omitempty"`
}

// IndexUsageMonitor monitors index usage and provides recommendations
type IndexUsageMonitor struct {
	db         *gorm.DB
	mu         sync.RWMutex
	lastScan   time.Time
	stats      []IndexUsageStats
	scanInterval time.Duration
}

// NewQueryAnalyzer creates a new query analyzer
func NewQueryAnalyzer(db *gorm.DB, opts ...QueryAnalyzerOption) *QueryAnalyzer {
	qa := &QueryAnalyzer{
		db:            db,
		slowThreshold: 100 * time.Millisecond,
		samplingRate:  1.0,
		enabled:       true,
	}

	qa.slowQueryLog = NewSlowQueryLogger(qa.slowThreshold, 1000)
	qa.indexMonitor = NewIndexUsageMonitor(db)

	for _, opt := range opts {
		opt(qa)
	}

	return qa
}

// QueryAnalyzerOption is a functional option for QueryAnalyzer
type QueryAnalyzerOption func(*QueryAnalyzer)

// WithSlowThreshold sets the slow query threshold
func WithSlowThreshold(d time.Duration) QueryAnalyzerOption {
	return func(qa *QueryAnalyzer) {
		qa.slowThreshold = d
		qa.slowQueryLog.threshold = d
	}
}

// WithSamplingRate sets the query sampling rate (0.0 to 1.0)
func WithSamplingRate(rate float64) QueryAnalyzerOption {
	return func(qa *QueryAnalyzer) {
		if rate < 0 {
			rate = 0
		}
		if rate > 1 {
			rate = 1
		}
		qa.samplingRate = rate
	}
}

// WithSlowQueryCallback sets a callback for slow queries
func WithSlowQueryCallback(cb func(SlowQuery)) QueryAnalyzerOption {
	return func(qa *QueryAnalyzer) {
		qa.slowQueryLog.callback = cb
	}
}

// Enable enables query analysis
func (qa *QueryAnalyzer) Enable() {
	qa.mu.Lock()
	defer qa.mu.Unlock()
	qa.enabled = true
}

// Disable disables query analysis
func (qa *QueryAnalyzer) Disable() {
	qa.mu.Lock()
	defer qa.mu.Unlock()
	qa.enabled = false
}

// ExplainAnalyze runs EXPLAIN ANALYZE on a query and returns the plan
func (qa *QueryAnalyzer) ExplainAnalyze(ctx context.Context, query string, args ...interface{}) (*ExplainPlan, error) {
	explainQuery := fmt.Sprintf("EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) %s", query)

	var result []map[string]interface{}
	if err := qa.db.WithContext(ctx).Raw(explainQuery, args...).Scan(&result).Error; err != nil {
		return nil, fmt.Errorf("failed to run EXPLAIN ANALYZE: %w", err)
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("empty EXPLAIN result")
	}

	plan := &ExplainPlan{
		Query:   query,
		RawPlan: result[0],
	}

	// Parse the JSON plan
	qa.parsePlan(plan, result)

	return plan, nil
}

// parsePlan parses the EXPLAIN ANALYZE JSON output
func (qa *QueryAnalyzer) parsePlan(plan *ExplainPlan, result []map[string]interface{}) {
	if len(result) == 0 {
		return
	}

	// Extract plan details from the first result
	planData := result[0]
	if planArray, ok := planData["QUERY PLAN"].([]interface{}); ok && len(planArray) > 0 {
		if planMap, ok := planArray[0].(map[string]interface{}); ok {
			if pt, ok := planMap["Planning Time"].(float64); ok {
				plan.PlanningTime = pt
			}
			if et, ok := planMap["Execution Time"].(float64); ok {
				plan.ExecutionTime = et
			}
			if planNode, ok := planMap["Plan"].(map[string]interface{}); ok {
				qa.extractPlanMetrics(plan, planNode)
			}
		}
	}

	// Generate warnings
	plan.Warnings = qa.generateWarnings(plan)
}

// extractPlanMetrics extracts metrics from plan nodes recursively
func (qa *QueryAnalyzer) extractPlanMetrics(plan *ExplainPlan, node map[string]interface{}) {
	nodeType, _ := node["Node Type"].(string)

	switch {
	case strings.Contains(nodeType, "Seq Scan"):
		plan.SeqScans++
	case strings.Contains(nodeType, "Index"):
		plan.IndexScans++
	case strings.Contains(nodeType, "Sort"):
		plan.SortOperations++
	case strings.Contains(nodeType, "Hash Join"):
		plan.HashJoins++
	case strings.Contains(nodeType, "Nested Loop"):
		plan.NestedLoops++
	}

	if tc, ok := node["Total Cost"].(float64); ok && tc > plan.TotalCost {
		plan.TotalCost = tc
	}
	if ar, ok := node["Actual Rows"].(float64); ok {
		plan.ActualRows += int64(ar)
	}
	if pr, ok := node["Plan Rows"].(float64); ok {
		plan.EstimatedRows += int64(pr)
	}

	// Process child nodes
	if plans, ok := node["Plans"].([]interface{}); ok {
		for _, child := range plans {
			if childNode, ok := child.(map[string]interface{}); ok {
				qa.extractPlanMetrics(plan, childNode)
			}
		}
	}
}

// generateWarnings generates warnings based on the execution plan
func (qa *QueryAnalyzer) generateWarnings(plan *ExplainPlan) []string {
	var warnings []string

	// Check for sequential scans on large result sets
	if plan.SeqScans > 0 && plan.ActualRows > 1000 {
		warnings = append(warnings, fmt.Sprintf("Sequential scan returned %d rows - consider adding an index", plan.ActualRows))
	}

	// Check for row estimation errors
	if plan.EstimatedRows > 0 {
		ratio := float64(plan.ActualRows) / float64(plan.EstimatedRows)
		if ratio > 10 || ratio < 0.1 {
			warnings = append(warnings, fmt.Sprintf("Row estimation off by %.1fx - consider running ANALYZE", ratio))
		}
	}

	// Check for slow execution
	if plan.ExecutionTime > 100 {
		warnings = append(warnings, fmt.Sprintf("Slow execution time: %.2fms", plan.ExecutionTime))
	}

	// Check for expensive nested loops
	if plan.NestedLoops > 3 {
		warnings = append(warnings, fmt.Sprintf("Multiple nested loops (%d) may indicate missing indexes", plan.NestedLoops))
	}

	return warnings
}

// LogSlowQuery logs a slow query
func (qa *QueryAnalyzer) LogSlowQuery(query string, duration time.Duration, rowsAffected int64, callerInfo string) {
	qa.slowQueryLog.Log(SlowQuery{
		Query:        query,
		Duration:     duration,
		RowsAffected: rowsAffected,
		CallerInfo:   callerInfo,
		Timestamp:    time.Now(),
	})
}

// GetSlowQueries returns recent slow queries
func (qa *QueryAnalyzer) GetSlowQueries() []SlowQuery {
	return qa.slowQueryLog.GetQueries()
}

// GetIndexUsageStats returns index usage statistics
func (qa *QueryAnalyzer) GetIndexUsageStats(ctx context.Context) ([]IndexUsageStats, error) {
	return qa.indexMonitor.GetStats(ctx)
}

// GetUnusedIndexes returns a list of potentially unused indexes
func (qa *QueryAnalyzer) GetUnusedIndexes(ctx context.Context) ([]IndexUsageStats, error) {
	return qa.indexMonitor.GetUnusedIndexes(ctx)
}

// NewSlowQueryLogger creates a new slow query logger
func NewSlowQueryLogger(threshold time.Duration, maxEntries int) *SlowQueryLogger {
	return &SlowQueryLogger{
		queries:    make([]SlowQuery, 0, maxEntries),
		maxEntries: maxEntries,
		threshold:  threshold,
	}
}

// Log logs a slow query
func (l *SlowQueryLogger) Log(sq SlowQuery) {
	if sq.Duration < l.threshold {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// Add to log
	l.queries = append(l.queries, sq)

	// Trim if exceeded max
	if len(l.queries) > l.maxEntries {
		l.queries = l.queries[len(l.queries)-l.maxEntries:]
	}

	// Call callback if set
	if l.callback != nil {
		go l.callback(sq)
	}

	// Log to standard logger
	log.Warn().
		Str("query", truncateQuery(sq.Query, 200)).
		Dur("duration", sq.Duration).
		Int64("rows", sq.RowsAffected).
		Str("caller", sq.CallerInfo).
		Msg("Slow query detected")
}

// GetQueries returns all logged slow queries
func (l *SlowQueryLogger) GetQueries() []SlowQuery {
	l.mu.RLock()
	defer l.mu.RUnlock()

	result := make([]SlowQuery, len(l.queries))
	copy(result, l.queries)
	return result
}

// Clear clears the slow query log
func (l *SlowQueryLogger) Clear() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.queries = l.queries[:0]
}

// NewIndexUsageMonitor creates a new index usage monitor
func NewIndexUsageMonitor(db *gorm.DB) *IndexUsageMonitor {
	return &IndexUsageMonitor{
		db:           db,
		scanInterval: 1 * time.Hour,
	}
}

// GetStats returns current index usage statistics
func (m *IndexUsageMonitor) GetStats(ctx context.Context) ([]IndexUsageStats, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Return cached stats if recent
	if time.Since(m.lastScan) < m.scanInterval && len(m.stats) > 0 {
		return m.stats, nil
	}

	query := `
		SELECT
			schemaname as schema_name,
			relname as table_name,
			indexrelname as index_name,
			idx_scan as index_scans,
			idx_tup_read as tuples_read,
			idx_tup_fetch as tuples_fetched,
			pg_relation_size(indexrelid) as index_size
		FROM pg_stat_user_indexes
		ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
	`

	var stats []IndexUsageStats
	if err := m.db.WithContext(ctx).Raw(query).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("failed to get index stats: %w", err)
	}

	// Calculate usage ratios and add recommendations
	for i := range stats {
		if stats[i].IndexScans == 0 {
			stats[i].IsUnused = true
			stats[i].Recommendation = "Consider dropping this unused index"
		}
		// Calculate usage ratio (scans per MB of index)
		if stats[i].IndexSize > 0 {
			stats[i].UsageRatio = float64(stats[i].IndexScans) / (float64(stats[i].IndexSize) / 1024 / 1024)
		}
	}

	m.stats = stats
	m.lastScan = time.Now()

	return stats, nil
}

// GetUnusedIndexes returns indexes with zero scans since last statistics reset
func (m *IndexUsageMonitor) GetUnusedIndexes(ctx context.Context) ([]IndexUsageStats, error) {
	query := `
		SELECT
			schemaname as schema_name,
			relname as table_name,
			indexrelname as index_name,
			idx_scan as index_scans,
			idx_tup_read as tuples_read,
			idx_tup_fetch as tuples_fetched,
			pg_relation_size(indexrelid) as index_size
		FROM pg_stat_user_indexes
		WHERE idx_scan = 0
			AND indexrelname NOT LIKE '%_pkey'
			AND indexrelname NOT LIKE '%_unique'
		ORDER BY pg_relation_size(indexrelid) DESC
	`

	var stats []IndexUsageStats
	if err := m.db.WithContext(ctx).Raw(query).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("failed to get unused indexes: %w", err)
	}

	for i := range stats {
		stats[i].IsUnused = true
		stats[i].Recommendation = "Consider dropping this unused index to save space and improve write performance"
	}

	return stats, nil
}

// GetDuplicateIndexes finds potentially duplicate indexes
func (m *IndexUsageMonitor) GetDuplicateIndexes(ctx context.Context) ([]IndexUsageStats, error) {
	query := `
		SELECT
			pg_size_pretty(sum(pg_relation_size(idx))::bigint) as size,
			(array_agg(idx))[1] as index1,
			(array_agg(idx))[2] as index2,
			(array_agg(idx))[3] as index3
		FROM (
			SELECT indexrelid::regclass as idx, (
				SELECT
					array_to_string(array_agg(attname ORDER BY attnum), ', ')
				FROM pg_attribute
				WHERE attrelid = pg_index.indrelid
					AND attnum = ANY(pg_index.indkey)
			) as columns
			FROM pg_index
			JOIN pg_stat_user_indexes USING (indexrelid)
		) s
		GROUP BY columns
		HAVING count(*) > 1
	`

	var results []struct {
		Size   string
		Index1 string
		Index2 string
		Index3 string
	}

	if err := m.db.WithContext(ctx).Raw(query).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get duplicate indexes: %w", err)
	}

	var stats []IndexUsageStats
	for _, r := range results {
		stats = append(stats, IndexUsageStats{
			IndexName:      r.Index1,
			IsDuplicate:    true,
			Recommendation: fmt.Sprintf("Potential duplicate of: %s, %s", r.Index2, r.Index3),
		})
	}

	return stats, nil
}

// QueryStats represents query statistics from pg_stat_statements
type QueryStats struct {
	Query           string  `json:"query"`
	Calls           int64   `json:"calls"`
	TotalTime       float64 `json:"total_time"`
	MeanTime        float64 `json:"mean_time"`
	MinTime         float64 `json:"min_time"`
	MaxTime         float64 `json:"max_time"`
	StddevTime      float64 `json:"stddev_time"`
	Rows            int64   `json:"rows"`
	SharedBlksHit   int64   `json:"shared_blks_hit"`
	SharedBlksRead  int64   `json:"shared_blks_read"`
	CacheHitRatio   float64 `json:"cache_hit_ratio"`
}

// GetTopSlowQueries returns the slowest queries from pg_stat_statements
func (qa *QueryAnalyzer) GetTopSlowQueries(ctx context.Context, limit int) ([]QueryStats, error) {
	query := `
		SELECT
			query,
			calls,
			total_exec_time as total_time,
			mean_exec_time as mean_time,
			min_exec_time as min_time,
			max_exec_time as max_time,
			stddev_exec_time as stddev_time,
			rows,
			shared_blks_hit,
			shared_blks_read,
			CASE WHEN (shared_blks_hit + shared_blks_read) > 0
				THEN shared_blks_hit::float / (shared_blks_hit + shared_blks_read)
				ELSE 0
			END as cache_hit_ratio
		FROM pg_stat_statements
		WHERE query NOT LIKE '%pg_stat%'
		ORDER BY mean_exec_time DESC
		LIMIT ?
	`

	var stats []QueryStats
	if err := qa.db.WithContext(ctx).Raw(query, limit).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("failed to get slow queries from pg_stat_statements: %w", err)
	}

	return stats, nil
}

// GetMostFrequentQueries returns the most frequently executed queries
func (qa *QueryAnalyzer) GetMostFrequentQueries(ctx context.Context, limit int) ([]QueryStats, error) {
	query := `
		SELECT
			query,
			calls,
			total_exec_time as total_time,
			mean_exec_time as mean_time,
			rows,
			shared_blks_hit,
			shared_blks_read,
			CASE WHEN (shared_blks_hit + shared_blks_read) > 0
				THEN shared_blks_hit::float / (shared_blks_hit + shared_blks_read)
				ELSE 0
			END as cache_hit_ratio
		FROM pg_stat_statements
		WHERE query NOT LIKE '%pg_stat%'
		ORDER BY calls DESC
		LIMIT ?
	`

	var stats []QueryStats
	if err := qa.db.WithContext(ctx).Raw(query, limit).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("failed to get frequent queries: %w", err)
	}

	return stats, nil
}

// ResetQueryStats resets pg_stat_statements statistics
func (qa *QueryAnalyzer) ResetQueryStats(ctx context.Context) error {
	return qa.db.WithContext(ctx).Exec("SELECT pg_stat_statements_reset()").Error
}

// TableStats represents table statistics
type TableStats struct {
	TableName       string `json:"table_name"`
	RowCount        int64  `json:"row_count"`
	TotalSize       int64  `json:"total_size"`
	IndexSize       int64  `json:"index_size"`
	ToastSize       int64  `json:"toast_size"`
	SeqScan         int64  `json:"seq_scan"`
	SeqTupRead      int64  `json:"seq_tup_read"`
	IdxScan         int64  `json:"idx_scan"`
	IdxTupFetch     int64  `json:"idx_tup_fetch"`
	DeadTuples      int64  `json:"dead_tuples"`
	LastVacuum      *time.Time `json:"last_vacuum,omitempty"`
	LastAutoVacuum  *time.Time `json:"last_autovacuum,omitempty"`
	LastAnalyze     *time.Time `json:"last_analyze,omitempty"`
	LastAutoAnalyze *time.Time `json:"last_autoanalyze,omitempty"`
}

// GetTableStats returns statistics for all user tables
func (qa *QueryAnalyzer) GetTableStats(ctx context.Context) ([]TableStats, error) {
	query := `
		SELECT
			relname as table_name,
			n_live_tup as row_count,
			pg_total_relation_size(relid) as total_size,
			pg_indexes_size(relid) as index_size,
			pg_total_relation_size(reltoastrelid) as toast_size,
			seq_scan,
			seq_tup_read,
			idx_scan,
			idx_tup_fetch,
			n_dead_tup as dead_tuples,
			last_vacuum,
			last_autovacuum,
			last_analyze,
			last_autoanalyze
		FROM pg_stat_user_tables
		ORDER BY pg_total_relation_size(relid) DESC
	`

	var stats []TableStats
	if err := qa.db.WithContext(ctx).Raw(query).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("failed to get table stats: %w", err)
	}

	return stats, nil
}

// AnalyzeTable runs ANALYZE on a specific table
func (qa *QueryAnalyzer) AnalyzeTable(ctx context.Context, tableName string) error {
	return qa.db.WithContext(ctx).Exec(fmt.Sprintf("ANALYZE %s", tableName)).Error
}

// VacuumTable runs VACUUM on a specific table
func (qa *QueryAnalyzer) VacuumTable(ctx context.Context, tableName string, full bool) error {
	cmd := "VACUUM"
	if full {
		cmd = "VACUUM FULL"
	}
	return qa.db.WithContext(ctx).Exec(fmt.Sprintf("%s %s", cmd, tableName)).Error
}

// OptimizeQueryWithHints wraps a query with optimizer hints
func OptimizeQueryWithHints(db *gorm.DB, hints map[string]string) *gorm.DB {
	var hintStr strings.Builder
	for key, value := range hints {
		hintStr.WriteString(fmt.Sprintf("SET LOCAL %s = '%s'; ", key, value))
	}

	return db.Exec(hintStr.String())
}

// WithQueryTimeout sets a statement timeout for the query
func WithQueryTimeout(db *gorm.DB, timeout time.Duration) *gorm.DB {
	return db.Exec(fmt.Sprintf("SET LOCAL statement_timeout = '%dms'", timeout.Milliseconds()))
}

// truncateQuery truncates a query string for logging
func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}

// ToJSON converts an ExplainPlan to JSON string
func (p *ExplainPlan) ToJSON() string {
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Sprintf("error marshaling plan: %v", err)
	}
	return string(data)
}

// Summary returns a human-readable summary of the explain plan
func (p *ExplainPlan) Summary() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Query: %s\n", truncateQuery(p.Query, 100)))
	sb.WriteString(fmt.Sprintf("Planning Time: %.2fms\n", p.PlanningTime))
	sb.WriteString(fmt.Sprintf("Execution Time: %.2fms\n", p.ExecutionTime))
	sb.WriteString(fmt.Sprintf("Total Cost: %.2f\n", p.TotalCost))
	sb.WriteString(fmt.Sprintf("Rows: %d (estimated: %d)\n", p.ActualRows, p.EstimatedRows))
	sb.WriteString(fmt.Sprintf("Seq Scans: %d, Index Scans: %d\n", p.SeqScans, p.IndexScans))
	sb.WriteString(fmt.Sprintf("Sort Operations: %d, Hash Joins: %d, Nested Loops: %d\n",
		p.SortOperations, p.HashJoins, p.NestedLoops))

	if len(p.Warnings) > 0 {
		sb.WriteString("\nWarnings:\n")
		for _, w := range p.Warnings {
			sb.WriteString(fmt.Sprintf("  - %s\n", w))
		}
	}

	return sb.String()
}
