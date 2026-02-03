package qrcode

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewGenerator(t *testing.T) {
	cfg := Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
		QRSize:    256,
	}

	gen := NewGenerator(cfg)

	assert.NotNil(t, gen)
	assert.Equal(t, 256, gen.qrSize)
}

func TestNewGenerator_DefaultSize(t *testing.T) {
	cfg := Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	}

	gen := NewGenerator(cfg)

	assert.Equal(t, 256, gen.qrSize)
}

func TestGenerateTicketQR(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
		QRSize:    128,
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "TEST-TICKET-123"
	validUntil := time.Now().Add(24 * time.Hour)

	qrPNG, err := gen.GenerateTicketQR(ticketID, userID, festivalID, ticketCode, validUntil)

	require.NoError(t, err)
	assert.NotNil(t, qrPNG)
	assert.Greater(t, len(qrPNG), 0)

	// Check PNG header (magic bytes)
	assert.Equal(t, byte(0x89), qrPNG[0], "PNG should start with magic byte 0x89")
	assert.Equal(t, byte('P'), qrPNG[1])
	assert.Equal(t, byte('N'), qrPNG[2])
	assert.Equal(t, byte('G'), qrPNG[3])
}

func TestGenerateQRDataOnly(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "TEST-TICKET-456"
	validUntil := time.Now().Add(24 * time.Hour)

	qrData, err := gen.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)

	require.NoError(t, err)
	assert.NotEmpty(t, qrData)
}

func TestVerifyAndDecodePayload(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "TEST-TICKET-789"
	validUntil := time.Now().Add(24 * time.Hour)

	// Generate QR data
	qrData, err := gen.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)
	require.NoError(t, err)

	// Verify and decode
	payload, err := gen.VerifyAndDecodePayload(qrData)

	require.NoError(t, err)
	assert.Equal(t, ticketID, payload.TicketID)
	assert.Equal(t, userID, payload.UserID)
	assert.Equal(t, festivalID, payload.FestivalID)
	assert.Equal(t, ticketCode, payload.TicketCode)
	assert.NotEmpty(t, payload.Signature)
}

func TestVerifyAndDecodePayload_InvalidSignature(t *testing.T) {
	gen1 := NewGenerator(Config{
		SecretKey: "secret-key-1",
	})
	gen2 := NewGenerator(Config{
		SecretKey: "secret-key-2",
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "TEST-TICKET-999"
	validUntil := time.Now().Add(24 * time.Hour)

	// Generate with first key
	qrData, err := gen1.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)
	require.NoError(t, err)

	// Try to verify with second key - should fail
	payload, err := gen2.VerifyAndDecodePayload(qrData)

	assert.Error(t, err)
	assert.Nil(t, payload)
	assert.Contains(t, err.Error(), "invalid signature")
}

func TestVerifyAndDecodePayload_Expired(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "EXPIRED-TICKET"
	validUntil := time.Now().Add(-1 * time.Hour) // Already expired

	// Generate QR data with past expiration
	qrData, err := gen.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)
	require.NoError(t, err)

	// Verify - should fail due to expiration
	payload, err := gen.VerifyAndDecodePayload(qrData)

	assert.Error(t, err)
	assert.Nil(t, payload)
	assert.Contains(t, err.Error(), "expired")
}

func TestGenerateTicketQRWithFestivalKey(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "main-secret-key",
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "FESTIVAL-TICKET-123"
	validUntil := time.Now().Add(24 * time.Hour)
	festivalKey := "festival-specific-secret"

	qrPNG, err := gen.GenerateTicketQRWithFestivalKey(
		ticketID, userID, festivalID, ticketCode, validUntil, festivalKey,
	)

	require.NoError(t, err)
	assert.NotNil(t, qrPNG)
	assert.Greater(t, len(qrPNG), 0)
}

func TestGetPayloadFromQRData(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "DATA-TICKET-123"
	validUntil := time.Now().Add(24 * time.Hour)

	qrData, err := gen.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)
	require.NoError(t, err)

	// Get payload without verification
	payload, err := gen.GetPayloadFromQRData(qrData)

	require.NoError(t, err)
	assert.Equal(t, ticketID, payload.TicketID)
	assert.Equal(t, ticketCode, payload.TicketCode)
}

func TestGenerateQRFromData(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
		QRSize:    128,
	})

	ticketID := uuid.New()
	userID := uuid.New()
	festivalID := uuid.New()
	ticketCode := "REGEN-TICKET-123"
	validUntil := time.Now().Add(24 * time.Hour)

	// First generate data
	qrData, err := gen.GenerateQRDataOnly(ticketID, userID, festivalID, ticketCode, validUntil)
	require.NoError(t, err)

	// Then generate image from data
	qrPNG, err := gen.GenerateQRFromData(qrData)

	require.NoError(t, err)
	assert.NotNil(t, qrPNG)
	// Check PNG header
	assert.Equal(t, byte(0x89), qrPNG[0])
}

func TestVerifyAndDecodePayload_InvalidBase64(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	payload, err := gen.VerifyAndDecodePayload("not-valid-base64!!!")

	assert.Error(t, err)
	assert.Nil(t, payload)
}

func TestVerifyAndDecodePayload_InvalidJSON(t *testing.T) {
	gen := NewGenerator(Config{
		SecretKey: "TEST_ONLY_not_for_production_use_32chars_min",
	})

	// Valid base64 but invalid JSON
	invalidData := "dGhpcyBpcyBub3QganNvbg==" // "this is not json"

	payload, err := gen.VerifyAndDecodePayload(invalidData)

	assert.Error(t, err)
	assert.Nil(t, payload)
}
