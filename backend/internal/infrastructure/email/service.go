package email

import (
	"context"
	"fmt"

	"github.com/rs/zerolog/log"
)

// EmailProvider defines the interface for email providers
type EmailProvider interface {
	SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) (*SendEmailResult, error)
	SendEmailMultiple(ctx context.Context, to []string, subject, htmlBody, textBody string) (*SendEmailResult, error)
	SendEmailWithAttachments(ctx context.Context, req SendEmailRequest) (*SendEmailResult, error)
	HealthCheck(ctx context.Context) error
}

// EmailService provides email sending with fallback support
type EmailService struct {
	primary   EmailProvider
	fallback  EmailProvider
	useFallback bool
}

// EmailServiceConfig holds configuration for the email service
type EmailServiceConfig struct {
	// Postal configuration
	PostalURL    string
	PostalAPIKey string

	// SendGrid configuration
	SendGridAPIKey string

	// Common configuration
	FromEmail string
	FromName  string
}

// NewEmailService creates a new email service with Postal as primary and SendGrid as fallback
func NewEmailService(cfg EmailServiceConfig) (*EmailService, error) {
	var primary EmailProvider
	var fallback EmailProvider

	// Initialize Postal as primary if configured
	if cfg.PostalURL != "" && cfg.PostalAPIKey != "" {
		postal := NewPostalClient(PostalConfig{
			BaseURL:   cfg.PostalURL,
			APIKey:    cfg.PostalAPIKey,
			FromEmail: cfg.FromEmail,
			FromName:  cfg.FromName,
		})
		primary = postal
		log.Info().Str("provider", "postal").Msg("Postal configured as primary email provider")
	}

	// Initialize SendGrid as fallback if configured
	if cfg.SendGridAPIKey != "" {
		sendgrid := NewSendGridClient(SendGridConfig{
			APIKey:    cfg.SendGridAPIKey,
			FromEmail: cfg.FromEmail,
			FromName:  cfg.FromName,
		})
		fallback = sendgrid
		log.Info().Str("provider", "sendgrid").Msg("SendGrid configured as fallback email provider")
	}

	// If no primary is configured but we have a fallback, use fallback as primary
	if primary == nil && fallback != nil {
		primary = fallback
		fallback = nil
		log.Info().Msg("Using SendGrid as primary email provider (no Postal configured)")
	}

	if primary == nil {
		return nil, fmt.Errorf("no email provider configured")
	}

	return &EmailService{
		primary:  primary,
		fallback: fallback,
	}, nil
}

// SendEmail sends an email using the primary provider with fallback support
func (s *EmailService) SendEmail(ctx context.Context, to, subject, htmlBody, textBody string) (*SendEmailResult, error) {
	result, err := s.primary.SendEmail(ctx, to, subject, htmlBody, textBody)
	if err == nil {
		return result, nil
	}

	log.Error().
		Err(err).
		Str("to", to).
		Str("subject", subject).
		Str("provider", "primary").
		Msg("Primary email provider failed")

	// Try fallback if available
	if s.fallback != nil {
		log.Info().
			Str("to", to).
			Str("subject", subject).
			Msg("Attempting email send with fallback provider")

		fallbackResult, fallbackErr := s.fallback.SendEmail(ctx, to, subject, htmlBody, textBody)
		if fallbackErr == nil {
			log.Info().
				Str("to", to).
				Str("messageId", fallbackResult.MessageID).
				Str("provider", "fallback").
				Msg("Email sent successfully via fallback provider")
			return fallbackResult, nil
		}

		log.Error().
			Err(fallbackErr).
			Str("to", to).
			Str("subject", subject).
			Str("provider", "fallback").
			Msg("Fallback email provider also failed")

		return nil, fmt.Errorf("all email providers failed: primary=%v, fallback=%v", err, fallbackErr)
	}

	return result, err
}

