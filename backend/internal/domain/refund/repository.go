package refund

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for refund data access
type Repository interface {
	// Create creates a new refund request
	Create(ctx context.Context, refund *RefundRequest) error

	// GetByID retrieves a refund request by its ID
	GetByID(ctx context.Context, id uuid.UUID) (*RefundRequest, error)

	// List retrieves refund requests with pagination
	List(ctx context.Context, offset, limit int) ([]RefundRequest, int64, error)

	// UpdateStatus updates the status of a refund request
	UpdateStatus(ctx context.Context, id uuid.UUID, status RefundStatus, updates map[string]interface{}) error

	// GetPendingRefunds retrieves all pending refund requests
	GetPendingRefunds(ctx context.Context, offset, limit int) ([]RefundRequest, int64, error)

	// GetRefundsByFestival retrieves refund requests for a specific festival
	GetRefundsByFestival(ctx context.Context, festivalID uuid.UUID, status *RefundStatus, offset, limit int) ([]RefundRequest, int64, error)

	// GetRefundsByUser retrieves refund requests for a specific user
	GetRefundsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]RefundRequest, int64, error)

	// GetRefundsByWallet retrieves refund requests for a specific wallet
	GetRefundsByWallet(ctx context.Context, walletID uuid.UUID) ([]RefundRequest, error)

	// Update updates a refund request
	Update(ctx context.Context, refund *RefundRequest) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new refund repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, refund *RefundRequest) error {
	return r.db.WithContext(ctx).Create(refund).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*RefundRequest, error) {
	var refund RefundRequest
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&refund).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get refund request: %w", err)
	}
	return &refund, nil
}

func (r *repository) List(ctx context.Context, offset, limit int) ([]RefundRequest, int64, error) {
	var refunds []RefundRequest
	var total int64

	query := r.db.WithContext(ctx).Model(&RefundRequest{})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count refund requests: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&refunds).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list refund requests: %w", err)
	}

	return refunds, total, nil
}

func (r *repository) UpdateStatus(ctx context.Context, id uuid.UUID, status RefundStatus, updates map[string]interface{}) error {
	if updates == nil {
		updates = make(map[string]interface{})
	}
	updates["status"] = status

	result := r.db.WithContext(ctx).Model(&RefundRequest{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return fmt.Errorf("failed to update refund status: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("refund request not found")
	}
	return nil
}

func (r *repository) GetPendingRefunds(ctx context.Context, offset, limit int) ([]RefundRequest, int64, error) {
	var refunds []RefundRequest
	var total int64

	query := r.db.WithContext(ctx).Model(&RefundRequest{}).Where("status = ?", RefundStatusPending)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count pending refund requests: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at ASC").Find(&refunds).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list pending refund requests: %w", err)
	}

	return refunds, total, nil
}

func (r *repository) GetRefundsByFestival(ctx context.Context, festivalID uuid.UUID, status *RefundStatus, offset, limit int) ([]RefundRequest, int64, error) {
	var refunds []RefundRequest
	var total int64

	query := r.db.WithContext(ctx).Model(&RefundRequest{}).Where("festival_id = ?", festivalID)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count festival refund requests: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&refunds).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list festival refund requests: %w", err)
	}

	return refunds, total, nil
}

func (r *repository) GetRefundsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]RefundRequest, int64, error) {
	var refunds []RefundRequest
	var total int64

	query := r.db.WithContext(ctx).Model(&RefundRequest{}).Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count user refund requests: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&refunds).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list user refund requests: %w", err)
	}

	return refunds, total, nil
}

func (r *repository) GetRefundsByWallet(ctx context.Context, walletID uuid.UUID) ([]RefundRequest, error) {
	var refunds []RefundRequest
	err := r.db.WithContext(ctx).
		Where("wallet_id = ?", walletID).
		Order("created_at DESC").
		Find(&refunds).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get refunds by wallet: %w", err)
	}
	return refunds, nil
}

func (r *repository) Update(ctx context.Context, refund *RefundRequest) error {
	return r.db.WithContext(ctx).Save(refund).Error
}
