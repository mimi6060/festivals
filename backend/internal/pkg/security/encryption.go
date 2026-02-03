package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/chacha20poly1305"
)

var (
	// ErrInvalidKey indicates the encryption key is invalid
	ErrInvalidKey = errors.New("invalid encryption key")
	// ErrInvalidData indicates the encrypted data is invalid
	ErrInvalidData = errors.New("invalid encrypted data")
	// ErrDecryptionFailed indicates decryption failed
	ErrDecryptionFailed = errors.New("decryption failed")
	// ErrKeyRotationInProgress indicates key rotation is in progress
	ErrKeyRotationInProgress = errors.New("key rotation in progress")
	// ErrInvalidArgon2Params indicates Argon2 parameters are out of safe range
	ErrInvalidArgon2Params = errors.New("invalid Argon2 parameters")
)

// Argon2 parameter constraints (OWASP recommendations)
const (
	// Minimum values
	Argon2MinTime    uint32 = 1
	Argon2MinMemory  uint32 = 19 * 1024   // 19 MB minimum (OWASP minimum for Argon2id)
	Argon2MinThreads uint8  = 1
	Argon2MinKeyLen  uint32 = 16

	// Maximum values (prevent DoS via excessive resource consumption)
	Argon2MaxTime    uint32 = 10
	Argon2MaxMemory  uint32 = 1024 * 1024 // 1 GB maximum
	Argon2MaxThreads uint8  = 16
	Argon2MaxKeyLen  uint32 = 64
)

// EncryptionConfig holds encryption configuration
type EncryptionConfig struct {
	// Primary encryption key (32 bytes for AES-256)
	PrimaryKey []byte
	// Secondary key for key rotation
	SecondaryKey []byte
	// Algorithm to use
	Algorithm EncryptionAlgorithm
	// Key derivation parameters
	Argon2Time    uint32
	Argon2Memory  uint32
	Argon2Threads uint8
	Argon2KeyLen  uint32
}

// EncryptionAlgorithm defines supported encryption algorithms
type EncryptionAlgorithm string

const (
	AlgorithmAESGCM      EncryptionAlgorithm = "AES-256-GCM"
	AlgorithmChaCha20    EncryptionAlgorithm = "ChaCha20-Poly1305"
)

// Encryptor handles data encryption and decryption
type Encryptor struct {
	config          EncryptionConfig
	primaryCipher   cipher.AEAD
	secondaryCipher cipher.AEAD
	mu              sync.RWMutex
	keyVersion      int
}

// ValidateArgon2Params validates Argon2 parameters are within safe ranges
func ValidateArgon2Params(time, memory uint32, threads uint8, keyLen uint32) error {
	if time < Argon2MinTime || time > Argon2MaxTime {
		return fmt.Errorf("%w: time must be between %d and %d, got %d",
			ErrInvalidArgon2Params, Argon2MinTime, Argon2MaxTime, time)
	}
	if memory < Argon2MinMemory || memory > Argon2MaxMemory {
		return fmt.Errorf("%w: memory must be between %d KB and %d KB, got %d KB",
			ErrInvalidArgon2Params, Argon2MinMemory, Argon2MaxMemory, memory)
	}
	if threads < Argon2MinThreads || threads > Argon2MaxThreads {
		return fmt.Errorf("%w: threads must be between %d and %d, got %d",
			ErrInvalidArgon2Params, Argon2MinThreads, Argon2MaxThreads, threads)
	}
	if keyLen < Argon2MinKeyLen || keyLen > Argon2MaxKeyLen {
		return fmt.Errorf("%w: keyLen must be between %d and %d, got %d",
			ErrInvalidArgon2Params, Argon2MinKeyLen, Argon2MaxKeyLen, keyLen)
	}
	return nil
}