// SendEmailMultiple sends an email to multiple recipients with fallback support
func (s *EmailService) SendEmailMultiple(ctx context.Context, to []string, subject, htmlBody, textBody string) (*SendEmailResult, error) {
	result, err := s.primary.SendEmailMultiple(ctx, to, subject, htmlBody, textBody)
	if err == nil {
		return result, nil
	}

	log.Error().
		Err(err).
		Strs("to", to).
		Str("subject", subject).
		Str("provider", "primary").
		Msg("Primary email provider failed for multiple recipients")

	// Try fallback if available
	if s.fallback != nil {
		log.Info().
			Strs("to", to).
			Str("subject", subject).
			Msg("Attempting email send to multiple recipients with fallback provider")

		fallbackResult, fallbackErr := s.fallback.SendEmailMultiple(ctx, to, subject, htmlBody, textBody)
		if fallbackErr == nil {
			log.Info().
				Strs("to", to).
				Str("messageId", fallbackResult.MessageID).
				Str("provider", "fallback").
				Msg("Email sent successfully to multiple recipients via fallback provider")
			return fallbackResult, nil
		}

		log.Error().
			Err(fallbackErr).
			Strs("to", to).
			Str("subject", subject).
			Str("provider", "fallback").
			Msg("Fallback email provider also failed for multiple recipients")

		return nil, fmt.Errorf("all email providers failed: primary=%v, fallback=%v", err, fallbackErr)
	}

	return result, err
}

// SendEmailWithAttachments sends an email with attachments using fallback support
func (s *EmailService) SendEmailWithAttachments(ctx context.Context, req SendEmailRequest) (*SendEmailResult, error) {
	result, err := s.primary.SendEmailWithAttachments(ctx, req)
	if err == nil {
		return result, nil
	}

	log.Error().
		Err(err).
		Strs("to", req.To).
		Str("subject", req.Subject).
		Str("provider", "primary").
		Msg("Primary email provider failed for email with attachments")

	// Try fallback if available
	if s.fallback != nil {
		log.Info().
			Strs("to", req.To).
			Str("subject", req.Subject).
			Msg("Attempting email with attachments send via fallback provider")

		fallbackResult, fallbackErr := s.fallback.SendEmailWithAttachments(ctx, req)
		if fallbackErr == nil {
			log.Info().
				Strs("to", req.To).
				Str("messageId", fallbackResult.MessageID).
				Str("provider", "fallback").
				Msg("Email with attachments sent successfully via fallback provider")
			return fallbackResult, nil
		}

		log.Error().
			Err(fallbackErr).
			Strs("to", req.To).
			Str("subject", req.Subject).
			Str("provider", "fallback").
			Msg("Fallback email provider also failed for email with attachments")

		return nil, fmt.Errorf("all email providers failed: primary=%v, fallback=%v", err, fallbackErr)
	}

	return result, err
}

// HealthCheck checks the health of all configured email providers
func (s *EmailService) HealthCheck(ctx context.Context) error {
	// Check primary
	if err := s.primary.HealthCheck(ctx); err != nil {
		log.Warn().Err(err).Str("provider", "primary").Msg("Primary email provider health check failed")

		// If primary fails but fallback is healthy, we can still operate
		if s.fallback != nil {
			if fallbackErr := s.fallback.HealthCheck(ctx); fallbackErr == nil {
				log.Info().Str("provider", "fallback").Msg("Fallback email provider is healthy")
				return nil
			} else {
				log.Error().Err(fallbackErr).Str("provider", "fallback").Msg("Fallback email provider health check also failed")
				return fmt.Errorf("all email providers unhealthy: primary=%v, fallback=%v", err, fallbackErr)
			}
		}
		return err
	}

	return nil
}

// GetPrimaryClient returns the primary email provider (for backwards compatibility)
// Deprecated: Use the EmailService methods directly
func (s *EmailService) GetPrimaryClient() EmailProvider {
	return s.primary
}

// HasFallback returns true if a fallback provider is configured
func (s *EmailService) HasFallback() bool {
	return s.fallback != nil
}
