package notification

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/net/http2"
)

// PushPlatform represents a push notification platform
type PushPlatform string

const (
	PushPlatformFCM  PushPlatform = "fcm"
	PushPlatformAPNs PushPlatform = "apns"
	PushPlatformWeb  PushPlatform = "web"
)

// PushNotification represents a push notification to be sent
type PushNotification struct {
	Title       string            `json:"title"`
	Body        string            `json:"body"`
	ImageURL    string            `json:"imageUrl,omitempty"`
	Badge       *int              `json:"badge,omitempty"`
	Sound       string            `json:"sound,omitempty"`
	Data        map[string]string `json:"data,omitempty"`
	CollapseKey string            `json:"collapseKey,omitempty"`
	TTL         time.Duration     `json:"ttl,omitempty"`
	Priority    string            `json:"priority,omitempty"` // high, normal
}

// PushResult represents the result of sending a push notification
type PushResult struct {
	Success   bool   `json:"success"`
	MessageID string `json:"messageId,omitempty"`
	Error     string `json:"error,omitempty"`
	Token     string `json:"token,omitempty"`
	Platform  string `json:"platform,omitempty"`
}

// TopicSubscription represents a subscription to a push notification topic
type TopicSubscription struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID    uuid.UUID `json:"userId" gorm:"type:uuid;not null;index"`
	Token     string    `json:"token" gorm:"not null;index"`
	Topic     string    `json:"topic" gorm:"not null;index"`
	Platform  string    `json:"platform" gorm:"not null"`
	CreatedAt time.Time `json:"createdAt"`
}

func (TopicSubscription) TableName() string {
	return "push_topic_subscriptions"
}

// PushServiceConfig holds configuration for the push service
type PushServiceConfig struct {
	// Firebase Cloud Messaging (FCM) configuration
	FCMProjectID      string
	FCMServiceAccount string // JSON service account key
	FCMEnabled        bool

	// Apple Push Notification service (APNs) configuration
	APNsKeyID      string
	APNsTeamID     string
	APNsPrivateKey string // PEM-encoded private key
	APNsBundleID   string
	APNsProduction bool
	APNsEnabled    bool

	// Web Push (VAPID) configuration
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string
	WebPushEnabled  bool

	// General settings
	DefaultTTL time.Duration
}

// PushService handles push notifications across multiple platforms
type PushService struct {
	config          PushServiceConfig
	prefsService    *PreferencesService
	httpClient      *http.Client

	// FCM
	fcmAccessToken  string
	fcmTokenExpiry  time.Time
	fcmMu           sync.RWMutex

	// APNs
	apnsPrivateKey  *ecdsa.PrivateKey
	apnsJWT         string
	apnsJWTExpiry   time.Time
	apnsMu          sync.RWMutex
	apnsClient      *http.Client

	// Metrics
	mu              sync.RWMutex
	sentCount       map[PushPlatform]int64
	failedCount     map[PushPlatform]int64
}

// NewPushService creates a new push notification service
func NewPushService(config PushServiceConfig, prefsService *PreferencesService) (*PushService, error) {
	s := &PushService{
		config:       config,
		prefsService: prefsService,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		sentCount:   make(map[PushPlatform]int64),
		failedCount: make(map[PushPlatform]int64),
	}

	if config.DefaultTTL == 0 {
		s.config.DefaultTTL = 24 * time.Hour
	}

	// Initialize APNs if enabled
	if config.APNsEnabled && config.APNsPrivateKey != "" {
		if err := s.initAPNs(); err != nil {
			log.Warn().Err(err).Msg("Failed to initialize APNs, continuing without APNs support")
		}
	}

	return s, nil
}

// initAPNs initializes the APNs client
func (s *PushService) initAPNs() error {
	// Parse private key
	block, _ := pem.Decode([]byte(s.config.APNsPrivateKey))
	if block == nil {
		return fmt.Errorf("failed to parse APNs private key PEM")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		// Try parsing as EC private key
		key, err = x509.ParseECPrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("failed to parse APNs private key: %w", err)
		}
	}

	ecdsaKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return fmt.Errorf("APNs private key is not an ECDSA key")
	}

	s.apnsPrivateKey = ecdsaKey

	// Create HTTP/2 client for APNs
	tlsConfig := &tls.Config{}
	transport := &http2.Transport{
		TLSClientConfig: tlsConfig,
	}
	s.apnsClient = &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}

	return nil
}

