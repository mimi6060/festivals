package notification

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// UserPreferences represents comprehensive notification preferences for a user
type UserPreferences struct {
	ID                uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID            uuid.UUID `json:"userId" gorm:"type:uuid;not null;uniqueIndex"`

	// Global channel toggles
	GlobalEmailEnabled bool `json:"globalEmailEnabled" gorm:"default:true"`
	GlobalSMSEnabled   bool `json:"globalSMSEnabled" gorm:"default:true"`
	GlobalPushEnabled  bool `json:"globalPushEnabled" gorm:"default:true"`
	GlobalInAppEnabled bool `json:"globalInAppEnabled" gorm:"default:true"`

	// Quiet hours settings
	QuietHoursEnabled bool   `json:"quietHoursEnabled" gorm:"default:false"`
	QuietHoursStart   string `json:"quietHoursStart" gorm:"default:'22:00'"` // HH:MM format in user's timezone
	QuietHoursEnd     string `json:"quietHoursEnd" gorm:"default:'08:00'"`   // HH:MM format in user's timezone
	Timezone          string `json:"timezone" gorm:"default:'UTC'"`

	// Marketing preferences
	MarketingEnabled     bool `json:"marketingEnabled" gorm:"default:false"`
	WeeklyDigestEnabled  bool `json:"weeklyDigestEnabled" gorm:"default:false"`

	// Language preference
	PreferredLanguage string `json:"preferredLanguage" gorm:"default:'en'"`

	// Channel preferences per event type (stored as JSONB)
	ChannelPreferences ChannelPreferencesMap `json:"channelPreferences" gorm:"type:jsonb;default:'{}'"`

	// Push notification settings
	PushDeviceTokens DeviceTokenList `json:"pushDeviceTokens" gorm:"type:jsonb;default:'[]'"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (UserPreferences) TableName() string {
	return "user_notification_preferences"
}

// ChannelPreferencesMap maps event types to their channel preferences
type ChannelPreferencesMap map[EventType]*ChannelPreference

// ChannelPreference represents channel preferences for a specific event type
type ChannelPreference struct {
	Email bool `json:"email"`
	SMS   bool `json:"sms"`
	Push  bool `json:"push"`
	InApp bool `json:"inApp"`
}

// DeviceTokenList represents a list of push notification device tokens
type DeviceTokenList []DeviceToken

// DeviceToken represents a push notification device token
type DeviceToken struct {
	Token      string    `json:"token"`
	Platform   string    `json:"platform"` // ios, android, web
	DeviceID   string    `json:"deviceId,omitempty"`
	AppVersion string    `json:"appVersion,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
}

// Scan implements the sql.Scanner interface for ChannelPreferencesMap
func (c *ChannelPreferencesMap) Scan(value interface{}) error {
	if value == nil {
		*c = make(ChannelPreferencesMap)
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to unmarshal ChannelPreferencesMap: %v", value)
	}

	return json.Unmarshal(bytes, c)
}

// Value implements the driver.Valuer interface for ChannelPreferencesMap
func (c ChannelPreferencesMap) Value() (driver.Value, error) {
	if c == nil {
		return "{}", nil
	}
	return json.Marshal(c)
}

// Scan implements the sql.Scanner interface for DeviceTokenList
func (d *DeviceTokenList) Scan(value interface{}) error {
	if value == nil {
		*d = make(DeviceTokenList, 0)
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to unmarshal DeviceTokenList: %v", value)
	}

	return json.Unmarshal(bytes, d)
}

// Value implements the driver.Valuer interface for DeviceTokenList
func (d DeviceTokenList) Value() (driver.Value, error) {
	if d == nil {
		return "[]", nil
	}
	return json.Marshal(d)
}

// UpdatePreferencesRequest represents a request to update notification preferences
type UpdateUserPreferencesRequest struct {
	GlobalEmailEnabled   *bool                  `json:"globalEmailEnabled,omitempty"`
	GlobalSMSEnabled     *bool                  `json:"globalSMSEnabled,omitempty"`
	GlobalPushEnabled    *bool                  `json:"globalPushEnabled,omitempty"`
	GlobalInAppEnabled   *bool                  `json:"globalInAppEnabled,omitempty"`
	QuietHoursEnabled    *bool                  `json:"quietHoursEnabled,omitempty"`
	QuietHoursStart      *string                `json:"quietHoursStart,omitempty"`
	QuietHoursEnd        *string                `json:"quietHoursEnd,omitempty"`
	Timezone             *string                `json:"timezone,omitempty"`
	MarketingEnabled     *bool                  `json:"marketingEnabled,omitempty"`
	WeeklyDigestEnabled  *bool                  `json:"weeklyDigestEnabled,omitempty"`
	PreferredLanguage    *string                `json:"preferredLanguage,omitempty"`
	ChannelPreferences   *ChannelPreferencesMap `json:"channelPreferences,omitempty"`
}

