package database

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// PartitionManager manages table partitioning for time-series data
type PartitionManager struct {
	db *gorm.DB
}

// PartitionConfig represents configuration for a partitioned table
type PartitionConfig struct {
	TableName       string
	PartitionColumn string
	PartitionType   PartitionType
	RetentionPeriod time.Duration
	PartitionSize   PartitionSize
}

// PartitionType represents the type of partitioning
type PartitionType string

const (
	PartitionTypeRange PartitionType = "RANGE"
	PartitionTypeList  PartitionType = "LIST"
	PartitionTypeHash  PartitionType = "HASH"
)

// PartitionSize represents the granularity of partitions
type PartitionSize string

const (
	PartitionSizeDaily   PartitionSize = "daily"
	PartitionSizeWeekly  PartitionSize = "weekly"
	PartitionSizeMonthly PartitionSize = "monthly"
	PartitionSizeYearly  PartitionSize = "yearly"
)

// PartitionInfo represents information about an existing partition
type PartitionInfo struct {
	ParentTable   string    `json:"parent_table"`
	PartitionName string    `json:"partition_name"`
	RangeStart    time.Time `json:"range_start"`
	RangeEnd      time.Time `json:"range_end"`
	RowCount      int64     `json:"row_count"`
	SizeBytes     int64     `json:"size_bytes"`
	SizePretty    string    `json:"size_pretty"`
}

// NewPartitionManager creates a new partition manager
func NewPartitionManager(db *gorm.DB) *PartitionManager {
	return &PartitionManager{db: db}
}

// SetupTransactionsPartitioning sets up partitioning for the transactions table
// This converts the existing table to a partitioned table
func (pm *PartitionManager) SetupTransactionsPartitioning(ctx context.Context) error {
	// Check if already partitioned
	isPartitioned, err := pm.IsTablePartitioned(ctx, "transactions")
	if err != nil {
		return fmt.Errorf("failed to check if table is partitioned: %w", err)
	}

	if isPartitioned {
		log.Info().Msg("transactions table is already partitioned")
		return nil
	}

	log.Info().Msg("Setting up partitioning for transactions table")

	// Create the partitioned table structure
	// Note: This requires careful migration planning in production
	return pm.createPartitionedTransactions(ctx)
}

// createPartitionedTransactions creates a new partitioned transactions table
// In production, you would need to migrate data from the existing table
func (pm *PartitionManager) createPartitionedTransactions(ctx context.Context) error {
	// SQL to convert to partitioned table
	// This is a simplified version - production would need data migration
	sql := `
		-- Create the new partitioned table
		CREATE TABLE IF NOT EXISTS transactions_partitioned (
			id UUID NOT NULL DEFAULT gen_random_uuid(),
			wallet_id UUID NOT NULL,
			type VARCHAR(20) NOT NULL,
			amount BIGINT NOT NULL,
			balance_before BIGINT NOT NULL,
			balance_after BIGINT NOT NULL,
			reference VARCHAR(255),
			stand_id UUID,
			staff_id UUID,
			metadata JSONB DEFAULT '{}',
			status VARCHAR(20) DEFAULT 'COMPLETED',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
			PRIMARY KEY (id, created_at)
		) PARTITION BY RANGE (created_at);

		-- Create indexes on the partitioned table
		CREATE INDEX IF NOT EXISTS idx_transactions_part_wallet_created
			ON transactions_partitioned(wallet_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_transactions_part_stand_created
			ON transactions_partitioned(stand_id, created_at DESC)
			WHERE stand_id IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_transactions_part_status
			ON transactions_partitioned(status, created_at DESC);
	`

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create partitioned transactions table: %w", err)
	}

	// Create initial partitions
	now := time.Now()
	for i := -6; i <= 6; i++ {
		month := now.AddDate(0, i, 0)
		if err := pm.CreateMonthlyPartition(ctx, "transactions_partitioned", month); err != nil {
			log.Warn().Err(err).Msgf("Failed to create partition for %s", month.Format("2006-01"))
		}
	}

	return nil
}

