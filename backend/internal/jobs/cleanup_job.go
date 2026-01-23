package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/domain/reports"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// CleanupWorker handles data cleanup and maintenance tasks
type CleanupWorker struct {
	db             *gorm.DB
	rdb            *redis.Client
	storageService reports.StorageService
}

// NewCleanupWorker creates a new cleanup worker
func NewCleanupWorker(db *gorm.DB, rdb *redis.Client, storageService reports.StorageService) *CleanupWorker {
	return &CleanupWorker{
		db:             db,
		rdb:            rdb,
		storageService: storageService,
	}
}

// RegisterHandlers registers all cleanup task handlers
func (w *CleanupWorker) RegisterHandlers(server *queue.Server) {
	server.HandleFunc(queue.TypeCleanupExpiredSessions, w.HandleCleanupExpiredSessions)
	server.HandleFunc(queue.TypeCleanupTempFiles, w.HandleCleanupTempFiles)
	server.HandleFunc(queue.TypeCleanupExpiredQRCodes, w.HandleCleanupExpiredQRCodes)
	server.HandleFunc(queue.TypeArchiveOldTransactions, w.HandleArchiveOldTransactions)
	server.HandleFunc(queue.TypeCleanupOldReports, w.HandleCleanupOldReports)
	server.HandleFunc(queue.TypeCleanupInactiveWallets, w.HandleCleanupInactiveWallets)
}

// HandleCleanupExpiredSessions handles cleaning up expired user sessions
func (w *CleanupWorker) HandleCleanupExpiredSessions(ctx context.Context, task *asynq.Task) error {
	var payload CleanupExpiredSessionsPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values for scheduled runs
		payload = CleanupExpiredSessionsPayload{
			ExpirationTime: time.Now().Add(-24 * time.Hour),
			BatchSize:      1000,
			DryRun:         false,
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Info().
		Str("taskId", taskID).
		Time("expirationTime", payload.ExpirationTime).
		Int("batchSize", payload.BatchSize).
		Bool("dryRun", payload.DryRun).
		Int("retry", retryCount).
		Msg("Processing cleanup expired sessions task")

	startTime := time.Now()
	var totalDeleted int64

	// Clean up sessions from Redis
	if w.rdb != nil {
		// Use SCAN to find expired session keys
		var cursor uint64
		sessionPattern := "session:*"

		for {
			keys, nextCursor, err := w.rdb.Scan(ctx, cursor, sessionPattern, 100).Result()
			if err != nil {
				log.Warn().Err(err).Msg("Error scanning Redis for expired sessions")
				break
			}

			for _, key := range keys {
				// Check if the key has expired or is about to expire
				ttl, err := w.rdb.TTL(ctx, key).Result()
				if err != nil {
					continue
				}

				// Delete keys with no TTL (shouldn't happen) or already expired
				if ttl < 0 {
					if !payload.DryRun {
						w.rdb.Del(ctx, key)
					}
					totalDeleted++
				}
			}

			cursor = nextCursor
			if cursor == 0 {
				break
			}
		}
	}

	// Clean up sessions from database if applicable
	if w.db != nil && !payload.DryRun {
		result := w.db.WithContext(ctx).
			Exec("DELETE FROM sessions WHERE expires_at < ? LIMIT ?",
				payload.ExpirationTime, payload.BatchSize)

		if result.Error != nil {
			log.Warn().Err(result.Error).Msg("Error cleaning up database sessions")
		} else {
			totalDeleted += result.RowsAffected
		}
	}

	// Clean up refresh tokens
	if w.db != nil && !payload.DryRun {
		result := w.db.WithContext(ctx).
			Exec("DELETE FROM refresh_tokens WHERE expires_at < ? LIMIT ?",
				payload.ExpirationTime, payload.BatchSize)

		if result.Error != nil {
			log.Warn().Err(result.Error).Msg("Error cleaning up expired refresh tokens")
		} else {
			totalDeleted += result.RowsAffected
		}
	}

	log.Info().
		Str("taskId", taskID).
		Int64("totalDeleted", totalDeleted).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Cleanup expired sessions completed")

	return nil
}

// HandleCleanupTempFiles handles cleaning up temporary files
func (w *CleanupWorker) HandleCleanupTempFiles(ctx context.Context, task *asynq.Task) error {
	var payload CleanupTempFilesPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values for scheduled runs
		payload = CleanupTempFilesPayload{
			Directory:   "/tmp/festivals",
			OlderThan:   6 * time.Hour,
			FilePattern: "*",
			DryRun:      false,
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("directory", payload.Directory).
		Dur("olderThan", payload.OlderThan).
		Str("pattern", payload.FilePattern).
		Bool("dryRun", payload.DryRun).
		Msg("Processing cleanup temp files task")

	startTime := time.Now()
	var filesDeleted int
	var bytesFreed int64

	// Check if directory exists
	if _, err := os.Stat(payload.Directory); os.IsNotExist(err) {
		log.Info().
			Str("directory", payload.Directory).
			Msg("Temp directory does not exist, nothing to clean")
		return nil
	}

	cutoffTime := time.Now().Add(-payload.OlderThan)

	// Walk the directory and find old files
	err := filepath.Walk(payload.Directory, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Check if file matches pattern (if specified)
		if payload.FilePattern != "" && payload.FilePattern != "*" {
			matched, _ := filepath.Match(payload.FilePattern, info.Name())
			if !matched {
				return nil
			}
		}

		// Check if file is older than the cutoff
		if info.ModTime().Before(cutoffTime) {
			if payload.DryRun {
				log.Debug().
					Str("file", path).
					Time("modTime", info.ModTime()).
					Int64("size", info.Size()).
					Msg("[DRY RUN] Would delete temp file")
			} else {
				if err := os.Remove(path); err != nil {
					log.Warn().
						Err(err).
						Str("file", path).
						Msg("Failed to delete temp file")
				} else {
					bytesFreed += info.Size()
				}
			}
			filesDeleted++
		}

		return nil
	})

	if err != nil {
		log.Warn().Err(err).Msg("Error walking temp directory")
	}

	// Clean up empty subdirectories
	if !payload.DryRun {
		w.cleanEmptyDirs(payload.Directory)
	}

	log.Info().
		Str("taskId", taskID).
		Int("filesDeleted", filesDeleted).
		Int64("bytesFreed", bytesFreed).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Cleanup temp files completed")

	return nil
}

// cleanEmptyDirs removes empty directories
func (w *CleanupWorker) cleanEmptyDirs(root string) {
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || !info.IsDir() || path == root {
			return nil
		}

		entries, err := os.ReadDir(path)
		if err == nil && len(entries) == 0 {
			os.Remove(path)
		}
		return nil
	})
}

