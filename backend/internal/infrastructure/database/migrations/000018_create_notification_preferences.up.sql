-- Migration: Create user notification preferences table
-- This table stores notification preferences and push tokens for users

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- Global channel toggles
    global_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    global_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    global_push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    global_in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Quiet hours settings
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start VARCHAR(5) NOT NULL DEFAULT '22:00',  -- HH:MM format
    quiet_hours_end VARCHAR(5) NOT NULL DEFAULT '08:00',    -- HH:MM format
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',

    -- Marketing preferences
    marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    weekly_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Language preference
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',

    -- Channel preferences per event type (JSON)
    channel_preferences JSONB NOT NULL DEFAULT '{}',

    -- Push notification device tokens (JSON array)
    push_device_tokens JSONB NOT NULL DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON user_notification_preferences(user_id);

-- Create index for finding users with push tokens enabled
CREATE INDEX IF NOT EXISTS idx_notification_preferences_push_enabled ON user_notification_preferences(global_push_enabled) WHERE global_push_enabled = TRUE;

-- Create index for searching users with device tokens (JSONB)
CREATE INDEX IF NOT EXISTS idx_notification_preferences_device_tokens ON user_notification_preferences USING GIN (push_device_tokens);

-- Add trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON user_notification_preferences;
CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Create notification log table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Notification details
    notification_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,  -- email, sms, push, in_app
    title VARCHAR(255) NOT NULL,
    body TEXT,

    -- Delivery status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, sent, delivered, failed, read
    external_message_id VARCHAR(255),
    error_message TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type_channel ON notification_logs(notification_type, channel);

COMMENT ON TABLE user_notification_preferences IS 'Stores user notification preferences and push device tokens';
COMMENT ON TABLE notification_logs IS 'Logs all sent notifications for tracking and analytics';
