package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/domain/sync"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/rs/zerolog/log"
)

// SyncWorker handles offline data synchronization tasks
type SyncWorker struct {
	syncService *sync.Service
}

// NewSyncWorker creates a new sync worker
func NewSyncWorker(syncService *sync.Service) *SyncWorker {
	return &SyncWorker{
		syncService: syncService,
	}
}

// RegisterHandlers registers all sync task handlers
func (w *SyncWorker) RegisterHandlers(server *queue.Server) {
	server.HandleFunc(queue.TypeProcessSyncBatch, w.HandleProcessSyncBatch)
	server.HandleFunc(queue.TypeRetrySyncBatch, w.HandleRetrySyncBatch)
	server.HandleFunc(queue.TypeProcessOfflineTx, w.HandleProcessOfflineTransaction)
	server.HandleFunc(queue.TypeReconcileSyncData, w.HandleReconcileSyncData)
}

// HandleProcessSyncBatch handles processing a batch of offline transactions
func (w *SyncWorker) HandleProcessSyncBatch(ctx context.Context, task *asynq.Task) error {
	var payload ProcessSyncBatchPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("batchId", payload.BatchID.String()).
		Str("deviceId", payload.DeviceID).
		Str("festivalId", payload.FestivalID.String()).
		Int("retry", retryCount).
		Msg("Processing sync batch task")

	startTime := time.Now()

	// Get the batch from the sync service
	batch, err := w.syncService.GetBatch(ctx, payload.BatchID)
	if err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("batchId", payload.BatchID.String()).
			Msg("Failed to get sync batch")
		return fmt.Errorf("failed to get batch: %w", err)
	}

	// Process the batch
	result, err := w.syncService.ProcessSyncBatch(ctx, sync.SubmitBatchRequest{
		DeviceID:     batch.DeviceID,
		FestivalID:   batch.FestivalID,
		Transactions: batch.Transactions,
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("batchId", payload.BatchID.String()).
			Dur("duration", time.Since(startTime)).
			Msg("Failed to process sync batch")
		return fmt.Errorf("failed to process batch: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("batchId", payload.BatchID.String()).
		Str("status", string(result.Status)).
		Int("totalCount", result.TotalCount).
		Int("successCount", result.SuccessCount).
		Int("failedCount", result.FailedCount).
		Int("conflicts", len(result.Conflicts)).
		Dur("duration", time.Since(startTime)).
		Msg("Sync batch processed")

	// If there are failed transactions, consider enqueueing retry task
	if result.FailedCount > 0 && retryCount < 3 {
		log.Warn().
			Str("batchId", payload.BatchID.String()).
			Int("failedCount", result.FailedCount).
			Msg("Batch has failed transactions, may need retry")
	}

	return nil
}

// HandleRetrySyncBatch handles retrying a failed sync batch
func (w *SyncWorker) HandleRetrySyncBatch(ctx context.Context, task *asynq.Task) error {
	var payload RetrySyncBatchPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("batchId", payload.BatchID.String()).
		Int("retryCount", payload.RetryCount).
		Int("maxRetries", payload.MaxRetries).
		Int("failedTxCount", len(payload.FailedTxIDs)).
		Msg("Processing retry sync batch task")

	// Check if we've exceeded max retries
	if payload.RetryCount >= payload.MaxRetries {
		log.Warn().
			Str("batchId", payload.BatchID.String()).
			Int("retryCount", payload.RetryCount).
			Msg("Max retries exceeded for sync batch, moving to dead letter")
		return nil // Don't return error to prevent further retries
	}

	startTime := time.Now()

	// Get the batch
	batch, err := w.syncService.GetBatch(ctx, payload.BatchID)
	if err != nil {
		return fmt.Errorf("failed to get batch for retry: %w", err)
	}

	// Filter to only failed transactions if specified
	var txToRetry []sync.OfflineTransaction
	if len(payload.FailedTxIDs) > 0 {
		failedSet := make(map[string]bool)
		for _, id := range payload.FailedTxIDs {
			failedSet[id] = true
		}
		for _, tx := range batch.Transactions {
			if failedSet[tx.LocalID] {
				txToRetry = append(txToRetry, tx)
			}
		}
	} else {
		txToRetry = batch.Transactions
	}

	// Process the retry batch
	result, err := w.syncService.ProcessSyncBatch(ctx, sync.SubmitBatchRequest{
		DeviceID:     batch.DeviceID,
		FestivalID:   batch.FestivalID,
		Transactions: txToRetry,
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("batchId", payload.BatchID.String()).
			Int("retryCount", payload.RetryCount).
			Msg("Retry batch processing failed")
		return fmt.Errorf("retry batch failed: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("batchId", payload.BatchID.String()).
		Str("status", string(result.Status)).
		Int("successCount", result.SuccessCount).
		Int("failedCount", result.FailedCount).
		Dur("duration", time.Since(startTime)).
		Msg("Retry sync batch completed")

	return nil
}

// HandleProcessOfflineTransaction handles processing a single offline transaction
func (w *SyncWorker) HandleProcessOfflineTransaction(ctx context.Context, task *asynq.Task) error {
	var payload ProcessOfflineTransactionPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("localId", payload.LocalID).
		Str("batchId", payload.BatchID.String()).
		Str("walletId", payload.WalletID.String()).
		Str("type", payload.Type).
		Int64("amount", payload.Amount).
		Int("retry", retryCount).
		Msg("Processing single offline transaction")

	startTime := time.Now()

	// Convert to sync.OfflineTransaction
	offlineTx := sync.OfflineTransaction{
		LocalID:    payload.LocalID,
		WalletID:   payload.WalletID,
		Amount:     payload.Amount,
		Type:       sync.TransactionType(payload.Type),
		StandID:    payload.StandID,
		StaffID:    payload.StaffID,
		ProductIDs: payload.ProductIDs,
		Signature:  payload.Signature,
		Timestamp:  payload.Timestamp,
	}

	// Validate the signature
	if err := w.syncService.ValidateOfflineSignature(offlineTx); err != nil {
		log.Error().
			Err(err).
			Str("localId", payload.LocalID).
			Msg("Invalid offline transaction signature")
		return nil // Don't retry invalid signatures
	}

	// Check for duplicates
	isDupe, existingTxID := w.syncService.DetectDuplicates(ctx, offlineTx, payload.DeviceID)
	if isDupe && existingTxID != nil {
		log.Info().
			Str("localId", payload.LocalID).
			Str("existingTxId", existingTxID.String()).
			Msg("Duplicate transaction detected, skipping")
		return nil
	}

	// Process the transaction via the batch mechanism
	result, err := w.syncService.ProcessSyncBatch(ctx, sync.SubmitBatchRequest{
		DeviceID:     payload.DeviceID,
		FestivalID:   payload.FestivalID,
		Transactions: []sync.OfflineTransaction{offlineTx},
	})

	if err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("localId", payload.LocalID).
			Dur("duration", time.Since(startTime)).
			Msg("Failed to process offline transaction")
		return fmt.Errorf("failed to process transaction: %w", err)
	}

	if result.FailedCount > 0 {
		// Log the conflict reason
		if len(result.Conflicts) > 0 {
			log.Warn().
				Str("localId", payload.LocalID).
				Str("reason", result.Conflicts[0].Reason).
				Str("resolution", result.Conflicts[0].Resolution).
				Msg("Offline transaction failed with conflict")
		}

		// Check if it's a balance issue that might resolve with retry
		if isRetryableConflict(result.Conflicts) {
			return fmt.Errorf("transaction failed, may be retryable: %s", result.Conflicts[0].Reason)
		}

		// Non-retryable failure
		return nil
	}

	log.Info().
		Str("taskId", taskID).
		Str("localId", payload.LocalID).
		Str("serverTxId", result.Successes[0].ServerTxID.String()).
		Dur("duration", time.Since(startTime)).
		Msg("Offline transaction processed successfully")

	return nil
}

// HandleReconcileSyncData handles data reconciliation between offline and online state
func (w *SyncWorker) HandleReconcileSyncData(ctx context.Context, task *asynq.Task) error {
	var payload ReconcileSyncDataPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("festivalId", payload.FestivalID.String()).
		Str("deviceId", payload.DeviceID).
		Time("startDate", payload.StartDate).
		Time("endDate", payload.EndDate).
		Bool("dryRun", payload.DryRun).
		Msg("Processing sync data reconciliation task")

	startTime := time.Now()

	// Get pending batches for the device (if specified) or all pending batches
	var batches []sync.SyncBatch
	var err error

	if payload.DeviceID != "" {
		batches, err = w.syncService.GetPendingBatches(ctx, payload.DeviceID)
	}

	if err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Msg("Failed to get pending batches for reconciliation")
		return fmt.Errorf("failed to get pending batches: %w", err)
	}

	var reconciledCount int
	var failedCount int

	for _, batch := range batches {
		// Skip batches outside the date range
		if batch.CreatedAt.Before(payload.StartDate) || batch.CreatedAt.After(payload.EndDate) {
			continue
		}

		if payload.DryRun {
			log.Info().
				Str("batchId", batch.ID.String()).
				Int("txCount", len(batch.Transactions)).
				Msg("[DRY RUN] Would reconcile batch")
			reconciledCount++
			continue
		}

		// Process the batch
		result, err := w.syncService.ProcessSyncBatch(ctx, sync.SubmitBatchRequest{
			DeviceID:     batch.DeviceID,
			FestivalID:   batch.FestivalID,
			Transactions: batch.Transactions,
		})

		if err != nil {
			log.Warn().
				Err(err).
				Str("batchId", batch.ID.String()).
				Msg("Failed to reconcile batch")
			failedCount++
			continue
		}

		if result.SuccessCount > 0 {
			reconciledCount++
		}
		if result.FailedCount > 0 {
			failedCount++
		}
	}

	log.Info().
		Str("taskId", taskID).
		Int("batchesProcessed", len(batches)).
		Int("reconciledCount", reconciledCount).
		Int("failedCount", failedCount).
		Bool("dryRun", payload.DryRun).
		Dur("duration", time.Since(startTime)).
		Msg("Sync data reconciliation completed")

	return nil
}

// isRetryableConflict determines if a conflict might be resolved by retrying
func isRetryableConflict(conflicts []sync.SyncConflict) bool {
	if len(conflicts) == 0 {
		return false
	}

	// Balance issues might resolve if other transactions add funds
	retryableReasons := []string{
		"insufficient_balance",
		"temporary_error",
		"connection_error",
		"timeout",
	}

	for _, conflict := range conflicts {
		for _, reason := range retryableReasons {
			if containsIgnoreCase(conflict.Reason, reason) {
				return true
			}
		}
	}

	return false
}

// containsIgnoreCase checks if s contains substr (case-insensitive)
func containsIgnoreCase(s, substr string) bool {
	sLower := toLower(s)
	substrLower := toLower(substr)
	return contains(sLower, substrLower)
}

// toLower converts a string to lowercase (simple ASCII implementation)
func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			result[i] = c + 32
		} else {
			result[i] = c
		}
	}
	return string(result)
}

// SyncResult represents the result of a sync operation for dead letter handling
type SyncResult struct {
	TaskID       string     `json:"taskId"`
	BatchID      uuid.UUID  `json:"batchId"`
	DeviceID     string     `json:"deviceId"`
	Status       string     `json:"status"`
	TotalCount   int        `json:"totalCount"`
	SuccessCount int        `json:"successCount"`
	FailedCount  int        `json:"failedCount"`
	Conflicts    []string   `json:"conflicts,omitempty"`
	Duration     string     `json:"duration"`
	RetryCount   int        `json:"retryCount"`
	ProcessedAt  time.Time  `json:"processedAt"`
}