// NewEncryptor creates a new encryptor with the given configuration
func NewEncryptor(cfg EncryptionConfig) (*Encryptor, error) {
	if len(cfg.PrimaryKey) != 32 {
		return nil, fmt.Errorf("%w: key must be 32 bytes", ErrInvalidKey)
	}

	if cfg.Algorithm == "" {
		cfg.Algorithm = AlgorithmAESGCM
	}

	// Set default Argon2 parameters
	if cfg.Argon2Time == 0 {
		cfg.Argon2Time = 3
	}
	if cfg.Argon2Memory == 0 {
		cfg.Argon2Memory = 64 * 1024 // 64MB
	}
	if cfg.Argon2Threads == 0 {
		cfg.Argon2Threads = 4
	}
	if cfg.Argon2KeyLen == 0 {
		cfg.Argon2KeyLen = 32
	}

	// Validate Argon2 parameters
	if err := ValidateArgon2Params(cfg.Argon2Time, cfg.Argon2Memory, cfg.Argon2Threads, cfg.Argon2KeyLen); err != nil {
		return nil, err
	}

	enc := &Encryptor{
		config:     cfg,
		keyVersion: 1,
	}

	// Initialize primary cipher
	primaryCipher, err := createCipher(cfg.PrimaryKey, cfg.Algorithm)
	if err != nil {
		return nil, fmt.Errorf("failed to create primary cipher: %w", err)
	}
	enc.primaryCipher = primaryCipher

	// Initialize secondary cipher if key is provided
	if len(cfg.SecondaryKey) == 32 {
		secondaryCipher, err := createCipher(cfg.SecondaryKey, cfg.Algorithm)
		if err != nil {
			return nil, fmt.Errorf("failed to create secondary cipher: %w", err)
		}
		enc.secondaryCipher = secondaryCipher
	}

	return enc, nil
}

// createCipher creates an AEAD cipher based on the algorithm
func createCipher(key []byte, algorithm EncryptionAlgorithm) (cipher.AEAD, error) {
	switch algorithm {
	case AlgorithmChaCha20:
		return chacha20poly1305.NewX(key)
	case AlgorithmAESGCM:
		fallthrough
	default:
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, err
		}
		return cipher.NewGCM(block)
	}
}

// Encrypt encrypts plaintext data
func (e *Encryptor) Encrypt(plaintext []byte) (string, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(plaintext) == 0 {
		return "", nil
	}

	// Generate nonce
	nonce := make([]byte, e.primaryCipher.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt
	ciphertext := e.primaryCipher.Seal(nil, nonce, plaintext, nil)

	// Combine version + nonce + ciphertext
	result := make([]byte, 1+len(nonce)+len(ciphertext))
	result[0] = byte(e.keyVersion)
	copy(result[1:], nonce)
	copy(result[1+len(nonce):], ciphertext)

	return base64.StdEncoding.EncodeToString(result), nil
}

// EncryptString encrypts a string
func (e *Encryptor) EncryptString(plaintext string) (string, error) {
	return e.Encrypt([]byte(plaintext))
}

// Decrypt decrypts ciphertext data
func (e *Encryptor) Decrypt(ciphertext string) ([]byte, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if ciphertext == "" {
		return nil, nil
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidData, err)
	}

	if len(data) < 2 {
		return nil, ErrInvalidData
	}

	// Extract version
	version := int(data[0])

	// Select cipher based on version
	var ciph cipher.AEAD
	switch version {
	case e.keyVersion:
		ciph = e.primaryCipher
	case e.keyVersion - 1:
		if e.secondaryCipher == nil {
			return nil, fmt.Errorf("%w: old key version but no secondary key", ErrDecryptionFailed)
		}
		ciph = e.secondaryCipher
	default:
		return nil, fmt.Errorf("%w: unknown key version %d", ErrDecryptionFailed, version)
	}

	nonceSize := ciph.NonceSize()
	if len(data) < 1+nonceSize {
		return nil, ErrInvalidData
	}

	nonce := data[1 : 1+nonceSize]
	encryptedData := data[1+nonceSize:]

	// Decrypt
	plaintext, err := ciph.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrDecryptionFailed, err)
	}

	return plaintext, nil
}

