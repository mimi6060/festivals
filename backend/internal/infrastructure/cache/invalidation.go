package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// InvalidationChannel is the Redis pub/sub channel for cache invalidation messages
const InvalidationChannel = "cache:invalidation"

// InvalidationMessage represents a cache invalidation event
type InvalidationMessage struct {
	Type      InvalidationType `json:"type"`
	Keys      []string         `json:"keys,omitempty"`
	Pattern   string           `json:"pattern,omitempty"`
	Timestamp int64            `json:"timestamp"`
	Source    string           `json:"source,omitempty"` // Identifier of the source instance
}

// InvalidationType defines the type of invalidation
type InvalidationType string

const (
	InvalidationTypeKeys    InvalidationType = "keys"
	InvalidationTypePattern InvalidationType = "pattern"
)

// Invalidator handles cache invalidation including distributed invalidation via pub/sub
type Invalidator struct {
	cache      Cacher
	client     *redis.Client
	keyBuilder *KeyBuilder
	instanceID string
	pubsub     *redis.PubSub
	handlers   []InvalidationHandler
	mu         sync.RWMutex
	running    bool
}

// InvalidationHandler is a function that handles invalidation events
type InvalidationHandler func(ctx context.Context, msg InvalidationMessage)

// NewInvalidator creates a new Invalidator
func NewInvalidator(cache Cacher, instanceID string) *Invalidator {
	var client *redis.Client
	if c, ok := cache.(*RedisCache); ok {
		client = c.GetClient()
	}

	return &Invalidator{
		cache:      cache,
		client:     client,
		keyBuilder: DefaultKeyBuilder,
		instanceID: instanceID,
		handlers:   make([]InvalidationHandler, 0),
	}
}

// Delete removes specific keys from cache and publishes invalidation message
func (i *Invalidator) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}

	// Delete locally
	if err := i.cache.Delete(ctx, keys...); err != nil {
		log.Warn().Err(err).Strs("keys", keys).Msg("failed to delete cache keys")
	}

	// Publish invalidation message for distributed invalidation
	return i.publish(ctx, InvalidationMessage{
		Type:      InvalidationTypeKeys,
		Keys:      keys,
		Timestamp: time.Now().UnixNano(),
		Source:    i.instanceID,
	})
}

// InvalidatePattern deletes all keys matching a pattern
func (i *Invalidator) InvalidatePattern(ctx context.Context, pattern string) error {
	if i.client == nil {
		return nil
	}

	// Use SCAN to find keys matching the pattern
	var cursor uint64
	var keysToDelete []string

	for {
		keys, nextCursor, err := i.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("failed to scan keys: %w", err)
		}

		keysToDelete = append(keysToDelete, keys...)
		cursor = nextCursor

		if cursor == 0 {
			break
		}
	}

	// Delete found keys
	if len(keysToDelete) > 0 {
		if err := i.cache.Delete(ctx, keysToDelete...); err != nil {
			log.Warn().Err(err).Str("pattern", pattern).Msg("failed to delete keys matching pattern")
		}
		log.Debug().Str("pattern", pattern).Int("count", len(keysToDelete)).Msg("invalidated keys by pattern")
	}

	// Publish invalidation message for distributed invalidation
	return i.publish(ctx, InvalidationMessage{
		Type:      InvalidationTypePattern,
		Pattern:   pattern,
		Timestamp: time.Now().UnixNano(),
		Source:    i.instanceID,
	})
}

// InvalidateFestival invalidates all cache entries related to a festival
func (i *Invalidator) InvalidateFestival(ctx context.Context, festivalID string) error {
	pattern := i.keyBuilder.base(PrefixFestival, "*", festivalID, "*")
	return i.InvalidatePattern(ctx, pattern)
}

// InvalidateWallet invalidates all cache entries related to a wallet
func (i *Invalidator) InvalidateWallet(ctx context.Context, walletID string) error {
	pattern := i.keyBuilder.base(PrefixWallet, "*", walletID, "*")
	return i.InvalidatePattern(ctx, pattern)
}

// InvalidateUser invalidates all cache entries related to a user
func (i *Invalidator) InvalidateUser(ctx context.Context, userID string) error {
	patterns := []string{
		i.keyBuilder.base(PrefixUser, "*", userID, "*"),
		i.keyBuilder.base(PrefixWallet, "user", userID, "*"),
		i.keyBuilder.base(PrefixSession, "user", userID, "*"),
	}

	for _, pattern := range patterns {
		if err := i.InvalidatePattern(ctx, pattern); err != nil {
			return err
		}
	}
	return nil
}

// publish publishes an invalidation message to the pub/sub channel
func (i *Invalidator) publish(ctx context.Context, msg InvalidationMessage) error {
	if i.client == nil {
		return nil
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal invalidation message: %w", err)
	}

	if err := i.client.Publish(ctx, InvalidationChannel, string(data)).Err(); err != nil {
		return fmt.Errorf("failed to publish invalidation message: %w", err)
	}

	return nil
}

// AddHandler adds a handler for invalidation events
func (i *Invalidator) AddHandler(handler InvalidationHandler) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.handlers = append(i.handlers, handler)
}