// SetupAuditLogsPartitioning sets up partitioning for the audit_logs table
func (pm *PartitionManager) SetupAuditLogsPartitioning(ctx context.Context) error {
	isPartitioned, err := pm.IsTablePartitioned(ctx, "audit_logs")
	if err != nil {
		return fmt.Errorf("failed to check if table is partitioned: %w", err)
	}

	if isPartitioned {
		log.Info().Msg("audit_logs table is already partitioned")
		return nil
	}

	log.Info().Msg("Setting up partitioning for audit_logs table")

	sql := `
		-- Create the new partitioned audit_logs table
		CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
			id UUID NOT NULL DEFAULT gen_random_uuid(),
			user_id UUID,
			action VARCHAR(50) NOT NULL,
			resource VARCHAR(100) NOT NULL,
			resource_id VARCHAR(100),
			changes JSONB,
			ip VARCHAR(45),
			user_agent TEXT,
			metadata JSONB,
			festival_id UUID,
			timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, timestamp)
		) PARTITION BY RANGE (timestamp);

		-- Create indexes
		CREATE INDEX IF NOT EXISTS idx_audit_part_user_time
			ON audit_logs_partitioned(user_id, timestamp DESC)
			WHERE user_id IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_audit_part_festival_time
			ON audit_logs_partitioned(festival_id, timestamp DESC)
			WHERE festival_id IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_audit_part_action
			ON audit_logs_partitioned(action, timestamp DESC);
	`

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create partitioned audit_logs table: %w", err)
	}

	// Create initial partitions
	now := time.Now()
	for i := -3; i <= 3; i++ {
		month := now.AddDate(0, i, 0)
		if err := pm.CreateMonthlyPartition(ctx, "audit_logs_partitioned", month); err != nil {
			log.Warn().Err(err).Msgf("Failed to create partition for %s", month.Format("2006-01"))
		}
	}

	return nil
}

// CreateMonthlyPartition creates a monthly partition for a table
func (pm *PartitionManager) CreateMonthlyPartition(ctx context.Context, tableName string, month time.Time) error {
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	partitionName := fmt.Sprintf("%s_%s", tableName, start.Format("2006_01"))

	sql := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s
		PARTITION OF %s
		FOR VALUES FROM ('%s') TO ('%s')
	`, partitionName, tableName, start.Format("2006-01-02"), end.Format("2006-01-02"))

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
	}

	log.Info().
		Str("table", tableName).
		Str("partition", partitionName).
		Time("start", start).
		Time("end", end).
		Msg("Created monthly partition")

	return nil
}

// CreateDailyPartition creates a daily partition for a table
func (pm *PartitionManager) CreateDailyPartition(ctx context.Context, tableName string, date time.Time) error {
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 1)
	partitionName := fmt.Sprintf("%s_%s", tableName, start.Format("2006_01_02"))

	sql := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s
		PARTITION OF %s
		FOR VALUES FROM ('%s') TO ('%s')
	`, partitionName, tableName, start.Format("2006-01-02"), end.Format("2006-01-02"))

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
	}

	log.Info().
		Str("table", tableName).
		Str("partition", partitionName).
		Time("date", start).
		Msg("Created daily partition")

	return nil
}

// CreateFuturePartitions creates partitions for future dates
func (pm *PartitionManager) CreateFuturePartitions(ctx context.Context, tableName string, size PartitionSize, count int) error {
	now := time.Now()

	for i := 1; i <= count; i++ {
		var date time.Time
		switch size {
		case PartitionSizeDaily:
			date = now.AddDate(0, 0, i)
			if err := pm.CreateDailyPartition(ctx, tableName, date); err != nil {
				return err
			}
		case PartitionSizeWeekly:
			date = now.AddDate(0, 0, i*7)
			// For weekly, we still use monthly partitions but could adjust
			if err := pm.CreateMonthlyPartition(ctx, tableName, date); err != nil {
				return err
			}
		case PartitionSizeMonthly:
			date = now.AddDate(0, i, 0)
			if err := pm.CreateMonthlyPartition(ctx, tableName, date); err != nil {
				return err
			}
		case PartitionSizeYearly:
			date = now.AddDate(i, 0, 0)
			if err := pm.CreateYearlyPartition(ctx, tableName, date); err != nil {
				return err
			}
		}
	}

	return nil
}