// UserPreferencesResponse represents the API response for user preferences
type UserPreferencesResponse struct {
	GlobalEmailEnabled   bool                  `json:"globalEmailEnabled"`
	GlobalSMSEnabled     bool                  `json:"globalSMSEnabled"`
	GlobalPushEnabled    bool                  `json:"globalPushEnabled"`
	GlobalInAppEnabled   bool                  `json:"globalInAppEnabled"`
	QuietHoursEnabled    bool                  `json:"quietHoursEnabled"`
	QuietHoursStart      string                `json:"quietHoursStart"`
	QuietHoursEnd        string                `json:"quietHoursEnd"`
	Timezone             string                `json:"timezone"`
	MarketingEnabled     bool                  `json:"marketingEnabled"`
	WeeklyDigestEnabled  bool                  `json:"weeklyDigestEnabled"`
	PreferredLanguage    string                `json:"preferredLanguage"`
	ChannelPreferences   ChannelPreferencesMap `json:"channelPreferences"`
	DeviceCount          int                   `json:"deviceCount"`
}

// ToResponse converts UserPreferences to UserPreferencesResponse
func (p *UserPreferences) ToResponse() UserPreferencesResponse {
	return UserPreferencesResponse{
		GlobalEmailEnabled:   p.GlobalEmailEnabled,
		GlobalSMSEnabled:     p.GlobalSMSEnabled,
		GlobalPushEnabled:    p.GlobalPushEnabled,
		GlobalInAppEnabled:   p.GlobalInAppEnabled,
		QuietHoursEnabled:    p.QuietHoursEnabled,
		QuietHoursStart:      p.QuietHoursStart,
		QuietHoursEnd:        p.QuietHoursEnd,
		Timezone:             p.Timezone,
		MarketingEnabled:     p.MarketingEnabled,
		WeeklyDigestEnabled:  p.WeeklyDigestEnabled,
		PreferredLanguage:    p.PreferredLanguage,
		ChannelPreferences:   p.ChannelPreferences,
		DeviceCount:          len(p.PushDeviceTokens),
	}
}

// PreferencesService handles notification preferences business logic
type PreferencesService struct {
	db *gorm.DB
}

// NewPreferencesService creates a new preferences service
func NewPreferencesService(db *gorm.DB) *PreferencesService {
	return &PreferencesService{db: db}
}

// GetUserPreferences retrieves notification preferences for a user
func (s *PreferencesService) GetUserPreferences(ctx context.Context, userID uuid.UUID) (*UserPreferences, error) {
	var prefs UserPreferences
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&prefs).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create default preferences
			return s.createDefaultPreferences(ctx, userID)
		}
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}
	return &prefs, nil
}

