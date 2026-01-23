package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/domain/reports"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/rs/zerolog/log"
)

// ReportWorker handles report generation tasks
type ReportWorker struct {
	reportsService *reports.Service
}

// NewReportWorker creates a new report worker
func NewReportWorker(reportsService *reports.Service) *ReportWorker {
	return &ReportWorker{
		reportsService: reportsService,
	}
}

// RegisterHandlers registers all report task handlers
func (w *ReportWorker) RegisterHandlers(server *queue.Server) {
	server.HandleFunc(queue.TypeGenerateReport, w.HandleGenerateReport)
	server.HandleFunc(queue.TypeGenerateSalesReport, w.HandleGenerateSalesReport)
	server.HandleFunc(queue.TypeGenerateAttendanceReport, w.HandleGenerateAttendanceReport)
	server.HandleFunc(queue.TypeGeneratePDFReport, w.HandleGeneratePDFReport)
}

// HandleGenerateReport handles generic report generation
func (w *ReportWorker) HandleGenerateReport(ctx context.Context, task *asynq.Task) error {
	var payload GenerateReportPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)
	retryCount, _ := asynq.GetRetryCount(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Str("type", string(payload.Type)).
		Str("format", string(payload.Format)).
		Int("retry", retryCount).
		Msg("Processing report generation task")

	startTime := time.Now()

	// Generate the report using the reports service
	if err := w.reportsService.GenerateReport(ctx, payload.ReportID); err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("reportId", payload.ReportID.String()).
			Dur("duration", time.Since(startTime)).
			Msg("Failed to generate report")

		// Send failure notification if email is provided
		if payload.NotifyEmail != "" {
			w.sendReportFailureNotification(ctx, payload.ReportID, payload.NotifyEmail, err.Error())
		}

		return fmt.Errorf("failed to generate report: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Dur("duration", time.Since(startTime)).
		Msg("Report generated successfully")

	// Send completion notification if webhook URL is provided
	if payload.WebhookURL != "" {
		w.sendWebhookNotification(ctx, payload.WebhookURL, payload.ReportID, "completed")
	}

	// Send email notification if email is provided
	if payload.NotifyEmail != "" {
		w.sendReportCompletionNotification(ctx, payload.ReportID, payload.NotifyEmail)
	}

	return nil
}

// HandleGenerateSalesReport handles sales report generation
func (w *ReportWorker) HandleGenerateSalesReport(ctx context.Context, task *asynq.Task) error {
	var payload GenerateSalesReportPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Str("festivalId", payload.FestivalID.String()).
		Time("startDate", payload.StartDate).
		Time("endDate", payload.EndDate).
		Msg("Processing sales report task")

	startTime := time.Now()

	// Generate the report
	if err := w.reportsService.GenerateReport(ctx, payload.ReportID); err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("reportId", payload.ReportID.String()).
			Dur("duration", time.Since(startTime)).
			Msg("Failed to generate sales report")

		return fmt.Errorf("failed to generate sales report: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Dur("duration", time.Since(startTime)).
		Msg("Sales report generated successfully")

	// Send email notification if provided
	if payload.NotifyEmail != "" {
		w.sendReportCompletionNotification(ctx, payload.ReportID, payload.NotifyEmail)
	}

	return nil
}

// HandleGenerateAttendanceReport handles attendance report generation
func (w *ReportWorker) HandleGenerateAttendanceReport(ctx context.Context, task *asynq.Task) error {
	var payload GenerateAttendanceReportPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Str("festivalId", payload.FestivalID.String()).
		Time("startDate", payload.StartDate).
		Time("endDate", payload.EndDate).
		Bool("includeExits", payload.IncludeExits).
		Msg("Processing attendance report task")

	startTime := time.Now()

	// Generate the report
	if err := w.reportsService.GenerateReport(ctx, payload.ReportID); err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("reportId", payload.ReportID.String()).
			Dur("duration", time.Since(startTime)).
			Msg("Failed to generate attendance report")

		return fmt.Errorf("failed to generate attendance report: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Dur("duration", time.Since(startTime)).
		Msg("Attendance report generated successfully")

	// Send email notification if provided
	if payload.NotifyEmail != "" {
		w.sendReportCompletionNotification(ctx, payload.ReportID, payload.NotifyEmail)
	}

	return nil
}

// HandleGeneratePDFReport handles PDF-specific report generation
func (w *ReportWorker) HandleGeneratePDFReport(ctx context.Context, task *asynq.Task) error {
	var payload GenerateReportPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	taskID, _ := asynq.GetTaskID(ctx)

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Str("type", string(payload.Type)).
		Msg("Processing PDF report task")

	// Ensure format is PDF
	if payload.Format != ReportFormatPDF {
		payload.Format = ReportFormatPDF
	}

	startTime := time.Now()

	// Generate the PDF report
	if err := w.reportsService.GenerateReport(ctx, payload.ReportID); err != nil {
		log.Error().
			Err(err).
			Str("taskId", taskID).
			Str("reportId", payload.ReportID.String()).
			Dur("duration", time.Since(startTime)).
			Msg("Failed to generate PDF report")

		return fmt.Errorf("failed to generate PDF report: %w", err)
	}

	log.Info().
		Str("taskId", taskID).
		Str("reportId", payload.ReportID.String()).
		Dur("duration", time.Since(startTime)).
		Msg("PDF report generated successfully")

	return nil
}

// sendReportCompletionNotification sends an email notification when a report is completed
func (w *ReportWorker) sendReportCompletionNotification(ctx context.Context, reportID uuid.UUID, email string) {
	log.Info().
		Str("reportId", reportID.String()).
		Str("email", email).
		Msg("Sending report completion notification")

	// In a real implementation, this would enqueue an email task
	// For now, we just log the intention
}

// sendReportFailureNotification sends an email notification when a report fails
func (w *ReportWorker) sendReportFailureNotification(ctx context.Context, reportID uuid.UUID, email, errorMsg string) {
	log.Warn().
		Str("reportId", reportID.String()).
		Str("email", email).
		Str("error", errorMsg).
		Msg("Sending report failure notification")

	// In a real implementation, this would enqueue an email task
}

// sendWebhookNotification sends a webhook notification for report status
func (w *ReportWorker) sendWebhookNotification(ctx context.Context, webhookURL string, reportID uuid.UUID, status string) {
	log.Info().
		Str("reportId", reportID.String()).
		Str("webhookUrl", webhookURL).
		Str("status", status).
		Msg("Sending webhook notification")

	// In a real implementation, this would make an HTTP POST request to the webhook URL
}

// ReportResult represents the result of a report generation for dead letter handling
type ReportResult struct {
	TaskID      string     `json:"taskId"`
	ReportID    uuid.UUID  `json:"reportId"`
	Type        string     `json:"type"`
	Format      string     `json:"format"`
	Status      string     `json:"status"`
	Error       string     `json:"error,omitempty"`
	FilePath    string     `json:"filePath,omitempty"`
	FileSize    int64      `json:"fileSize,omitempty"`
	RowCount    int        `json:"rowCount,omitempty"`
	Duration    string     `json:"duration"`
	RetryCount  int        `json:"retryCount"`
	ProcessedAt time.Time  `json:"processedAt"`
}