// CreateYearlyPartition creates a yearly partition for a table
func (pm *PartitionManager) CreateYearlyPartition(ctx context.Context, tableName string, year time.Time) error {
	start := time.Date(year.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(1, 0, 0)
	partitionName := fmt.Sprintf("%s_%d", tableName, start.Year())

	sql := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s
		PARTITION OF %s
		FOR VALUES FROM ('%s') TO ('%s')
	`, partitionName, tableName, start.Format("2006-01-02"), end.Format("2006-01-02"))

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
	}

	log.Info().
		Str("table", tableName).
		Str("partition", partitionName).
		Int("year", start.Year()).
		Msg("Created yearly partition")

	return nil
}

// DropOldPartitions drops partitions older than the retention period
func (pm *PartitionManager) DropOldPartitions(ctx context.Context, tableName string, retentionPeriod time.Duration) (int, error) {
	cutoffDate := time.Now().Add(-retentionPeriod)

	// Get partitions to drop
	partitions, err := pm.GetPartitions(ctx, tableName)
	if err != nil {
		return 0, fmt.Errorf("failed to get partitions: %w", err)
	}

	dropped := 0
	for _, p := range partitions {
		if p.RangeEnd.Before(cutoffDate) {
			if err := pm.DropPartition(ctx, p.PartitionName); err != nil {
				log.Error().Err(err).Str("partition", p.PartitionName).Msg("Failed to drop partition")
				continue
			}
			dropped++
		}
	}

	log.Info().
		Str("table", tableName).
		Int("dropped", dropped).
		Time("cutoff", cutoffDate).
		Msg("Dropped old partitions")

	return dropped, nil
}

// DropPartition drops a specific partition
func (pm *PartitionManager) DropPartition(ctx context.Context, partitionName string) error {
	sql := fmt.Sprintf("DROP TABLE IF EXISTS %s", partitionName)
	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to drop partition %s: %w", partitionName, err)
	}

	log.Info().Str("partition", partitionName).Msg("Dropped partition")
	return nil
}

// DetachPartition detaches a partition without dropping it (for archiving)
func (pm *PartitionManager) DetachPartition(ctx context.Context, parentTable, partitionName string) error {
	sql := fmt.Sprintf("ALTER TABLE %s DETACH PARTITION %s", parentTable, partitionName)
	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to detach partition %s: %w", partitionName, err)
	}

	log.Info().
		Str("parent", parentTable).
		Str("partition", partitionName).
		Msg("Detached partition")
	return nil
}

// AttachPartition attaches a table as a partition
func (pm *PartitionManager) AttachPartition(ctx context.Context, parentTable, partitionName string, rangeStart, rangeEnd time.Time) error {
	sql := fmt.Sprintf(`
		ALTER TABLE %s ATTACH PARTITION %s
		FOR VALUES FROM ('%s') TO ('%s')
	`, parentTable, partitionName, rangeStart.Format("2006-01-02"), rangeEnd.Format("2006-01-02"))

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to attach partition %s: %w", partitionName, err)
	}

	log.Info().
		Str("parent", parentTable).
		Str("partition", partitionName).
		Msg("Attached partition")
	return nil
}

// GetPartitions returns all partitions for a table
func (pm *PartitionManager) GetPartitions(ctx context.Context, tableName string) ([]PartitionInfo, error) {
	query := `
		SELECT
			parent.relname as parent_table,
			child.relname as partition_name,
			pg_get_expr(child.relpartbound, child.oid) as partition_expr,
			pg_total_relation_size(child.oid) as size_bytes,
			pg_size_pretty(pg_total_relation_size(child.oid)) as size_pretty
		FROM pg_inherits
		JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
		JOIN pg_class child ON pg_inherits.inhrelid = child.oid
		WHERE parent.relname = ?
		ORDER BY child.relname
	`

	var results []struct {
		ParentTable   string
		PartitionName string
		PartitionExpr string
		SizeBytes     int64
		SizePretty    string
	}

	if err := pm.db.WithContext(ctx).Raw(query, tableName).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get partitions: %w", err)
	}

	partitions := make([]PartitionInfo, len(results))
	for i, r := range results {
		partitions[i] = PartitionInfo{
			ParentTable:   r.ParentTable,
			PartitionName: r.PartitionName,
			SizeBytes:     r.SizeBytes,
			SizePretty:    r.SizePretty,
		}
		// Parse partition bounds from the expression
		pm.parsePartitionBounds(&partitions[i], r.PartitionExpr)
	}

	// Get row counts for each partition
	for i := range partitions {
		var count int64
		if err := pm.db.WithContext(ctx).Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", partitions[i].PartitionName)).Scan(&count).Error; err == nil {
			partitions[i].RowCount = count
		}
	}

	return partitions, nil
}

// parsePartitionBounds parses the partition expression to extract bounds
func (pm *PartitionManager) parsePartitionBounds(info *PartitionInfo, expr string) {
	// Expression format: FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
	// This is a simplified parser
	var startStr, endStr string
	_, _ = fmt.Sscanf(expr, "FOR VALUES FROM ('%s') TO ('%s')", &startStr, &endStr)

	if len(startStr) >= 10 {
		info.RangeStart, _ = time.Parse("2006-01-02", startStr[:10])
	}
	if len(endStr) >= 10 {
		info.RangeEnd, _ = time.Parse("2006-01-02", endStr[:10])
	}
}

// IsTablePartitioned checks if a table is partitioned
func (pm *PartitionManager) IsTablePartitioned(ctx context.Context, tableName string) (bool, error) {
	var count int64
	query := `
		SELECT COUNT(*)
		FROM pg_partitioned_table pt
		JOIN pg_class c ON pt.partrelid = c.oid
		WHERE c.relname = ?
	`

	if err := pm.db.WithContext(ctx).Raw(query, tableName).Scan(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check if table is partitioned: %w", err)
	}

	return count > 0, nil
}

// GetPartitionStats returns statistics for all partitions of a table
func (pm *PartitionManager) GetPartitionStats(ctx context.Context, tableName string) (map[string]interface{}, error) {
	partitions, err := pm.GetPartitions(ctx, tableName)
	if err != nil {
		return nil, err
	}

	var totalRows int64
	var totalSize int64
	for _, p := range partitions {
		totalRows += p.RowCount
		totalSize += p.SizeBytes
	}

	return map[string]interface{}{
		"table_name":       tableName,
		"partition_count":  len(partitions),
		"total_rows":       totalRows,
		"total_size_bytes": totalSize,
		"partitions":       partitions,
	}, nil
}

// CreateDefaultPartition creates a default partition to catch data that doesn't fit other partitions
func (pm *PartitionManager) CreateDefaultPartition(ctx context.Context, tableName string) error {
	partitionName := fmt.Sprintf("%s_default", tableName)
	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s PARTITION OF %s DEFAULT", partitionName, tableName)

	if err := pm.db.WithContext(ctx).Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create default partition: %w", err)
	}

	log.Info().
		Str("table", tableName).
		Str("partition", partitionName).
		Msg("Created default partition")
	return nil
}

// MigrateToPartitioned migrates data from a regular table to a partitioned table
func (pm *PartitionManager) MigrateToPartitioned(ctx context.Context, sourceTable, targetTable string, batchSize int) error {
	log.Info().
		Str("source", sourceTable).
		Str("target", targetTable).
		Int("batch_size", batchSize).
		Msg("Starting partition migration")

	// Get total count
	var totalCount int64
	if err := pm.db.WithContext(ctx).Raw(fmt.Sprintf("SELECT COUNT(*) FROM %s", sourceTable)).Scan(&totalCount).Error; err != nil {
		return fmt.Errorf("failed to get count: %w", err)
	}

	log.Info().Int64("total_rows", totalCount).Msg("Migration starting")

	// Migrate in batches
	offset := 0
	migrated := int64(0)
	for {
		sql := fmt.Sprintf(`
			INSERT INTO %s
			SELECT * FROM %s
			ORDER BY created_at
			LIMIT %d OFFSET %d
		`, targetTable, sourceTable, batchSize, offset)

		result := pm.db.WithContext(ctx).Exec(sql)
		if result.Error != nil {
			return fmt.Errorf("failed to migrate batch at offset %d: %w", offset, result.Error)
		}

		migrated += result.RowsAffected
		if result.RowsAffected < int64(batchSize) {
			break
		}

		offset += batchSize
		log.Info().
			Int64("migrated", migrated).
			Int64("total", totalCount).
			Float64("progress", float64(migrated)/float64(totalCount)*100).
			Msg("Migration progress")
	}

	log.Info().Int64("migrated", migrated).Msg("Migration completed")
	return nil
}

// PartitionPruningHelper helps with efficient partition pruning
type PartitionPruningHelper struct {
	pm *PartitionManager
}

// NewPartitionPruningHelper creates a new partition pruning helper
func NewPartitionPruningHelper(pm *PartitionManager) *PartitionPruningHelper {
	return &PartitionPruningHelper{pm: pm}
}

// GetRelevantPartitions returns partition names that contain data in the given time range
func (h *PartitionPruningHelper) GetRelevantPartitions(ctx context.Context, tableName string, start, end time.Time) ([]string, error) {
	partitions, err := h.pm.GetPartitions(ctx, tableName)
	if err != nil {
		return nil, err
	}

	var relevant []string
	for _, p := range partitions {
		// Check if partition range overlaps with query range
		if !(p.RangeEnd.Before(start) || p.RangeStart.After(end)) {
			relevant = append(relevant, p.PartitionName)
		}
	}

	return relevant, nil
}

// BuildPartitionedQuery builds a query that only scans relevant partitions
func (h *PartitionPruningHelper) BuildPartitionedQuery(ctx context.Context, tableName string, start, end time.Time) (string, error) {
	partitions, err := h.GetRelevantPartitions(ctx, tableName, start, end)
	if err != nil {
		return "", err
	}

	if len(partitions) == 0 {
		return "", fmt.Errorf("no partitions found for the given time range")
	}

	// Build UNION ALL query for specific partitions (manual pruning)
	// Note: PostgreSQL should automatically prune partitions with proper constraints,
	// but this can be used for explicit control
	return fmt.Sprintf("SELECT * FROM %s WHERE created_at >= '%s' AND created_at < '%s'",
		tableName, start.Format("2006-01-02 15:04:05"), end.Format("2006-01-02 15:04:05")), nil
}

// MaintenanceRunner runs periodic partition maintenance
type MaintenanceRunner struct {
	pm       *PartitionManager
	configs  []PartitionConfig
	stopChan chan struct{}
}

// NewMaintenanceRunner creates a new maintenance runner
func NewMaintenanceRunner(pm *PartitionManager, configs []PartitionConfig) *MaintenanceRunner {
	return &MaintenanceRunner{
		pm:       pm,
		configs:  configs,
		stopChan: make(chan struct{}),
	}
}

// Start starts the maintenance runner
func (r *MaintenanceRunner) Start(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				r.runMaintenance(ctx)
			case <-r.stopChan:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

// Stop stops the maintenance runner
func (r *MaintenanceRunner) Stop() {
	close(r.stopChan)
}

// runMaintenance runs partition maintenance for all configured tables
func (r *MaintenanceRunner) runMaintenance(ctx context.Context) {
	for _, config := range r.configs {
		// Create future partitions
		if err := r.pm.CreateFuturePartitions(ctx, config.TableName, config.PartitionSize, 3); err != nil {
			log.Error().Err(err).Str("table", config.TableName).Msg("Failed to create future partitions")
		}

		// Drop old partitions
		if config.RetentionPeriod > 0 {
			dropped, err := r.pm.DropOldPartitions(ctx, config.TableName, config.RetentionPeriod)
			if err != nil {
				log.Error().Err(err).Str("table", config.TableName).Msg("Failed to drop old partitions")
			} else if dropped > 0 {
				log.Info().
					Str("table", config.TableName).
					Int("dropped", dropped).
					Msg("Dropped old partitions during maintenance")
			}
		}
	}
}
