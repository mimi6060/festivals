package stand

import (
	"time"

	"github.com/google/uuid"
)

// Stand represents a point of sale at a festival
type Stand struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	FestivalID  uuid.UUID    `json:"festivalId" gorm:"type:uuid;not null;index"`
	Name        string       `json:"name" gorm:"not null"`
	Description string       `json:"description"`
	Category    StandCategory `json:"category" gorm:"not null"`
	Location    string       `json:"location"` // Physical location/zone in festival
	ImageURL    string       `json:"imageUrl,omitempty"`
	Status      StandStatus  `json:"status" gorm:"default:'ACTIVE'"`
	Settings    StandSettings `json:"settings" gorm:"type:jsonb;default:'{}'"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

func (Stand) TableName() string {
	return "stands"
}

type StandCategory string

const (
	StandCategoryBar         StandCategory = "BAR"
	StandCategoryFood        StandCategory = "FOOD"
	StandCategoryMerchandise StandCategory = "MERCHANDISE"
	StandCategoryTickets     StandCategory = "TICKETS"
	StandCategoryTopUp       StandCategory = "TOP_UP"
	StandCategoryOther       StandCategory = "OTHER"
)

type StandStatus string

const (
	StandStatusActive   StandStatus = "ACTIVE"
	StandStatusInactive StandStatus = "INACTIVE"
	StandStatusClosed   StandStatus = "CLOSED"
)

type StandSettings struct {
	AcceptsOnlyTokens bool   `json:"acceptsOnlyTokens"` // Only accepts festival tokens
	RequiresPIN       bool   `json:"requiresPin"`       // Staff must enter PIN for transactions
	PrintReceipts     bool   `json:"printReceipts"`     // Print physical receipts
	Color             string `json:"color,omitempty"`   // UI color for the stand
}

// StandStaff represents staff assigned to a stand
type StandStaff struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	StandID   uuid.UUID `json:"standId" gorm:"type:uuid;not null;index"`
	UserID    uuid.UUID `json:"userId" gorm:"type:uuid;not null;index"`
	Role      StaffRole `json:"role" gorm:"not null"`
	PIN       string    `json:"-" gorm:"column:pin_hash"` // Hashed PIN for transactions
	CreatedAt time.Time `json:"createdAt"`
}

func (StandStaff) TableName() string {
	return "stand_staff"
}

type StaffRole string

const (
	StaffRoleManager  StaffRole = "MANAGER"
	StaffRoleCashier  StaffRole = "CASHIER"
	StaffRoleAssistant StaffRole = "ASSISTANT"
)

// CreateStandRequest represents the request to create a stand
type CreateStandRequest struct {
	Name        string        `json:"name" binding:"required"`
	Description string        `json:"description"`
	Category    StandCategory `json:"category" binding:"required"`
	Location    string        `json:"location"`
	ImageURL    string        `json:"imageUrl"`
	Settings    *StandSettings `json:"settings"`
}

// UpdateStandRequest represents the request to update a stand
type UpdateStandRequest struct {
	Name        *string        `json:"name,omitempty"`
	Description *string        `json:"description,omitempty"`
	Category    *StandCategory `json:"category,omitempty"`
	Location    *string        `json:"location,omitempty"`
	ImageURL    *string        `json:"imageUrl,omitempty"`
	Status      *StandStatus   `json:"status,omitempty"`
	Settings    *StandSettings `json:"settings,omitempty"`
}

// AssignStaffRequest represents the request to assign staff to a stand
type AssignStaffRequest struct {
	UserID uuid.UUID `json:"userId" binding:"required"`
	Role   StaffRole `json:"role" binding:"required"`
	PIN    string    `json:"pin"` // Optional PIN (4-6 digits)
}

// StandResponse represents the API response for a stand
type StandResponse struct {
	ID          uuid.UUID     `json:"id"`
	FestivalID  uuid.UUID     `json:"festivalId"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Category    StandCategory `json:"category"`
	Location    string        `json:"location"`
	ImageURL    string        `json:"imageUrl,omitempty"`
	Status      StandStatus   `json:"status"`
	Settings    StandSettings `json:"settings"`
	StaffCount  int           `json:"staffCount,omitempty"`
	CreatedAt   string        `json:"createdAt"`
	UpdatedAt   string        `json:"updatedAt"`
}

func (s *Stand) ToResponse() StandResponse {
	return StandResponse{
		ID:          s.ID,
		FestivalID:  s.FestivalID,
		Name:        s.Name,
		Description: s.Description,
		Category:    s.Category,
		Location:    s.Location,
		ImageURL:    s.ImageURL,
		Status:      s.Status,
		Settings:    s.Settings,
		CreatedAt:   s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   s.UpdatedAt.Format(time.RFC3339),
	}
}

// StandStaffResponse represents the API response for stand staff
type StandStaffResponse struct {
	ID        uuid.UUID `json:"id"`
	StandID   uuid.UUID `json:"standId"`
	UserID    uuid.UUID `json:"userId"`
	Role      StaffRole `json:"role"`
	CreatedAt string    `json:"createdAt"`
}

func (ss *StandStaff) ToResponse() StandStaffResponse {
	return StandStaffResponse{
		ID:        ss.ID,
		StandID:   ss.StandID,
		UserID:    ss.UserID,
		Role:      ss.Role,
		CreatedAt: ss.CreatedAt.Format(time.RFC3339),
	}
}
