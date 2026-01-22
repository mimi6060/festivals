package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"time"

	"github.com/hibiken/asynq"
	"github.com/mimi6060/festivals/backend/internal/config"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/queue"
	"github.com/rs/zerolog/log"
)

// EmailWorker handles email sending tasks
type EmailWorker struct {
	config     *config.Config
	httpClient *http.Client
	templates  *template.Template
}

// NewEmailWorker creates a new email worker
func NewEmailWorker(cfg *config.Config) *EmailWorker {
	return &EmailWorker{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		templates: loadEmailTemplates(),
	}
}

// RegisterHandlers registers all email task handlers
func (w *EmailWorker) RegisterHandlers(server *queue.Server) {
	server.HandleFunc(queue.TypeSendEmail, w.HandleSendEmail)
	server.HandleFunc(queue.TypeSendWelcomeEmail, w.HandleSendWelcomeEmail)
	server.HandleFunc(queue.TypeSendTicketEmail, w.HandleSendTicketEmail)
	server.HandleFunc(queue.TypeSendRefundNotification, w.HandleSendRefundNotification)
}

// HandleSendEmail handles generic email sending
func (w *EmailWorker) HandleSendEmail(ctx context.Context, task *asynq.Task) error {
	var payload SendEmailPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Info().
		Str("to", payload.To).
		Str("subject", payload.Subject).
		Str("template", payload.Template).
		Msg("Processing send email task")

	// Render email template
	htmlContent, err := w.renderTemplate(payload.Template, payload.TemplateData)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	// Send email via Postal API
	if err := w.sendEmail(ctx, payload.To, payload.Subject, htmlContent, payload.Attachments); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Info().
		Str("to", payload.To).
		Str("subject", payload.Subject).
		Msg("Email sent successfully")

	return nil
}

// HandleSendWelcomeEmail handles welcome email sending
func (w *EmailWorker) HandleSendWelcomeEmail(ctx context.Context, task *asynq.Task) error {
	var payload SendWelcomeEmailPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Info().
		Str("email", payload.Email).
		Str("name", payload.Name).
		Msg("Processing welcome email task")

	templateData := map[string]interface{}{
		"Name":         payload.Name,
		"FestivalName": payload.FestivalName,
		"Year":         time.Now().Year(),
	}

	subject := "Welcome to Festivals!"
	if payload.FestivalName != "" {
		subject = fmt.Sprintf("Welcome to %s!", payload.FestivalName)
	}

	htmlContent, err := w.renderTemplate("welcome", templateData)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	if err := w.sendEmail(ctx, payload.Email, subject, htmlContent, nil); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Info().
		Str("email", payload.Email).
		Str("userId", payload.UserID.String()).
		Msg("Welcome email sent successfully")

	return nil
}

// HandleSendTicketEmail handles ticket confirmation email sending
func (w *EmailWorker) HandleSendTicketEmail(ctx context.Context, task *asynq.Task) error {
	var payload SendTicketEmailPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Info().
		Str("email", payload.Email).
		Str("ticketId", payload.TicketID.String()).
		Str("festivalName", payload.FestivalName).
		Msg("Processing ticket email task")

	templateData := map[string]interface{}{
		"Name":         payload.Name,
		"FestivalName": payload.FestivalName,
		"TicketType":   payload.TicketType,
		"TicketCode":   payload.TicketCode,
		"QRCodeURL":    payload.QRCodeURL,
		"EventDate":    payload.EventDate.Format("Monday, January 2, 2006"),
		"Venue":        payload.Venue,
		"Year":         time.Now().Year(),
	}

	subject := fmt.Sprintf("Your Ticket for %s", payload.FestivalName)

	htmlContent, err := w.renderTemplate("ticket", templateData)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	// Include QR code as attachment if URL is available
	var attachments []EmailAttachment
	if payload.QRCodeURL != "" {
		attachments = append(attachments, EmailAttachment{
			Filename:    "ticket-qr.png",
			ContentType: "image/png",
			URL:         payload.QRCodeURL,
		})
	}

	if err := w.sendEmail(ctx, payload.Email, subject, htmlContent, attachments); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Info().
		Str("email", payload.Email).
		Str("ticketId", payload.TicketID.String()).
		Msg("Ticket email sent successfully")

	return nil
}

// HandleSendRefundNotification handles refund notification email sending
func (w *EmailWorker) HandleSendRefundNotification(ctx context.Context, task *asynq.Task) error {
	var payload SendRefundNotificationPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Info().
		Str("email", payload.Email).
		Str("refundId", payload.RefundID.String()).
		Int64("amount", payload.Amount).
		Msg("Processing refund notification task")

	// Format amount for display
	amountDisplay := fmt.Sprintf("%.2f %s", float64(payload.Amount)/100, payload.Currency)

	templateData := map[string]interface{}{
		"Name":          payload.Name,
		"FestivalName":  payload.FestivalName,
		"Amount":        amountDisplay,
		"Reason":        payload.Reason,
		"Status":        payload.Status,
		"ProcessedAt":   payload.ProcessedAt.Format("January 2, 2006 at 3:04 PM"),
		"TransactionID": payload.TransactionID.String(),
		"Year":          time.Now().Year(),
	}

	subject := fmt.Sprintf("Refund %s - %s", getRefundStatusText(payload.Status), payload.FestivalName)

	htmlContent, err := w.renderTemplate("refund_notification", templateData)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	if err := w.sendEmail(ctx, payload.Email, subject, htmlContent, nil); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Info().
		Str("email", payload.Email).
		Str("refundId", payload.RefundID.String()).
		Msg("Refund notification email sent successfully")

	return nil
}

