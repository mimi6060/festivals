package cache

import (
	"fmt"

	"github.com/google/uuid"
)

// CacheVersion is incremented to invalidate all existing cache entries
// Increment this when making breaking changes to cached data structures
const CacheVersion = "v1"

// Key prefixes for different entity types
const (
	PrefixFestival    = "festival"
	PrefixWallet      = "wallet"
	PrefixUser        = "user"
	PrefixTicket      = "ticket"
	PrefixStand       = "stand"
	PrefixProduct     = "product"
	PrefixLineup      = "lineup"
	PrefixTransaction = "transaction"
	PrefixSession     = "session"
	PrefixStats       = "stats"
)

// KeyBuilder provides methods to build consistent cache keys
type KeyBuilder struct {
	prefix string
}

// NewKeyBuilder creates a new KeyBuilder with an optional application prefix
func NewKeyBuilder(appPrefix string) *KeyBuilder {
	prefix := CacheVersion
	if appPrefix != "" {
		prefix = fmt.Sprintf("%s:%s", appPrefix, CacheVersion)
	}
	return &KeyBuilder{prefix: prefix}
}

// base returns the base key with version prefix
func (k *KeyBuilder) base(parts ...string) string {
	key := k.prefix
	for _, part := range parts {
		key = fmt.Sprintf("%s:%s", key, part)
	}
	return key
}

// --- Festival Keys ---

// FestivalKey returns the cache key for a festival by ID
func (k *KeyBuilder) FestivalKey(id uuid.UUID) string {
	return k.base(PrefixFestival, "id", id.String())
}

// FestivalSlugKey returns the cache key for a festival by slug
func (k *KeyBuilder) FestivalSlugKey(slug string) string {
	return k.base(PrefixFestival, "slug", slug)
}

// FestivalListKey returns the cache key for a paginated festival list
func (k *KeyBuilder) FestivalListKey(page, perPage int) string {
	return k.base(PrefixFestival, "list", fmt.Sprintf("p%d-pp%d", page, perPage))
}

// FestivalPattern returns a pattern to match all festival keys
func (k *KeyBuilder) FestivalPattern() string {
	return k.base(PrefixFestival, "*")
}

// --- Wallet Keys ---

// WalletKey returns the cache key for a wallet by ID
func (k *KeyBuilder) WalletKey(id uuid.UUID) string {
	return k.base(PrefixWallet, "id", id.String())
}

// WalletUserFestivalKey returns the cache key for a wallet by user and festival
func (k *KeyBuilder) WalletUserFestivalKey(userID, festivalID uuid.UUID) string {
	return k.base(PrefixWallet, "user", userID.String(), "festival", festivalID.String())
}

// WalletsByUserKey returns the cache key for all wallets of a user
func (k *KeyBuilder) WalletsByUserKey(userID uuid.UUID) string {
	return k.base(PrefixWallet, "user", userID.String(), "all")
}

// WalletPattern returns a pattern to match all wallet keys for a specific wallet
func (k *KeyBuilder) WalletPattern(walletID uuid.UUID) string {
	return k.base(PrefixWallet, "*", walletID.String(), "*")
}

// WalletUserPattern returns a pattern to match all wallet keys for a user
func (k *KeyBuilder) WalletUserPattern(userID uuid.UUID) string {
	return k.base(PrefixWallet, "user", userID.String(), "*")
}

// --- User Keys ---

// UserKey returns the cache key for a user by ID
func (k *KeyBuilder) UserKey(id uuid.UUID) string {
	return k.base(PrefixUser, "id", id.String())
}

// UserEmailKey returns the cache key for a user by email
func (k *KeyBuilder) UserEmailKey(email string) string {
	return k.base(PrefixUser, "email", email)
}

// UserPattern returns a pattern to match all user keys
func (k *KeyBuilder) UserPattern(userID uuid.UUID) string {
	return k.base(PrefixUser, "*", userID.String(), "*")
}

// --- Ticket Keys ---

// TicketKey returns the cache key for a ticket by ID
func (k *KeyBuilder) TicketKey(id uuid.UUID) string {
	return k.base(PrefixTicket, "id", id.String())
}

// TicketCodeKey returns the cache key for a ticket by code
func (k *KeyBuilder) TicketCodeKey(code string) string {
	return k.base(PrefixTicket, "code", code)
}

// TicketsByFestivalKey returns the cache key for tickets in a festival
func (k *KeyBuilder) TicketsByFestivalKey(festivalID uuid.UUID, page, perPage int) string {
	return k.base(PrefixTicket, "festival", festivalID.String(), fmt.Sprintf("p%d-pp%d", page, perPage))
}

// TicketPattern returns a pattern to match all ticket keys
func (k *KeyBuilder) TicketPattern() string {
	return k.base(PrefixTicket, "*")
}

// --- Stand Keys ---

// StandKey returns the cache key for a stand by ID
func (k *KeyBuilder) StandKey(id uuid.UUID) string {
	return k.base(PrefixStand, "id", id.String())
}