// GetDefaultPreferences returns default preferences without persisting
func (s *PreferencesService) GetDefaultPreferences(userID uuid.UUID) *UserPreferences {
	return &UserPreferences{
		ID:                 uuid.New(),
		UserID:             userID,
		GlobalEmailEnabled: true,
		GlobalSMSEnabled:   true,
		GlobalPushEnabled:  true,
		GlobalInAppEnabled: true,
		QuietHoursEnabled:  false,
		QuietHoursStart:    "22:00",
		QuietHoursEnd:      "08:00",
		Timezone:           "UTC",
		MarketingEnabled:   false,
		WeeklyDigestEnabled: false,
		PreferredLanguage:  "en",
		ChannelPreferences: s.getDefaultChannelPreferences(),
		PushDeviceTokens:   make(DeviceTokenList, 0),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
}

// createDefaultPreferences creates default preferences for a new user
func (s *PreferencesService) createDefaultPreferences(ctx context.Context, userID uuid.UUID) (*UserPreferences, error) {
	prefs := s.GetDefaultPreferences(userID)

	if err := s.db.WithContext(ctx).Create(prefs).Error; err != nil {
		return nil, fmt.Errorf("failed to create default preferences: %w", err)
	}

	log.Info().
		Str("userId", userID.String()).
		Msg("Created default notification preferences")

	return prefs, nil
}

// getDefaultChannelPreferences returns default channel preferences for all event types
func (s *PreferencesService) getDefaultChannelPreferences() ChannelPreferencesMap {
	return ChannelPreferencesMap{
		EventTypeTransactional: &ChannelPreference{
			Email: true,
			SMS:   false,
			Push:  true,
			InApp: true,
		},
		EventTypeMarketing: &ChannelPreference{
			Email: false,
			SMS:   false,
			Push:  false,
			InApp: true,
		},
		EventTypeSecurityAlert: &ChannelPreference{
			Email: true,
			SMS:   true,
			Push:  true,
			InApp: true,
		},
		EventTypeTicketReminder: &ChannelPreference{
			Email: true,
			SMS:   true,
			Push:  true,
			InApp: true,
		},
		EventTypeLineupUpdate: &ChannelPreference{
			Email: true,
			SMS:   false,
			Push:  true,
			InApp: true,
		},
		EventTypeEmergency: &ChannelPreference{
			Email: true,
			SMS:   true,
			Push:  true,
			InApp: true,
		},
		EventTypeSOSConfirmation: &ChannelPreference{
			Email: false,
			SMS:   true,
			Push:  true,
			InApp: true,
		},
		EventTypePaymentConfirm: &ChannelPreference{
			Email: true,
			SMS:   false,
			Push:  true,
			InApp: true,
		},
		EventTypeRefund: &ChannelPreference{
			Email: true,
			SMS:   false,
			Push:  true,
			InApp: true,
		},
		EventTypeWelcome: &ChannelPreference{
			Email: true,
			SMS:   false,
			Push:  true,
			InApp: true,
		},
		EventTypeBroadcast: &ChannelPreference{
			Email: false,
			SMS:   false,
			Push:  true,
			InApp: true,
		},
	}
}

// UpdatePreferences updates notification preferences for a user
func (s *PreferencesService) UpdatePreferences(ctx context.Context, userID uuid.UUID, req UpdateUserPreferencesRequest) (*UserPreferences, error) {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.GlobalEmailEnabled != nil {
		prefs.GlobalEmailEnabled = *req.GlobalEmailEnabled
	}
	if req.GlobalSMSEnabled != nil {
		prefs.GlobalSMSEnabled = *req.GlobalSMSEnabled
	}
	if req.GlobalPushEnabled != nil {
		prefs.GlobalPushEnabled = *req.GlobalPushEnabled
	}
	if req.GlobalInAppEnabled != nil {
		prefs.GlobalInAppEnabled = *req.GlobalInAppEnabled
	}
	if req.QuietHoursEnabled != nil {
		prefs.QuietHoursEnabled = *req.QuietHoursEnabled
	}
	if req.QuietHoursStart != nil {
		if !isValidTimeFormat(*req.QuietHoursStart) {
			return nil, fmt.Errorf("invalid quiet hours start format, expected HH:MM")
		}
		prefs.QuietHoursStart = *req.QuietHoursStart
	}
	if req.QuietHoursEnd != nil {
		if !isValidTimeFormat(*req.QuietHoursEnd) {
			return nil, fmt.Errorf("invalid quiet hours end format, expected HH:MM")
		}
		prefs.QuietHoursEnd = *req.QuietHoursEnd
	}
	if req.Timezone != nil {
		if !isValidTimezone(*req.Timezone) {
			return nil, fmt.Errorf("invalid timezone")
		}
		prefs.Timezone = *req.Timezone
	}
	if req.MarketingEnabled != nil {
		prefs.MarketingEnabled = *req.MarketingEnabled
	}
	if req.WeeklyDigestEnabled != nil {
		prefs.WeeklyDigestEnabled = *req.WeeklyDigestEnabled
	}
	if req.PreferredLanguage != nil {
		prefs.PreferredLanguage = *req.PreferredLanguage
	}
	if req.ChannelPreferences != nil {
		// Merge channel preferences
		for eventType, channelPref := range *req.ChannelPreferences {
			prefs.ChannelPreferences[eventType] = channelPref
		}
	}

	prefs.UpdatedAt = time.Now()

	if err := s.db.WithContext(ctx).Save(prefs).Error; err != nil {
		return nil, fmt.Errorf("failed to update preferences: %w", err)
	}

	log.Info().
		Str("userId", userID.String()).
		Msg("Updated notification preferences")

	return prefs, nil
}

// SetChannelPreference sets channel preferences for a specific event type
func (s *PreferencesService) SetChannelPreference(ctx context.Context, userID uuid.UUID, eventType EventType, pref *ChannelPreference) error {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return err
	}

	if prefs.ChannelPreferences == nil {
		prefs.ChannelPreferences = make(ChannelPreferencesMap)
	}

	prefs.ChannelPreferences[eventType] = pref
	prefs.UpdatedAt = time.Now()

	return s.db.WithContext(ctx).Save(prefs).Error
}

