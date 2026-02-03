package user

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for user data access
type Repository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByAuth0ID(ctx context.Context, auth0ID string) (*User, error)
	List(ctx context.Context, offset, limit int) ([]User, int64, error)
	ListByRole(ctx context.Context, role UserRole, offset, limit int) ([]User, int64, error)
	Search(ctx context.Context, query string, offset, limit int) ([]User, int64, error)
	Update(ctx context.Context, user *User) error
	Delete(ctx context.Context, id uuid.UUID) error
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByAuth0ID(ctx context.Context, auth0ID string) (bool, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new user repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) Create(ctx context.Context, user *User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var user User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (r *repository) GetByEmail(ctx context.Context, email string) (*User, error) {
	var user User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return &user, nil
}

func (r *repository) GetByAuth0ID(ctx context.Context, auth0ID string) (*User, error) {
	var user User
	err := r.db.WithContext(ctx).Where("auth0_id = ?", auth0ID).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user by auth0 ID: %w", err)
	}
	return &user, nil
}

func (r *repository) List(ctx context.Context, offset, limit int) ([]User, int64, error) {
	var users []User
	var total int64

	query := r.db.WithContext(ctx).Model(&User{})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}

	return users, total, nil
}

func (r *repository) ListByRole(ctx context.Context, role UserRole, offset, limit int) ([]User, int64, error) {
	var users []User
	var total int64

	query := r.db.WithContext(ctx).Model(&User{}).Where("role = ?", role)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count users by role: %w", err)
	}

	if err := query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list users by role: %w", err)
	}

	return users, total, nil
}

func (r *repository) Search(ctx context.Context, query string, offset, limit int) ([]User, int64, error) {
	var users []User
	var total int64

	searchPattern := "%" + query + "%"
	dbQuery := r.db.WithContext(ctx).Model(&User{}).
		Where("name ILIKE ? OR email ILIKE ?", searchPattern, searchPattern)

	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	if err := dbQuery.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to search users: %w", err)
	}

	return users, total, nil
}

func (r *repository) Update(ctx context.Context, user *User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *repository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&User{}).Error
}

func (r *repository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&User{}).Where("email = ?", email).Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("failed to check email existence: %w", err)
	}
	return count > 0, nil
}

func (r *repository) ExistsByAuth0ID(ctx context.Context, auth0ID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&User{}).Where("auth0_id = ?", auth0ID).Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("failed to check auth0 ID existence: %w", err)
	}
	return count > 0, nil
}