// StandsByFestivalKey returns the cache key for stands in a festival
func (k *KeyBuilder) StandsByFestivalKey(festivalID uuid.UUID) string {
	return k.base(PrefixStand, "festival", festivalID.String(), "all")
}

// StandPattern returns a pattern to match all stand keys for a festival
func (k *KeyBuilder) StandFestivalPattern(festivalID uuid.UUID) string {
	return k.base(PrefixStand, "*", festivalID.String(), "*")
}

// --- Product Keys ---

// ProductKey returns the cache key for a product by ID
func (k *KeyBuilder) ProductKey(id uuid.UUID) string {
	return k.base(PrefixProduct, "id", id.String())
}

// ProductsByStandKey returns the cache key for products in a stand
func (k *KeyBuilder) ProductsByStandKey(standID uuid.UUID) string {
	return k.base(PrefixProduct, "stand", standID.String(), "all")
}

// ProductPattern returns a pattern to match all product keys for a stand
func (k *KeyBuilder) ProductStandPattern(standID uuid.UUID) string {
	return k.base(PrefixProduct, "*", standID.String(), "*")
}

// --- Lineup Keys ---

// LineupKey returns the cache key for a lineup entry by ID
func (k *KeyBuilder) LineupKey(id uuid.UUID) string {
	return k.base(PrefixLineup, "id", id.String())
}

// LineupByFestivalKey returns the cache key for lineup entries in a festival
func (k *KeyBuilder) LineupByFestivalKey(festivalID uuid.UUID) string {
	return k.base(PrefixLineup, "festival", festivalID.String(), "all")
}

// LineupPattern returns a pattern to match all lineup keys for a festival
func (k *KeyBuilder) LineupFestivalPattern(festivalID uuid.UUID) string {
	return k.base(PrefixLineup, "*", festivalID.String(), "*")
}

// --- Transaction Keys ---

// TransactionKey returns the cache key for a transaction by ID
func (k *KeyBuilder) TransactionKey(id uuid.UUID) string {
	return k.base(PrefixTransaction, "id", id.String())
}

// TransactionsByWalletKey returns the cache key for transactions in a wallet
func (k *KeyBuilder) TransactionsByWalletKey(walletID uuid.UUID, page, perPage int) string {
	return k.base(PrefixTransaction, "wallet", walletID.String(), fmt.Sprintf("p%d-pp%d", page, perPage))
}

// TransactionWalletPattern returns a pattern to match all transaction keys for a wallet
func (k *KeyBuilder) TransactionWalletPattern(walletID uuid.UUID) string {
	return k.base(PrefixTransaction, "*", walletID.String(), "*")
}

// --- Session Keys ---

// SessionKey returns the cache key for a user session
func (k *KeyBuilder) SessionKey(sessionID string) string {
	return k.base(PrefixSession, sessionID)
}

// UserSessionsKey returns the cache key for all sessions of a user
func (k *KeyBuilder) UserSessionsKey(userID uuid.UUID) string {
	return k.base(PrefixSession, "user", userID.String(), "all")
}

// SessionPattern returns a pattern to match all sessions for a user
func (k *KeyBuilder) SessionUserPattern(userID uuid.UUID) string {
	return k.base(PrefixSession, "*", userID.String(), "*")
}

// --- Stats Keys ---

// FestivalStatsKey returns the cache key for festival statistics
func (k *KeyBuilder) FestivalStatsKey(festivalID uuid.UUID) string {
	return k.base(PrefixStats, "festival", festivalID.String())
}

// StandStatsKey returns the cache key for stand statistics
func (k *KeyBuilder) StandStatsKey(standID uuid.UUID) string {
	return k.base(PrefixStats, "stand", standID.String())
}

// DailyStatsKey returns the cache key for daily statistics
func (k *KeyBuilder) DailyStatsKey(festivalID uuid.UUID, date string) string {
	return k.base(PrefixStats, "daily", festivalID.String(), date)
}

// StatsPattern returns a pattern to match all stats keys for a festival
func (k *KeyBuilder) StatsFestivalPattern(festivalID uuid.UUID) string {
	return k.base(PrefixStats, "*", festivalID.String(), "*")
}

// --- Helper Functions ---

// DefaultKeyBuilder returns a KeyBuilder with the default "festivals" prefix
var DefaultKeyBuilder = NewKeyBuilder("festivals")

// Convenience functions using the default key builder

func FestivalKey(id uuid.UUID) string {
	return DefaultKeyBuilder.FestivalKey(id)
}

func FestivalSlugKey(slug string) string {
	return DefaultKeyBuilder.FestivalSlugKey(slug)
}

func WalletKey(id uuid.UUID) string {
	return DefaultKeyBuilder.WalletKey(id)
}

func WalletUserFestivalKey(userID, festivalID uuid.UUID) string {
	return DefaultKeyBuilder.WalletUserFestivalKey(userID, festivalID)
}

func UserKey(id uuid.UUID) string {
	return DefaultKeyBuilder.UserKey(id)
}

func TicketKey(id uuid.UUID) string {
	return DefaultKeyBuilder.TicketKey(id)
}

func SessionKey(sessionID string) string {
	return DefaultKeyBuilder.SessionKey(sessionID)
}