// GetChannelPreference gets channel preferences for a specific event type
func (s *PreferencesService) GetChannelPreference(ctx context.Context, userID uuid.UUID, eventType EventType) (*ChannelPreference, error) {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}

	if pref, ok := prefs.ChannelPreferences[eventType]; ok {
		return pref, nil
	}

	// Return default preference
	defaults := s.getDefaultChannelPreferences()
	if pref, ok := defaults[eventType]; ok {
		return pref, nil
	}

	return &ChannelPreference{
		Email: true,
		SMS:   false,
		Push:  true,
		InApp: true,
	}, nil
}

// RegisterDeviceToken registers a device token for push notifications
func (s *PreferencesService) RegisterDeviceToken(ctx context.Context, userID uuid.UUID, token, platform, deviceID, appVersion string) error {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return err
	}

	now := time.Now()

	// Check if token already exists
	for i, dt := range prefs.PushDeviceTokens {
		if dt.Token == token {
			// Update existing token
			prefs.PushDeviceTokens[i].LastUsedAt = now
			prefs.PushDeviceTokens[i].Platform = platform
			prefs.PushDeviceTokens[i].DeviceID = deviceID
			prefs.PushDeviceTokens[i].AppVersion = appVersion
			prefs.UpdatedAt = now
			return s.db.WithContext(ctx).Save(prefs).Error
		}
	}

	// Add new token
	prefs.PushDeviceTokens = append(prefs.PushDeviceTokens, DeviceToken{
		Token:      token,
		Platform:   platform,
		DeviceID:   deviceID,
		AppVersion: appVersion,
		CreatedAt:  now,
		LastUsedAt: now,
	})
	prefs.UpdatedAt = now

	log.Info().
		Str("userId", userID.String()).
		Str("platform", platform).
		Msg("Registered device token")

	return s.db.WithContext(ctx).Save(prefs).Error
}

// UnregisterDeviceToken removes a device token
func (s *PreferencesService) UnregisterDeviceToken(ctx context.Context, userID uuid.UUID, token string) error {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return err
	}

	// Find and remove token
	for i, dt := range prefs.PushDeviceTokens {
		if dt.Token == token {
			prefs.PushDeviceTokens = append(prefs.PushDeviceTokens[:i], prefs.PushDeviceTokens[i+1:]...)
			prefs.UpdatedAt = time.Now()

			log.Info().
				Str("userId", userID.String()).
				Msg("Unregistered device token")

			return s.db.WithContext(ctx).Save(prefs).Error
		}
	}

	return nil
}

// GetDeviceTokens returns all device tokens for a user
func (s *PreferencesService) GetDeviceTokens(ctx context.Context, userID uuid.UUID) ([]DeviceToken, error) {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}
	return prefs.PushDeviceTokens, nil
}

// CleanupStaleTokens removes device tokens that haven't been used in the specified duration
func (s *PreferencesService) CleanupStaleTokens(ctx context.Context, userID uuid.UUID, staleAfter time.Duration) (int, error) {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return 0, err
	}

	cutoff := time.Now().Add(-staleAfter)
	activeTokens := make(DeviceTokenList, 0)
	removedCount := 0

	for _, dt := range prefs.PushDeviceTokens {
		if dt.LastUsedAt.After(cutoff) {
			activeTokens = append(activeTokens, dt)
		} else {
			removedCount++
		}
	}

	if removedCount > 0 {
		prefs.PushDeviceTokens = activeTokens
		prefs.UpdatedAt = time.Now()

		if err := s.db.WithContext(ctx).Save(prefs).Error; err != nil {
			return 0, fmt.Errorf("failed to cleanup stale tokens: %w", err)
		}

		log.Info().
			Str("userId", userID.String()).
			Int("removedCount", removedCount).
			Msg("Cleaned up stale device tokens")
	}

	return removedCount, nil
}