// SendToDevice sends a push notification to a specific device token
func (s *PushService) SendToDevice(ctx context.Context, token string, notification *PushNotification) (string, error) {
	// Determine platform from token format
	platform := s.detectPlatform(token)

	switch platform {
	case PushPlatformFCM:
		return s.sendFCM(ctx, token, notification)
	case PushPlatformAPNs:
		return s.sendAPNs(ctx, token, notification)
	default:
		return "", fmt.Errorf("unknown push platform for token")
	}
}

// SendToUser sends a push notification to all devices registered by a user
func (s *PushService) SendToUser(ctx context.Context, userID uuid.UUID, notification *PushNotification) (string, error) {
	tokens, err := s.prefsService.GetDeviceTokens(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get device tokens: %w", err)
	}

	if len(tokens) == 0 {
		return "", fmt.Errorf("no device tokens registered for user")
	}

	var lastMessageID string
	var lastErr error

	for _, dt := range tokens {
		messageID, err := s.SendToDevice(ctx, dt.Token, notification)
		if err != nil {
			log.Error().Err(err).
				Str("userId", userID.String()).
				Str("platform", dt.Platform).
				Msg("Failed to send push notification to device")
			lastErr = err
			continue
		}
		lastMessageID = messageID
	}

	if lastMessageID == "" && lastErr != nil {
		return "", lastErr
	}

	return lastMessageID, nil
}

// SendToTopic sends a push notification to a topic
func (s *PushService) SendToTopic(ctx context.Context, topic string, notification *PushNotification) (string, error) {
	if !s.config.FCMEnabled {
		return "", fmt.Errorf("FCM is not enabled for topic messaging")
	}

	return s.sendFCMToTopic(ctx, topic, notification)
}

// SendMulticast sends a push notification to multiple device tokens
func (s *PushService) SendMulticast(ctx context.Context, tokens []string, notification *PushNotification) ([]*PushResult, error) {
	results := make([]*PushResult, len(tokens))

	for i, token := range tokens {
		messageID, err := s.SendToDevice(ctx, token, notification)
		results[i] = &PushResult{
			Token:    token,
			Platform: string(s.detectPlatform(token)),
		}

		if err != nil {
			results[i].Success = false
			results[i].Error = err.Error()
		} else {
			results[i].Success = true
			results[i].MessageID = messageID
		}
	}

	return results, nil
}

// detectPlatform attempts to detect the push platform from the token format
func (s *PushService) detectPlatform(token string) PushPlatform {
	// APNs tokens are typically 64-character hex strings
	if len(token) == 64 {
		for _, c := range token {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				return PushPlatformFCM
			}
		}
		return PushPlatformAPNs
	}

	// FCM tokens are longer and contain colons
	return PushPlatformFCM
}