// HandleCleanupExpiredQRCodes handles cleaning up expired QR codes
func (w *CleanupWorker) HandleCleanupExpiredQRCodes(ctx context.Context, task *asynq.Task) error {
	var payload CleanupExpiredQRCodesPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values for scheduled runs - clean codes older than 30 days
		payload = CleanupExpiredQRCodesPayload{
			ExpirationDate: time.Now().AddDate(0, 0, -30),
			DryRun:         false,
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Time("expirationDate", payload.ExpirationDate).
		Bool("dryRun", payload.DryRun).
		Msg("Processing cleanup expired QR codes task")

	startTime := time.Now()
	var totalDeleted int64

	if w.db != nil {
		// Build the query
		query := w.db.WithContext(ctx)

		if payload.FestivalID != nil {
			query = query.Where("festival_id = ?", payload.FestivalID)
		}

		if payload.DryRun {
			// Just count what would be deleted
			var count int64
			err := query.Model(&struct{}{}).
				Table("qr_codes").
				Where("expires_at < ? OR (used = false AND created_at < ?)",
					time.Now(), payload.ExpirationDate).
				Count(&count).Error

			if err != nil {
				log.Warn().Err(err).Msg("Error counting expired QR codes")
			} else {
				totalDeleted = count
			}
		} else {
			// Actually delete expired QR codes
			result := query.
				Exec("DELETE FROM qr_codes WHERE expires_at < ? OR (used = false AND created_at < ?)",
					time.Now(), payload.ExpirationDate)

			if result.Error != nil {
				log.Warn().Err(result.Error).Msg("Error deleting expired QR codes")
			} else {
				totalDeleted = result.RowsAffected
			}
		}
	}

	// Clean up QR code images from storage if applicable
	if w.storageService != nil && !payload.DryRun && totalDeleted > 0 {
		// Delete associated QR code images
		log.Debug().Msg("Cleaning up QR code images from storage")
		// Storage cleanup would be implemented here based on the storage service interface
	}

	log.Info().
		Str("taskId", taskID).
		Int64("totalDeleted", totalDeleted).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Cleanup expired QR codes completed")

	return nil
}

// HandleArchiveOldTransactions handles archiving old transactions
func (w *CleanupWorker) HandleArchiveOldTransactions(ctx context.Context, task *asynq.Task) error {
	var payload ArchiveOldTransactionsPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values - archive transactions older than 1 year
		payload = ArchiveOldTransactionsPayload{
			OlderThan: time.Now().AddDate(-1, 0, 0),
			BatchSize: 1000,
			DryRun:    false,
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Time("olderThan", payload.OlderThan).
		Int("batchSize", payload.BatchSize).
		Bool("dryRun", payload.DryRun).
		Msg("Processing archive old transactions task")

	startTime := time.Now()
	var totalArchived int64
	var totalProcessed int

	if w.db != nil {
		// Process in batches
		for {
			if ctx.Err() != nil {
				log.Warn().Msg("Context cancelled, stopping archive process")
				break
			}

			var count int64
			query := w.db.WithContext(ctx)

			if payload.FestivalID != nil {
				query = query.Where("festival_id = ?", payload.FestivalID)
			}

			if payload.DryRun {
				// Just count
				err := query.Model(&struct{}{}).
					Table("transactions").
					Where("created_at < ? AND archived = false", payload.OlderThan).
					Limit(payload.BatchSize).
					Count(&count).Error

				if err != nil {
					log.Warn().Err(err).Msg("Error counting transactions to archive")
					break
				}

				totalArchived += count
				break // In dry run mode, just count once
			}

			// Move transactions to archive table
			result := query.Exec(`
				INSERT INTO transactions_archive
				SELECT * FROM transactions
				WHERE created_at < ? AND archived = false
				LIMIT ?
			`, payload.OlderThan, payload.BatchSize)

			if result.Error != nil {
				log.Warn().Err(result.Error).Msg("Error archiving transactions")
				break
			}

			if result.RowsAffected == 0 {
				break // No more transactions to archive
			}

			// Mark as archived
			w.db.WithContext(ctx).Exec(`
				UPDATE transactions SET archived = true
				WHERE created_at < ? AND archived = false
				LIMIT ?
			`, payload.OlderThan, payload.BatchSize)

			totalArchived += result.RowsAffected
			totalProcessed++

			// Log progress periodically
			if totalProcessed%10 == 0 {
				log.Info().
					Int("batchesProcessed", totalProcessed).
					Int64("totalArchived", totalArchived).
					Msg("Archive progress")
			}

			// Small delay to avoid overwhelming the database
			time.Sleep(100 * time.Millisecond)
		}
	}

	log.Info().
		Str("taskId", taskID).
		Int64("totalArchived", totalArchived).
		Int("batchesProcessed", totalProcessed).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Archive old transactions completed")

	return nil
}

// HandleCleanupOldReports handles cleaning up old report files
func (w *CleanupWorker) HandleCleanupOldReports(ctx context.Context, task *asynq.Task) error {
	var payload CleanupOldReportsPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values - clean reports older than 90 days
		payload = CleanupOldReportsPayload{
			OlderThan:    90 * 24 * time.Hour,
			StatusFilter: []string{"completed", "failed", "expired"},
			DryRun:       false,
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Dur("olderThan", payload.OlderThan).
		Strs("statusFilter", payload.StatusFilter).
		Bool("dryRun", payload.DryRun).
		Msg("Processing cleanup old reports task")

	startTime := time.Now()
	var totalDeleted int64
	var filesDeleted int

	cutoffDate := time.Now().Add(-payload.OlderThan)

	if w.db != nil {
		query := w.db.WithContext(ctx)

		if payload.FestivalID != nil {
			query = query.Where("festival_id = ?", payload.FestivalID)
		}

		if len(payload.StatusFilter) > 0 {
			query = query.Where("status IN ?", payload.StatusFilter)
		}

		if payload.DryRun {
			// Just count
			var count int64
			err := query.Model(&struct{}{}).
				Table("reports").
				Where("created_at < ?", cutoffDate).
				Count(&count).Error

			if err != nil {
				log.Warn().Err(err).Msg("Error counting old reports")
			} else {
				totalDeleted = count
			}
		} else {
			// Get file paths before deleting records
			var filePaths []string
			w.db.WithContext(ctx).
				Table("reports").
				Where("created_at < ?", cutoffDate).
				Where("file_path IS NOT NULL AND file_path != ''").
				Pluck("file_path", &filePaths)

			// Delete report files from storage
			for _, path := range filePaths {
				if w.storageService != nil {
					// Delete from object storage
					log.Debug().Str("path", path).Msg("Would delete report file from storage")
				} else {
					// Delete from local filesystem
					if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
						log.Warn().Err(err).Str("path", path).Msg("Failed to delete report file")
					} else {
						filesDeleted++
					}
				}
			}

			// Delete report records
			result := query.
				Exec("DELETE FROM reports WHERE created_at < ?", cutoffDate)

			if result.Error != nil {
				log.Warn().Err(result.Error).Msg("Error deleting old reports")
			} else {
				totalDeleted = result.RowsAffected
			}
		}
	}

	log.Info().
		Str("taskId", taskID).
		Int64("recordsDeleted", totalDeleted).
		Int("filesDeleted", filesDeleted).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Cleanup old reports completed")

	return nil
}

// HandleCleanupInactiveWallets handles cleaning up inactive wallets
func (w *CleanupWorker) HandleCleanupInactiveWallets(ctx context.Context, task *asynq.Task) error {
	var payload CleanupInactiveWalletsPayload

	// Allow empty payload for scheduled tasks
	if len(task.Payload()) > 0 {
		if err := json.Unmarshal(task.Payload(), &payload); err != nil {
			return fmt.Errorf("failed to unmarshal payload: %w", err)
		}
	} else {
		// Default values - clean wallets inactive for more than 2 years
		payload = CleanupInactiveWalletsPayload{
			InactiveDuration: 365 * 2 * 24 * time.Hour, // 2 years
			ZeroBalanceOnly:  true,
			DryRun:           false,
		}
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Dur("inactiveDuration", payload.InactiveDuration).
		Bool("zeroBalanceOnly", payload.ZeroBalanceOnly).
		Bool("dryRun", payload.DryRun).
		Msg("Processing cleanup inactive wallets task")

	startTime := time.Now()
	var totalDeleted int64

	cutoffDate := time.Now().Add(-payload.InactiveDuration)

	if w.db != nil {
		query := w.db.WithContext(ctx)

		if payload.FestivalID != nil {
			query = query.Where("festival_id = ?", payload.FestivalID)
		}

		// Build the inactive wallet query
		// A wallet is considered inactive if:
		// 1. No transactions in the specified period
		// 2. Optionally has zero balance

		subQuery := `
			NOT EXISTS (
				SELECT 1 FROM transactions t
				WHERE t.wallet_id = wallets.id
				AND t.created_at > ?
			)
		`

		if payload.ZeroBalanceOnly {
			query = query.Where("balance = 0")
		}

		if payload.DryRun {
			var count int64
			err := query.Model(&struct{}{}).
				Table("wallets").
				Where(subQuery, cutoffDate).
				Where("updated_at < ?", cutoffDate).
				Count(&count).Error

			if err != nil {
				log.Warn().Err(err).Msg("Error counting inactive wallets")
			} else {
				totalDeleted = count
			}
		} else {
			// Soft delete inactive wallets (mark as deleted instead of hard delete)
			result := query.
				Exec(`
					UPDATE wallets
					SET deleted_at = NOW(), status = 'inactive'
					WHERE deleted_at IS NULL
					AND updated_at < ?
					AND `+subQuery,
					cutoffDate, cutoffDate)

			if result.Error != nil {
				log.Warn().Err(result.Error).Msg("Error cleaning up inactive wallets")
			} else {
				totalDeleted = result.RowsAffected
			}
		}
	}

	log.Info().
		Str("taskId", taskID).
		Int64("totalProcessed", totalDeleted).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Cleanup inactive wallets completed")

	return nil
}

// CleanupResult represents the result of a cleanup operation for dead letter handling
type CleanupResult struct {
	TaskID       string    `json:"taskId"`
	TaskType     string    `json:"taskType"`
	ItemsDeleted int64     `json:"itemsDeleted"`
	BytesFreed   int64     `json:"bytesFreed,omitempty"`
	DryRun       bool      `json:"dryRun"`
	Error        string    `json:"error,omitempty"`
	Duration     string    `json:"duration"`
	RetryCount   int       `json:"retryCount"`
	ProcessedAt  time.Time `json:"processedAt"`
}