// IsInQuietHours checks if the current time is within quiet hours
func (s *PreferencesService) IsInQuietHours(prefs *UserPreferences) bool {
	if !prefs.QuietHoursEnabled {
		return false
	}

	// Load timezone
	loc, err := time.LoadLocation(prefs.Timezone)
	if err != nil {
		loc = time.UTC
	}

	now := time.Now().In(loc)
	currentMinutes := now.Hour()*60 + now.Minute()

	// Parse quiet hours
	startMinutes := parseTimeToMinutes(prefs.QuietHoursStart)
	endMinutes := parseTimeToMinutes(prefs.QuietHoursEnd)

	// Handle overnight quiet hours (e.g., 22:00 - 08:00)
	if startMinutes > endMinutes {
		// Quiet hours span midnight
		return currentMinutes >= startMinutes || currentMinutes < endMinutes
	}

	// Same-day quiet hours (e.g., 13:00 - 15:00)
	return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

// SetQuietHours sets quiet hours for a user
func (s *PreferencesService) SetQuietHours(ctx context.Context, userID uuid.UUID, enabled bool, start, end, timezone string) error {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return err
	}

	prefs.QuietHoursEnabled = enabled

	if start != "" {
		if !isValidTimeFormat(start) {
			return fmt.Errorf("invalid start time format, expected HH:MM")
		}
		prefs.QuietHoursStart = start
	}

	if end != "" {
		if !isValidTimeFormat(end) {
			return fmt.Errorf("invalid end time format, expected HH:MM")
		}
		prefs.QuietHoursEnd = end
	}

	if timezone != "" {
		if !isValidTimezone(timezone) {
			return fmt.Errorf("invalid timezone")
		}
		prefs.Timezone = timezone
	}

	prefs.UpdatedAt = time.Now()

	return s.db.WithContext(ctx).Save(prefs).Error
}

// EnableAllChannels enables all notification channels
func (s *PreferencesService) EnableAllChannels(ctx context.Context, userID uuid.UUID) error {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return err
	}

	prefs.GlobalEmailEnabled = true
	prefs.GlobalSMSEnabled = true
	prefs.GlobalPushEnabled = true
	prefs.GlobalInAppEnabled = true
	prefs.UpdatedAt = time.Now()

	return s.db.WithContext(ctx).Save(prefs).Error
}

// DisableAllChannels disables all notification channels (except security alerts)
func (s *PreferencesService) DisableAllChannels(ctx context.Context, userID uuid.UUID) error {
	prefs, err := s.GetUserPreferences(ctx, userID)
	if err != nil {
		return err
	}

	prefs.GlobalEmailEnabled = false
	prefs.GlobalSMSEnabled = false
	prefs.GlobalPushEnabled = false
	prefs.GlobalInAppEnabled = false
	prefs.UpdatedAt = time.Now()

	return s.db.WithContext(ctx).Save(prefs).Error
}

// DeleteUserPreferences deletes all notification preferences for a user
func (s *PreferencesService) DeleteUserPreferences(ctx context.Context, userID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&UserPreferences{}).Error
}

// GetUsersWithDeviceTokens returns user IDs that have registered device tokens for a platform
func (s *PreferencesService) GetUsersWithDeviceTokens(ctx context.Context, platform string, limit, offset int) ([]uuid.UUID, error) {
	var userIDs []uuid.UUID

	query := s.db.WithContext(ctx).Model(&UserPreferences{}).
		Select("user_id").
		Where("global_push_enabled = ?", true)

	if platform != "" {
		query = query.Where("push_device_tokens @> ?", fmt.Sprintf(`[{"platform": "%s"}]`, platform))
	} else {
		query = query.Where("jsonb_array_length(push_device_tokens) > 0")
	}

	if err := query.Limit(limit).Offset(offset).Pluck("user_id", &userIDs).Error; err != nil {
		return nil, fmt.Errorf("failed to get users with device tokens: %w", err)
	}

	return userIDs, nil
}

// Helper functions

func parseTimeToMinutes(timeStr string) int {
	var hours, minutes int
	fmt.Sscanf(timeStr, "%d:%d", &hours, &minutes)
	return hours*60 + minutes
}

func isValidTimeFormat(timeStr string) bool {
	var hours, minutes int
	n, err := fmt.Sscanf(timeStr, "%d:%d", &hours, &minutes)
	if err != nil || n != 2 {
		return false
	}
	return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
}

func isValidTimezone(tz string) bool {
	_, err := time.LoadLocation(tz)
	return err == nil
}