// sendFCM sends a notification via Firebase Cloud Messaging
func (s *PushService) sendFCM(ctx context.Context, token string, notification *PushNotification) (string, error) {
	if !s.config.FCMEnabled {
		return "", fmt.Errorf("FCM is not enabled")
	}

	// Get access token
	accessToken, err := s.getFCMAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get FCM access token: %w", err)
	}

	// Build FCM message
	message := map[string]interface{}{
		"message": map[string]interface{}{
			"token": token,
			"notification": map[string]interface{}{
				"title": notification.Title,
				"body":  notification.Body,
			},
		},
	}

	// Add optional fields
	msg := message["message"].(map[string]interface{})

	if notification.ImageURL != "" {
		notif := msg["notification"].(map[string]interface{})
		notif["image"] = notification.ImageURL
	}

	if notification.Data != nil && len(notification.Data) > 0 {
		msg["data"] = notification.Data
	}

	// Android-specific options
	androidConfig := map[string]interface{}{}
	if notification.CollapseKey != "" {
		androidConfig["collapse_key"] = notification.CollapseKey
	}
	if notification.Priority == "high" {
		androidConfig["priority"] = "HIGH"
	}
	if notification.TTL > 0 {
		androidConfig["ttl"] = fmt.Sprintf("%ds", int(notification.TTL.Seconds()))
	}
	if len(androidConfig) > 0 {
		msg["android"] = androidConfig
	}

	// iOS-specific options (APNs via FCM)
	apnsConfig := map[string]interface{}{
		"payload": map[string]interface{}{
			"aps": map[string]interface{}{},
		},
	}
	aps := apnsConfig["payload"].(map[string]interface{})["aps"].(map[string]interface{})

	if notification.Sound != "" {
		aps["sound"] = notification.Sound
	}
	if notification.Badge != nil {
		aps["badge"] = *notification.Badge
	}
	if len(aps) > 0 {
		msg["apns"] = apnsConfig
	}

	// Send request
	body, err := json.Marshal(message)
	if err != nil {
		return "", fmt.Errorf("failed to marshal FCM message: %w", err)
	}

	url := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", s.config.FCMProjectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create FCM request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send FCM request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read FCM response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.mu.Lock()
		s.failedCount[PushPlatformFCM]++
		s.mu.Unlock()
		return "", fmt.Errorf("FCM error: %s", string(respBody))
	}

	var fcmResp struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(respBody, &fcmResp); err != nil {
		return "", fmt.Errorf("failed to parse FCM response: %w", err)
	}

	s.mu.Lock()
	s.sentCount[PushPlatformFCM]++
	s.mu.Unlock()

	log.Debug().
		Str("messageId", fcmResp.Name).
		Msg("FCM notification sent")

	return fcmResp.Name, nil
}

// sendFCMToTopic sends a notification to an FCM topic
func (s *PushService) sendFCMToTopic(ctx context.Context, topic string, notification *PushNotification) (string, error) {
	accessToken, err := s.getFCMAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get FCM access token: %w", err)
	}

	message := map[string]interface{}{
		"message": map[string]interface{}{
			"topic": topic,
			"notification": map[string]interface{}{
				"title": notification.Title,
				"body":  notification.Body,
			},
		},
	}

	if notification.Data != nil && len(notification.Data) > 0 {
		message["message"].(map[string]interface{})["data"] = notification.Data
	}

	body, err := json.Marshal(message)
	if err != nil {
		return "", fmt.Errorf("failed to marshal FCM topic message: %w", err)
	}

	url := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", s.config.FCMProjectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create FCM request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send FCM topic request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read FCM response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("FCM topic error: %s", string(respBody))
	}

	var fcmResp struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(respBody, &fcmResp); err != nil {
		return "", fmt.Errorf("failed to parse FCM response: %w", err)
	}

	log.Info().
		Str("topic", topic).
		Str("messageId", fcmResp.Name).
		Msg("FCM topic notification sent")

	return fcmResp.Name, nil
}

// getFCMAccessToken gets or refreshes the FCM access token
func (s *PushService) getFCMAccessToken(ctx context.Context) (string, error) {
	s.fcmMu.RLock()
	if s.fcmAccessToken != "" && time.Now().Before(s.fcmTokenExpiry) {
		token := s.fcmAccessToken
		s.fcmMu.RUnlock()
		return token, nil
	}
	s.fcmMu.RUnlock()

	s.fcmMu.Lock()
	defer s.fcmMu.Unlock()

	// Double-check after acquiring write lock
	if s.fcmAccessToken != "" && time.Now().Before(s.fcmTokenExpiry) {
		return s.fcmAccessToken, nil
	}

	// Parse service account JSON
	var serviceAccount struct {
		Type                    string `json:"type"`
		ProjectID               string `json:"project_id"`
		PrivateKeyID            string `json:"private_key_id"`
		PrivateKey              string `json:"private_key"`
		ClientEmail             string `json:"client_email"`
		ClientID                string `json:"client_id"`
		AuthURI                 string `json:"auth_uri"`
		TokenURI                string `json:"token_uri"`
		AuthProviderX509CertURL string `json:"auth_provider_x509_cert_url"`
		ClientX509CertURL       string `json:"client_x509_cert_url"`
	}

	if err := json.Unmarshal([]byte(s.config.FCMServiceAccount), &serviceAccount); err != nil {
		return "", fmt.Errorf("failed to parse FCM service account: %w", err)
	}

	// Create JWT
	now := time.Now()
	claims := jwt.MapClaims{
		"iss":   serviceAccount.ClientEmail,
		"sub":   serviceAccount.ClientEmail,
		"aud":   serviceAccount.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
		"scope": "https://www.googleapis.com/auth/firebase.messaging",
	}

	// Parse private key
	block, _ := pem.Decode([]byte(serviceAccount.PrivateKey))
	if block == nil {
		return "", fmt.Errorf("failed to parse FCM private key PEM")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse FCM private key: %w", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = serviceAccount.PrivateKeyID

	signedJWT, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign FCM JWT: %w", err)
	}

	// Exchange JWT for access token
	data := fmt.Sprintf("grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=%s", signedJWT)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, serviceAccount.TokenURI, bytes.NewBufferString(data))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get FCM access token: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("FCM token error: %s", string(respBody))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse token response: %w", err)
	}

	s.fcmAccessToken = tokenResp.AccessToken
	s.fcmTokenExpiry = now.Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second) // Expire 60s early

	return s.fcmAccessToken, nil
}

