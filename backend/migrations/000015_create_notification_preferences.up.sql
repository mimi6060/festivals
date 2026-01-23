-- Create user notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,

    -- Global channel toggles
    global_email_enabled BOOLEAN DEFAULT TRUE,
    global_sms_enabled BOOLEAN DEFAULT TRUE,
    global_push_enabled BOOLEAN DEFAULT TRUE,
    global_in_app_enabled BOOLEAN DEFAULT TRUE,

    -- Quiet hours settings
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start VARCHAR(5) DEFAULT '22:00',
    quiet_hours_end VARCHAR(5) DEFAULT '08:00',
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Marketing preferences
    marketing_enabled BOOLEAN DEFAULT FALSE,
    weekly_digest_enabled BOOLEAN DEFAULT FALSE,

    -- Language preference
    preferred_language VARCHAR(10) DEFAULT 'en',

    -- Channel preferences per event type (JSONB)
    channel_preferences JSONB DEFAULT '{}'::jsonb,

    -- Push notification device tokens (JSONB array)
    push_device_tokens JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraint
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for user notification preferences
CREATE INDEX idx_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_global_push ON user_notification_preferences(global_push_enabled) WHERE global_push_enabled = TRUE;
CREATE INDEX idx_notification_preferences_global_email ON user_notification_preferences(global_email_enabled) WHERE global_email_enabled = TRUE;
CREATE INDEX idx_notification_preferences_global_sms ON user_notification_preferences(global_sms_enabled) WHERE global_sms_enabled = TRUE;

-- Create index for querying users with device tokens
CREATE INDEX idx_notification_preferences_has_tokens ON user_notification_preferences
    USING GIN (push_device_tokens jsonb_path_ops)
    WHERE jsonb_array_length(push_device_tokens) > 0;

-- Create push topic subscriptions table
CREATE TABLE IF NOT EXISTS push_topic_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(500) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraint
    CONSTRAINT fk_topic_subscriptions_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,

    -- Unique constraint for user-token-topic combination
    CONSTRAINT uq_topic_subscription UNIQUE (user_id, token, topic)
);

-- Create indexes for topic subscriptions
CREATE INDEX idx_topic_subscriptions_user_id ON push_topic_subscriptions(user_id);
CREATE INDEX idx_topic_subscriptions_topic ON push_topic_subscriptions(topic);
CREATE INDEX idx_topic_subscriptions_token ON push_topic_subscriptions(token);
CREATE INDEX idx_topic_subscriptions_platform ON push_topic_subscriptions(platform);

-- Create push notification logs table
CREATE TABLE IF NOT EXISTS push_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    festival_id UUID,
    token VARCHAR(500),
    platform VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    message_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING',
    error TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_push_logs_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_push_logs_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE SET NULL
);

-- Create indexes for push notification logs
CREATE INDEX idx_push_logs_user_id ON push_notification_logs(user_id);
CREATE INDEX idx_push_logs_festival_id ON push_notification_logs(festival_id);
CREATE INDEX idx_push_logs_status ON push_notification_logs(status);
CREATE INDEX idx_push_logs_platform ON push_notification_logs(platform);
CREATE INDEX idx_push_logs_created_at ON push_notification_logs(created_at);
CREATE INDEX idx_push_logs_message_id ON push_notification_logs(message_id);

-- Composite indexes for common queries
CREATE INDEX idx_push_logs_user_status ON push_notification_logs(user_id, status);
CREATE INDEX idx_push_logs_festival_created ON push_notification_logs(festival_id, created_at DESC);

-- Create in-app notifications table
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    festival_id UUID,
    type VARCHAR(20) NOT NULL DEFAULT 'toast',
    title VARCHAR(255) NOT NULL,
    body TEXT,
    action_url VARCHAR(500),
    action_text VARCHAR(100),
    image_url VARCHAR(500),
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_in_app_notifications_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_in_app_notifications_festival FOREIGN KEY (festival_id)
        REFERENCES festivals(id) ON DELETE CASCADE
);

-- Create indexes for in-app notifications
CREATE INDEX idx_in_app_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX idx_in_app_notifications_festival_id ON in_app_notifications(festival_id);
CREATE INDEX idx_in_app_notifications_read ON in_app_notifications(read);
CREATE INDEX idx_in_app_notifications_created_at ON in_app_notifications(created_at);
CREATE INDEX idx_in_app_notifications_expires_at ON in_app_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Composite indexes for fetching unread notifications
CREATE INDEX idx_in_app_notifications_user_unread ON in_app_notifications(user_id, created_at DESC)
    WHERE read = FALSE AND dismissed = FALSE;
CREATE INDEX idx_in_app_notifications_user_festival ON in_app_notifications(user_id, festival_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE user_notification_preferences IS 'Stores user notification preferences including channel settings, quiet hours, and device tokens';
COMMENT ON COLUMN user_notification_preferences.channel_preferences IS 'JSONB object mapping event types to channel preferences (email, sms, push, in_app)';
COMMENT ON COLUMN user_notification_preferences.push_device_tokens IS 'JSONB array of device tokens for push notifications with platform and metadata';
COMMENT ON COLUMN user_notification_preferences.quiet_hours_start IS 'Quiet hours start time in HH:MM format in user timezone';
COMMENT ON COLUMN user_notification_preferences.quiet_hours_end IS 'Quiet hours end time in HH:MM format in user timezone';

COMMENT ON TABLE push_topic_subscriptions IS 'Stores FCM topic subscriptions for push notifications';
COMMENT ON COLUMN push_topic_subscriptions.platform IS 'Push platform: fcm, apns, web';

COMMENT ON TABLE push_notification_logs IS 'Stores push notification delivery logs';
COMMENT ON COLUMN push_notification_logs.status IS 'Delivery status: PENDING, SENT, DELIVERED, FAILED';

COMMENT ON TABLE in_app_notifications IS 'Stores in-app notifications shown to users';
COMMENT ON COLUMN in_app_notifications.type IS 'Notification type: toast, banner, modal';