// sendEmail sends an email via Postal API
func (w *EmailWorker) sendEmail(ctx context.Context, to, subject, htmlContent string, attachments []EmailAttachment) error {
	if w.config.PostalURL == "" || w.config.PostalAPIKey == "" {
		log.Warn().Msg("Postal not configured, skipping email send")
		return nil // Don't fail if email is not configured
	}

	// Prepare Postal API request
	requestBody := map[string]interface{}{
		"to":      []string{to},
		"subject": subject,
		"html":    htmlContent,
		"from":    "noreply@festivals.app",
	}

	if len(attachments) > 0 {
		requestBody["attachments"] = attachments
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", w.config.PostalURL+"/api/v1/send/message", bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Server-API-Key", w.config.PostalAPIKey)

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("postal API returned status %d", resp.StatusCode)
	}

	return nil
}

// renderTemplate renders an email template with the given data
func (w *EmailWorker) renderTemplate(templateName string, data map[string]interface{}) (string, error) {
	if w.templates == nil {
		// If templates are not loaded, use a simple fallback
		return renderFallbackTemplate(templateName, data)
	}

	var buf bytes.Buffer
	if err := w.templates.ExecuteTemplate(&buf, templateName+".html", data); err != nil {
		// Try fallback if template not found
		return renderFallbackTemplate(templateName, data)
	}

	return buf.String(), nil
}

// loadEmailTemplates loads email templates from embedded files or filesystem
func loadEmailTemplates() *template.Template {
	// In production, you would load templates from files or embedded resources
	// For now, return nil to use fallback templates
	return nil
}

// renderFallbackTemplate renders a simple fallback template
func renderFallbackTemplate(templateName string, data map[string]interface{}) (string, error) {
	templates := map[string]string{
		"welcome": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome!</h1>
        </div>
        <div class="content">
            <p>Hi {{.Name}},</p>
            <p>Welcome to {{if .FestivalName}}{{.FestivalName}}{{else}}Festivals{{end}}! We're excited to have you on board.</p>
            <p>Get ready for an amazing experience!</p>
        </div>
        <div class="footer">
            <p>&copy; {{.Year}} Festivals. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
		"ticket": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; }
        .ticket-info { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .ticket-code { font-size: 24px; font-weight: bold; text-align: center; color: #6366f1; padding: 10px; background: #eef2ff; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Ticket is Ready!</h1>
        </div>
        <div class="content">
            <p>Hi {{.Name}},</p>
            <p>Here's your ticket for <strong>{{.FestivalName}}</strong>!</p>
            <div class="ticket-info">
                <p><strong>Ticket Type:</strong> {{.TicketType}}</p>
                <p><strong>Event Date:</strong> {{.EventDate}}</p>
                {{if .Venue}}<p><strong>Venue:</strong> {{.Venue}}</p>{{end}}
                <div class="ticket-code">{{.TicketCode}}</div>
            </div>
            <p>Please show this QR code at the entrance. You can also find your ticket in the app.</p>
        </div>
        <div class="footer">
            <p>&copy; {{.Year}} Festivals. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
		"refund_notification": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; }
        .refund-info { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .amount { font-size: 24px; font-weight: bold; color: #10b981; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Refund Update</h1>
        </div>
        <div class="content">
            <p>Hi {{.Name}},</p>
            <p>Your refund for <strong>{{.FestivalName}}</strong> has been {{.Status}}.</p>
            <div class="refund-info">
                <p class="amount">{{.Amount}}</p>
                {{if .Reason}}<p><strong>Reason:</strong> {{.Reason}}</p>{{end}}
                <p><strong>Processed:</strong> {{.ProcessedAt}}</p>
                <p><strong>Reference:</strong> {{.TransactionID}}</p>
            </div>
            <p>The amount will be credited to your original payment method within 5-10 business days.</p>
        </div>
        <div class="footer">
            <p>&copy; {{.Year}} Festivals. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
	}

	tmplStr, ok := templates[templateName]
	if !ok {
		return "", fmt.Errorf("template %s not found", templateName)
	}

	tmpl, err := template.New(templateName).Parse(tmplStr)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// getRefundStatusText returns a human-readable refund status
func getRefundStatusText(status string) string {
	switch status {
	case "processed":
		return "Processed"
	case "failed":
		return "Failed"
	default:
		return "Update"
	}
}