// sendAPNs sends a notification via Apple Push Notification service
func (s *PushService) sendAPNs(ctx context.Context, token string, notification *PushNotification) (string, error) {
	if !s.config.APNsEnabled {
		return "", fmt.Errorf("APNs is not enabled")
	}

	if s.apnsPrivateKey == nil {
		return "", fmt.Errorf("APNs private key not initialized")
	}

	// Get or refresh JWT token
	jwtToken, err := s.getAPNsJWT()
	if err != nil {
		return "", fmt.Errorf("failed to get APNs JWT: %w", err)
	}

	// Build APNs payload
	payload := map[string]interface{}{
		"aps": map[string]interface{}{
			"alert": map[string]interface{}{
				"title": notification.Title,
				"body":  notification.Body,
			},
		},
	}

	aps := payload["aps"].(map[string]interface{})

	if notification.Sound != "" {
		aps["sound"] = notification.Sound
	}
	if notification.Badge != nil {
		aps["badge"] = *notification.Badge
	}

	// Add custom data
	if notification.Data != nil {
		for k, v := range notification.Data {
			payload[k] = v
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal APNs payload: %w", err)
	}

	// Build APNs URL
	host := "api.push.apple.com"
	if !s.config.APNsProduction {
		host = "api.sandbox.push.apple.com"
	}
	url := fmt.Sprintf("https://%s:443/3/device/%s", host, token)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create APNs request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "bearer "+jwtToken)
	req.Header.Set("apns-topic", s.config.APNsBundleID)

	if notification.Priority == "high" {
		req.Header.Set("apns-priority", "10")
	} else {
		req.Header.Set("apns-priority", "5")
	}

	if notification.CollapseKey != "" {
		req.Header.Set("apns-collapse-id", notification.CollapseKey)
	}

	// Set expiration
	ttl := notification.TTL
	if ttl == 0 {
		ttl = s.config.DefaultTTL
	}
	expiration := time.Now().Add(ttl).Unix()
	req.Header.Set("apns-expiration", fmt.Sprintf("%d", expiration))

	// Send request
	resp, err := s.apnsClient.Do(req)
	if err != nil {
		s.mu.Lock()
		s.failedCount[PushPlatformAPNs]++
		s.mu.Unlock()
		return "", fmt.Errorf("failed to send APNs request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read APNs response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.mu.Lock()
		s.failedCount[PushPlatformAPNs]++
		s.mu.Unlock()

		var apnsErr struct {
			Reason string `json:"reason"`
		}
		json.Unmarshal(respBody, &apnsErr)
		return "", fmt.Errorf("APNs error: %s (status %d)", apnsErr.Reason, resp.StatusCode)
	}

	// Get message ID from response header
	messageID := resp.Header.Get("apns-id")
	if messageID == "" {
		messageID = uuid.New().String()
	}

	s.mu.Lock()
	s.sentCount[PushPlatformAPNs]++
	s.mu.Unlock()

	log.Debug().
		Str("messageId", messageID).
		Msg("APNs notification sent")

	return messageID, nil
}

// getAPNsJWT gets or refreshes the APNs JWT token
func (s *PushService) getAPNsJWT() (string, error) {
	s.apnsMu.RLock()
	if s.apnsJWT != "" && time.Now().Before(s.apnsJWTExpiry) {
		token := s.apnsJWT
		s.apnsMu.RUnlock()
		return token, nil
	}
	s.apnsMu.RUnlock()

	s.apnsMu.Lock()
	defer s.apnsMu.Unlock()

	// Double-check after acquiring write lock
	if s.apnsJWT != "" && time.Now().Before(s.apnsJWTExpiry) {
		return s.apnsJWT, nil
	}

	// Create new JWT
	now := time.Now()
	claims := jwt.MapClaims{
		"iss": s.config.APNsTeamID,
		"iat": now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = s.config.APNsKeyID

	signedToken, err := token.SignedString(s.apnsPrivateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign APNs JWT: %w", err)
	}

	s.apnsJWT = signedToken
	s.apnsJWTExpiry = now.Add(50 * time.Minute) // APNs JWTs are valid for 60 minutes

	return s.apnsJWT, nil
}

// SubscribeToTopic subscribes a device token to a topic
func (s *PushService) SubscribeToTopic(ctx context.Context, token, topic string) error {
	if !s.config.FCMEnabled {
		return fmt.Errorf("FCM is not enabled for topic subscriptions")
	}

	accessToken, err := s.getFCMAccessToken(ctx)
	if err != nil {
		return fmt.Errorf("failed to get FCM access token: %w", err)
	}

	url := fmt.Sprintf("https://iid.googleapis.com/iid/v1/%s/rel/topics/%s", token, topic)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create subscription request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to subscribe to topic: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to subscribe to topic: %s", string(body))
	}

	log.Info().
		Str("token", token[:10]+"...").
		Str("topic", topic).
		Msg("Subscribed to FCM topic")

	return nil
}

// UnsubscribeFromTopic unsubscribes a device token from a topic
func (s *PushService) UnsubscribeFromTopic(ctx context.Context, token, topic string) error {
	if !s.config.FCMEnabled {
		return fmt.Errorf("FCM is not enabled for topic subscriptions")
	}

	accessToken, err := s.getFCMAccessToken(ctx)
	if err != nil {
		return fmt.Errorf("failed to get FCM access token: %w", err)
	}

	url := fmt.Sprintf("https://iid.googleapis.com/iid/v1/%s/rel/topics/%s", token, topic)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create unsubscription request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to unsubscribe from topic: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to unsubscribe from topic: %s", string(body))
	}

	log.Info().
		Str("token", token[:10]+"...").
		Str("topic", topic).
		Msg("Unsubscribed from FCM topic")

	return nil
}