// DecryptString decrypts ciphertext to a string
func (e *Encryptor) DecryptString(ciphertext string) (string, error) {
	plaintext, err := e.Decrypt(ciphertext)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// RotateKey rotates to a new encryption key
func (e *Encryptor) RotateKey(newKey []byte) error {
	if len(newKey) != 32 {
		return fmt.Errorf("%w: key must be 32 bytes", ErrInvalidKey)
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	// Create new cipher
	newCipher, err := createCipher(newKey, e.config.Algorithm)
	if err != nil {
		return fmt.Errorf("failed to create new cipher: %w", err)
	}

	// Rotate keys
	e.config.SecondaryKey = e.config.PrimaryKey
	e.config.PrimaryKey = newKey
	e.secondaryCipher = e.primaryCipher
	e.primaryCipher = newCipher
	e.keyVersion++

	return nil
}

// ReEncrypt re-encrypts data with the current primary key
func (e *Encryptor) ReEncrypt(ciphertext string) (string, error) {
	plaintext, err := e.Decrypt(ciphertext)
	if err != nil {
		return "", err
	}
	return e.Encrypt(plaintext)
}

// FieldEncryptor handles encryption of specific fields in structs
type FieldEncryptor struct {
	encryptor      *Encryptor
	encryptedFields map[string]bool
}

// NewFieldEncryptor creates a new field encryptor
func NewFieldEncryptor(enc *Encryptor, fields ...string) *FieldEncryptor {
	fe := &FieldEncryptor{
		encryptor:      enc,
		encryptedFields: make(map[string]bool),
	}
	for _, field := range fields {
		fe.encryptedFields[field] = true
	}
	return fe
}

// ShouldEncrypt checks if a field should be encrypted
func (fe *FieldEncryptor) ShouldEncrypt(fieldName string) bool {
	return fe.encryptedFields[fieldName]
}

// EncryptField encrypts a field value
func (fe *FieldEncryptor) EncryptField(value string) (string, error) {
	return fe.encryptor.EncryptString(value)
}

// DecryptField decrypts a field value
func (fe *FieldEncryptor) DecryptField(value string) (string, error) {
	return fe.encryptor.DecryptString(value)
}

// ============================================================================
// Password Hashing
// ============================================================================

// PasswordHasher handles secure password hashing
type PasswordHasher struct {
	// Argon2 parameters
	Time    uint32
	Memory  uint32
	Threads uint8
	KeyLen  uint32
	SaltLen uint32
	// Bcrypt cost (used for backward compatibility)
	BcryptCost int
}

// DefaultPasswordHasher returns a hasher with secure defaults
func DefaultPasswordHasher() *PasswordHasher {
	return &PasswordHasher{
		Time:       3,
		Memory:     64 * 1024, // 64MB
		Threads:    4,
		KeyLen:     32,
		SaltLen:    16,
		BcryptCost: 12,
	}
}

// HashPassword hashes a password using Argon2id
func (h *PasswordHasher) HashPassword(password string) (string, error) {
	// Generate salt
	salt := make([]byte, h.SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}

	// Hash with Argon2id
	hash := argon2.IDKey([]byte(password), salt, h.Time, h.Memory, h.Threads, h.KeyLen)

	// Encode as $argon2id$v=19$m=MEMORY,t=TIME,p=THREADS$SALT$HASH
	encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		h.Memory,
		h.Time,
		h.Threads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	)

	return encoded, nil
}

// VerifyPassword verifies a password against a hash
func (h *PasswordHasher) VerifyPassword(password, hash string) (bool, error) {
	// Check if it's an Argon2 hash
	if strings.HasPrefix(hash, "$argon2") {
		return h.verifyArgon2(password, hash)
	}

	// Check if it's a bcrypt hash (for migration)
	if strings.HasPrefix(hash, "$2") {
		return h.verifyBcrypt(password, hash)
	}

	return false, errors.New("unknown hash format")
}

// verifyArgon2 verifies an Argon2 hash
func (h *PasswordHasher) verifyArgon2(password, encodedHash string) (bool, error) {
	// Parse the encoded hash
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, errors.New("invalid argon2 hash format")
	}

	var version int
	var memory, time uint32
	var threads uint8

	_, err := fmt.Sscanf(parts[2], "v=%d", &version)
	if err != nil {
		return false, fmt.Errorf("invalid version: %w", err)
	}

	_, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads)
	if err != nil {
		return false, fmt.Errorf("invalid parameters: %w", err)
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("invalid salt: %w", err)
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, fmt.Errorf("invalid hash: %w", err)
	}

	// Compute hash with same parameters
	computedHash := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(expectedHash)))

	// Constant-time comparison
	return constantTimeCompare(computedHash, expectedHash), nil
}

// verifyBcrypt verifies a bcrypt hash (for migration from old hashes)
func (h *PasswordHasher) verifyBcrypt(password, hash string) (bool, error) {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil, nil
}

// NeedsRehash checks if a hash needs to be rehashed with current parameters
func (h *PasswordHasher) NeedsRehash(hash string) bool {
	// Bcrypt hashes should be migrated to Argon2
	if strings.HasPrefix(hash, "$2") {
		return true
	}

	// Parse Argon2 parameters
	if !strings.HasPrefix(hash, "$argon2id") {
		return true // Not Argon2id
	}

	parts := strings.Split(hash, "$")
	if len(parts) != 6 {
		return true
	}

	var memory, time uint32
	var threads uint8
	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads)
	if err != nil {
		return true
	}

	// Check if parameters match current settings
	return memory != h.Memory || time != h.Time || threads != h.Threads
}

