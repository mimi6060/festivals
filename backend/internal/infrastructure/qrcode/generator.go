package qrcode

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	qr "github.com/skip2/go-qrcode"
)

// Generator handles QR code generation with HMAC signing
type Generator struct {
	secretKey []byte
	qrSize    int
}

// Config holds configuration for the QR code generator
type Config struct {
	SecretKey string // HMAC secret key for signing payloads
	QRSize    int    // Size of the QR code in pixels (default 256)
}

// Payload represents the signed data encoded in the QR code
type Payload struct {
	TicketID   uuid.UUID `json:"tid"`  // Ticket ID
	UserID     uuid.UUID `json:"uid"`  // User ID (can be nil UUID)
	FestivalID uuid.UUID `json:"fid"`  // Festival ID
	TicketCode string    `json:"code"` // Unique ticket code
	IssuedAt   int64     `json:"iat"`  // Timestamp when QR was generated
	ExpiresAt  int64     `json:"exp"`  // Expiration timestamp
	Signature  string    `json:"sig"`  // HMAC signature
}

// NewGenerator creates a new QR code generator
func NewGenerator(cfg Config) *Generator {
	size := cfg.QRSize
	if size == 0 {
		size = 256
	}

	return &Generator{
		secretKey: []byte(cfg.SecretKey),
		qrSize:    size,
	}
}

// GenerateTicketQR generates a QR code for a ticket with signed payload
func (g *Generator) GenerateTicketQR(ticketID, userID, festivalID uuid.UUID, ticketCode string, validUntil time.Time) ([]byte, error) {
	now := time.Now().Unix()

	// Create payload (without signature first)
	payload := Payload{
		TicketID:   ticketID,
		UserID:     userID,
		FestivalID: festivalID,
		TicketCode: ticketCode,
		IssuedAt:   now,
		ExpiresAt:  validUntil.Unix(),
	}

	// Generate signature
	signature, err := g.signPayload(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to sign payload: %w", err)
	}
	payload.Signature = signature

	// Serialize payload to JSON
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Encode to base64 for compact QR code
	encodedPayload := base64.URLEncoding.EncodeToString(payloadJSON)

	// Generate QR code PNG
	png, err := qr.Encode(encodedPayload, qr.Medium, g.qrSize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	return png, nil
}

// GenerateTicketQRWithFestivalKey generates a QR code using a festival-specific secret key
func (g *Generator) GenerateTicketQRWithFestivalKey(ticketID, userID, festivalID uuid.UUID, ticketCode string, validUntil time.Time, festivalSecretKey string) ([]byte, error) {
	// Derive a festival-specific key by combining the main secret with festival key
	combinedKey := g.deriveKey(festivalSecretKey)

	now := time.Now().Unix()

	// Create payload
	payload := Payload{
		TicketID:   ticketID,
		UserID:     userID,
		FestivalID: festivalID,
		TicketCode: ticketCode,
		IssuedAt:   now,
		ExpiresAt:  validUntil.Unix(),
	}

	// Generate signature with combined key
	signature, err := g.signPayloadWithKey(payload, combinedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign payload: %w", err)
	}
	payload.Signature = signature

	// Serialize payload
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Encode to base64
	encodedPayload := base64.URLEncoding.EncodeToString(payloadJSON)

	// Generate QR code
	png, err := qr.Encode(encodedPayload, qr.Medium, g.qrSize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	return png, nil
}

// VerifyAndDecodePayload verifies and decodes a QR code payload
func (g *Generator) VerifyAndDecodePayload(encodedPayload string) (*Payload, error) {
	// Decode base64
	payloadJSON, err := base64.URLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}

	// Parse JSON
	var payload Payload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// Store and clear signature for verification
	receivedSignature := payload.Signature
	payload.Signature = ""

	// Verify signature
	expectedSignature, err := g.signPayload(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to generate expected signature: %w", err)
	}

	if !hmac.Equal([]byte(receivedSignature), []byte(expectedSignature)) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Restore signature
	payload.Signature = receivedSignature

	// Check expiration
	if time.Now().Unix() > payload.ExpiresAt {
		return nil, fmt.Errorf("QR code has expired")
	}

	return &payload, nil
}

// VerifyAndDecodePayloadWithFestivalKey verifies a payload using a festival-specific key
func (g *Generator) VerifyAndDecodePayloadWithFestivalKey(encodedPayload string, festivalSecretKey string) (*Payload, error) {
	combinedKey := g.deriveKey(festivalSecretKey)

	// Decode base64
	payloadJSON, err := base64.URLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}

	// Parse JSON
	var payload Payload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// Store and clear signature for verification
	receivedSignature := payload.Signature
	payload.Signature = ""

	// Verify signature with combined key
	expectedSignature, err := g.signPayloadWithKey(payload, combinedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to generate expected signature: %w", err)
	}

	if !hmac.Equal([]byte(receivedSignature), []byte(expectedSignature)) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Restore signature
	payload.Signature = receivedSignature

	// Check expiration
	if time.Now().Unix() > payload.ExpiresAt {
		return nil, fmt.Errorf("QR code has expired")
	}

	return &payload, nil
}

// signPayload creates an HMAC signature for the payload
func (g *Generator) signPayload(payload Payload) (string, error) {
	return g.signPayloadWithKey(payload, g.secretKey)
}

// signPayloadWithKey creates an HMAC signature using a specific key
func (g *Generator) signPayloadWithKey(payload Payload, key []byte) (string, error) {
	// Create canonical representation (without signature)
	dataToSign := fmt.Sprintf("%s:%s:%s:%s:%d:%d",
		payload.TicketID.String(),
		payload.UserID.String(),
		payload.FestivalID.String(),
		payload.TicketCode,
		payload.IssuedAt,
		payload.ExpiresAt,
	)

	// Generate HMAC-SHA256
	h := hmac.New(sha256.New, key)
	h.Write([]byte(dataToSign))
	signature := hex.EncodeToString(h.Sum(nil))

	return signature, nil
}

// deriveKey derives a festival-specific key from the main secret and festival key
func (g *Generator) deriveKey(festivalKey string) []byte {
	h := hmac.New(sha256.New, g.secretKey)
	h.Write([]byte(festivalKey))
	return h.Sum(nil)
}

// GetPayloadFromQRData extracts and returns the payload from encoded QR data (without verification)
// Use this only for reading data, not for validation
func (g *Generator) GetPayloadFromQRData(encodedPayload string) (*Payload, error) {
	// Decode base64
	payloadJSON, err := base64.URLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}

	// Parse JSON
	var payload Payload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	return &payload, nil
}

// GenerateQRDataOnly generates the encoded QR payload string without creating the image
// Useful for storing the data for later QR generation
func (g *Generator) GenerateQRDataOnly(ticketID, userID, festivalID uuid.UUID, ticketCode string, validUntil time.Time) (string, error) {
	now := time.Now().Unix()

	payload := Payload{
		TicketID:   ticketID,
		UserID:     userID,
		FestivalID: festivalID,
		TicketCode: ticketCode,
		IssuedAt:   now,
		ExpiresAt:  validUntil.Unix(),
	}

	signature, err := g.signPayload(payload)
	if err != nil {
		return "", fmt.Errorf("failed to sign payload: %w", err)
	}
	payload.Signature = signature

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	return base64.URLEncoding.EncodeToString(payloadJSON), nil
}

// GenerateQRFromData generates a QR code image from an already-encoded payload string
func (g *Generator) GenerateQRFromData(encodedPayload string) ([]byte, error) {
	png, err := qr.Encode(encodedPayload, qr.Medium, g.qrSize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}
	return png, nil
}