// BatchSubscribeToTopic subscribes multiple tokens to a topic
func (s *PushService) BatchSubscribeToTopic(ctx context.Context, tokens []string, topic string) (int, int, error) {
	successCount := 0
	failureCount := 0

	for _, token := range tokens {
		if err := s.SubscribeToTopic(ctx, token, topic); err != nil {
			log.Error().Err(err).Str("token", token[:10]+"...").Msg("Failed to subscribe token to topic")
			failureCount++
		} else {
			successCount++
		}
	}

	return successCount, failureCount, nil
}

// GetStats returns push service statistics
func (s *PushService) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]interface{}{
		"sent": map[string]int64{
			"fcm":  s.sentCount[PushPlatformFCM],
			"apns": s.sentCount[PushPlatformAPNs],
		},
		"failed": map[string]int64{
			"fcm":  s.failedCount[PushPlatformFCM],
			"apns": s.failedCount[PushPlatformAPNs],
		},
		"fcm_enabled":  s.config.FCMEnabled,
		"apns_enabled": s.config.APNsEnabled,
	}
}

// ResetStats resets the push service statistics
func (s *PushService) ResetStats() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.sentCount = make(map[PushPlatform]int64)
	s.failedCount = make(map[PushPlatform]int64)
}

// HealthCheck checks the health of push notification services
func (s *PushService) HealthCheck(ctx context.Context) map[string]bool {
	health := make(map[string]bool)

	// Check FCM
	if s.config.FCMEnabled {
		_, err := s.getFCMAccessToken(ctx)
		health["fcm"] = err == nil
	}

	// Check APNs (just verify key is loaded)
	if s.config.APNsEnabled {
		health["apns"] = s.apnsPrivateKey != nil
	}

	return health
}