// constantTimeCompare performs constant-time comparison
func constantTimeCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

// ============================================================================
// Token Generation
// ============================================================================

// TokenGenerator generates secure random tokens
type TokenGenerator struct {
	defaultLength int
}

// NewTokenGenerator creates a new token generator
func NewTokenGenerator(defaultLength int) *TokenGenerator {
	if defaultLength <= 0 {
		defaultLength = 32
	}
	return &TokenGenerator{defaultLength: defaultLength}
}

// GenerateToken generates a cryptographically secure random token
func (t *TokenGenerator) GenerateToken() (string, error) {
	return t.GenerateTokenWithLength(t.defaultLength)
}

// GenerateTokenWithLength generates a token with specified length
func (t *TokenGenerator) GenerateTokenWithLength(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// GenerateHexToken generates a hex-encoded token
func (t *TokenGenerator) GenerateHexToken() (string, error) {
	return t.GenerateHexTokenWithLength(t.defaultLength)
}

// GenerateHexTokenWithLength generates a hex-encoded token with specified length
func (t *TokenGenerator) GenerateHexTokenWithLength(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateAPIKey generates an API key with prefix
func (t *TokenGenerator) GenerateAPIKey(prefix string) (string, error) {
	token, err := t.GenerateTokenWithLength(24)
	if err != nil {
		return "", err
	}
	// Replace URL-unsafe characters
	token = strings.ReplaceAll(token, "+", "")
	token = strings.ReplaceAll(token, "/", "")
	token = strings.ReplaceAll(token, "=", "")

	if prefix != "" {
		return prefix + "_" + token, nil
	}
	return token, nil
}

// ============================================================================
// Key Derivation
// ============================================================================

// DeriveKey derives an encryption key from a password
func DeriveKey(password string, salt []byte, keyLen uint32) []byte {
	return argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, keyLen)
}

// DeriveKeyWithParams derives a key with custom parameters
func DeriveKeyWithParams(password string, salt []byte, time, memory uint32, threads uint8, keyLen uint32) []byte {
	return argon2.IDKey([]byte(password), salt, time, memory, threads, keyLen)
}

// GenerateSalt generates a random salt
func GenerateSalt(length int) ([]byte, error) {
	salt := make([]byte, length)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	return salt, nil
}

// HashSHA256 computes SHA-256 hash of data
func HashSHA256(data []byte) []byte {
	hash := sha256.Sum256(data)
	return hash[:]
}

// HashSHA256String computes SHA-256 hash and returns hex string
func HashSHA256String(data string) string {
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// ============================================================================
// Secure Random
// ============================================================================

// SecureRandomBytes generates cryptographically secure random bytes
func SecureRandomBytes(length int) ([]byte, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return nil, err
	}
	return bytes, nil
}

// SecureRandomString generates a random alphanumeric string
func SecureRandomString(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	for i := range bytes {
		bytes[i] = charset[int(bytes[i])%len(charset)]
	}
	return string(bytes), nil
}

// SecureRandomInt generates a cryptographically secure random integer
func SecureRandomInt(max int) (int, error) {
	if max <= 0 {
		return 0, errors.New("max must be positive")
	}

	// Calculate number of bytes needed
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return 0, err
	}

	var n uint64
	for i := 0; i < 8; i++ {
		n = (n << 8) | uint64(bytes[i])
	}

	return int(n % uint64(max)), nil
}

// ============================================================================
// Time-based Token (for password resets, etc.)
// ============================================================================

// TimedToken represents a token with expiration
type TimedToken struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	Purpose   string    `json:"purpose"`
}

// GenerateTimedToken generates a token that expires after the specified duration
func GenerateTimedToken(purpose string, duration time.Duration) (*TimedToken, error) {
	tg := NewTokenGenerator(32)
	token, err := tg.GenerateToken()
	if err != nil {
		return nil, err
	}

	return &TimedToken{
		Token:     token,
		ExpiresAt: time.Now().Add(duration),
		Purpose:   purpose,
	}, nil
}

// IsValid checks if the token is still valid
func (t *TimedToken) IsValid() bool {
	return time.Now().Before(t.ExpiresAt)
}

// Hash returns the SHA-256 hash of the token (for storage)
func (t *TimedToken) Hash() string {
	return HashSHA256String(t.Token)
}
