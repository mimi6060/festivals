package stand

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository interface {
	// Stand operations
	Create(ctx context.Context, stand *Stand) error
	GetByID(ctx context.Context, id uuid.UUID) (*Stand, error)
	ListByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Stand, int64, error)
	ListByCategory(ctx context.Context, festivalID uuid.UUID, category StandCategory) ([]Stand, error)
	Update(ctx context.Context, stand *Stand) error
	Delete(ctx context.Context, id uuid.UUID) error

	// Staff operations
	AssignStaff(ctx context.Context, staff *StandStaff) error
	RemoveStaff(ctx context.Context, standID, userID uuid.UUID) error
	GetStaffByStand(ctx context.Context, standID uuid.UUID) ([]StandStaff, error)
	GetStaffByUser(ctx context.Context, userID uuid.UUID) ([]StandStaff, error)
	GetStaffMember(ctx context.Context, standID, userID uuid.UUID) (*StandStaff, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, stand *Stand) error {
	return r.db.WithContext(ctx).Create(stand).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*Stand, error) {
	var stand Stand
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&stand).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get stand: %w", err)
	}
	return &stand, nil
}

func (r *repository) ListByFestival(ctx context.Context, festivalID uuid.UUID, offset, limit int) ([]Stand, int64, error) {
	var stands []Stand
	var total int64

	query := r.db.WithContext(ctx).Model(&Stand{}).Where("festival_id = ?", festivalID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count stands: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("name ASC").Find(&stands).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list stands: %w", err)
	}

	return stands, total, nil
}

func (r *repository) ListByCategory(ctx context.Context, festivalID uuid.UUID, category StandCategory) ([]Stand, error) {
	var stands []Stand
	err := r.db.WithContext(ctx).
		Where("festival_id = ? AND category = ? AND status = ?", festivalID, category, StandStatusActive).
		Order("name ASC").
		Find(&stands).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list stands by category: %w", err)
	}
	return stands, nil
}

func (r *repository) Update(ctx context.Context, stand *Stand) error {
	return r.db.WithContext(ctx).Save(stand).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&Stand{}).Error
}

func (r *repository) AssignStaff(ctx context.Context, staff *StandStaff) error {
	return r.db.WithContext(ctx).Create(staff).Error
}

func (r *repository) RemoveStaff(ctx context.Context, standID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("stand_id = ? AND user_id = ?", standID, userID).
		Delete(&StandStaff{}).Error
}

func (r *repository) GetStaffByStand(ctx context.Context, standID uuid.UUID) ([]StandStaff, error) {
	var staff []StandStaff
	err := r.db.WithContext(ctx).
		Where("stand_id = ?", standID).
		Find(&staff).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get stand staff: %w", err)
	}
	return staff, nil
}

func (r *repository) GetStaffByUser(ctx context.Context, userID uuid.UUID) ([]StandStaff, error) {
	var staff []StandStaff
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Find(&staff).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get user stands: %w", err)
	}
	return staff, nil
}

func (r *repository) GetStaffMember(ctx context.Context, standID, userID uuid.UUID) (*StandStaff, error) {
	var staff StandStaff
	err := r.db.WithContext(ctx).
		Where("stand_id = ? AND user_id = ?", standID, userID).
		First(&staff).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get staff member: %w", err)
	}
	return &staff, nil
}