// StartSubscriber starts listening for invalidation messages
func (i *Invalidator) StartSubscriber(ctx context.Context) error {
	if i.client == nil {
		return fmt.Errorf("redis client not available")
	}

	i.mu.Lock()
	if i.running {
		i.mu.Unlock()
		return nil
	}
	i.running = true
	i.mu.Unlock()

	i.pubsub = i.client.Subscribe(ctx, InvalidationChannel)

	// Wait for subscription confirmation
	_, err := i.pubsub.Receive(ctx)
	if err != nil {
		return fmt.Errorf("failed to subscribe to invalidation channel: %w", err)
	}

	log.Info().Str("channel", InvalidationChannel).Msg("started cache invalidation subscriber")

	go i.listen(ctx)

	return nil
}

// listen processes incoming invalidation messages
func (i *Invalidator) listen(ctx context.Context) {
	ch := i.pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("stopping cache invalidation subscriber")
			return
		case msg, ok := <-ch:
			if !ok {
				log.Info().Msg("invalidation channel closed")
				return
			}
			i.handleMessage(ctx, msg)
		}
	}
}

// handleMessage processes a single invalidation message
func (i *Invalidator) handleMessage(ctx context.Context, msg *redis.Message) {
	var invMsg InvalidationMessage
	if err := json.Unmarshal([]byte(msg.Payload), &invMsg); err != nil {
		log.Warn().Err(err).Str("payload", msg.Payload).Msg("failed to unmarshal invalidation message")
		return
	}

	// Skip messages from ourselves
	if invMsg.Source == i.instanceID {
		return
	}

	log.Debug().
		Str("type", string(invMsg.Type)).
		Str("source", invMsg.Source).
		Msg("received invalidation message")

	// Process the invalidation locally
	switch invMsg.Type {
	case InvalidationTypeKeys:
		if len(invMsg.Keys) > 0 {
			if err := i.cache.Delete(ctx, invMsg.Keys...); err != nil {
				log.Warn().Err(err).Strs("keys", invMsg.Keys).Msg("failed to delete keys from invalidation message")
			}
		}
	case InvalidationTypePattern:
		if invMsg.Pattern != "" {
			// Re-scan and delete locally without re-publishing
			if i.client != nil {
				var cursor uint64
				var keysToDelete []string
				for {
					keys, nextCursor, err := i.client.Scan(ctx, cursor, invMsg.Pattern, 100).Result()
					if err != nil {
						log.Warn().Err(err).Str("pattern", invMsg.Pattern).Msg("failed to scan keys")
						break
					}
					keysToDelete = append(keysToDelete, keys...)
					cursor = nextCursor
					if cursor == 0 {
						break
					}
				}
				if len(keysToDelete) > 0 {
					if err := i.cache.Delete(ctx, keysToDelete...); err != nil {
						log.Warn().Err(err).Str("pattern", invMsg.Pattern).Msg("failed to delete keys")
					}
				}
			}
		}
	}

	// Call registered handlers
	i.mu.RLock()
	handlers := make([]InvalidationHandler, len(i.handlers))
	copy(handlers, i.handlers)
	i.mu.RUnlock()

	for _, handler := range handlers {
		handler(ctx, invMsg)
	}
}

// Stop stops the invalidation subscriber
func (i *Invalidator) Stop() error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if !i.running {
		return nil
	}

	i.running = false

	if i.pubsub != nil {
		return i.pubsub.Close()
	}

	return nil
}

// BatchInvalidator allows batching multiple invalidations together
type BatchInvalidator struct {
	invalidator *Invalidator
	keys        []string
	patterns    []string
	mu          sync.Mutex
}

// NewBatchInvalidator creates a new BatchInvalidator
func NewBatchInvalidator(inv *Invalidator) *BatchInvalidator {
	return &BatchInvalidator{
		invalidator: inv,
		keys:        make([]string, 0),
		patterns:    make([]string, 0),
	}
}

// AddKey adds a key to the batch
func (b *BatchInvalidator) AddKey(key string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.keys = append(b.keys, key)
}

// AddKeys adds multiple keys to the batch
func (b *BatchInvalidator) AddKeys(keys ...string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.keys = append(b.keys, keys...)
}

// AddPattern adds a pattern to the batch
func (b *BatchInvalidator) AddPattern(pattern string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.patterns = append(b.patterns, pattern)
}

// Execute executes all batched invalidations
func (b *BatchInvalidator) Execute(ctx context.Context) error {
	b.mu.Lock()
	keys := make([]string, len(b.keys))
	patterns := make([]string, len(b.patterns))
	copy(keys, b.keys)
	copy(patterns, b.patterns)
	b.keys = b.keys[:0]
	b.patterns = b.patterns[:0]
	b.mu.Unlock()

	var lastErr error

	if len(keys) > 0 {
		if err := b.invalidator.Delete(ctx, keys...); err != nil {
			lastErr = err
		}
	}

	for _, pattern := range patterns {
		if err := b.invalidator.InvalidatePattern(ctx, pattern); err != nil {
			lastErr = err
		}
	}

	return lastErr
}

// Reset clears the batch without executing
func (b *BatchInvalidator) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.keys = b.keys[:0]
	b.patterns = b.patterns[:0]
}
