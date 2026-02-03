package helpers

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/auth"
	"github.com/mimi6060/festivals/backend/internal/domain/festival"
	"github.com/mimi6060/festivals/backend/internal/domain/order"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/stand"
	"github.com/mimi6060/festivals/backend/internal/domain/user"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"gorm.io/gorm"
)

// ============================================================================
// Pointer helpers
// ============================================================================

// StringPtr returns a pointer to a string
func StringPtr(s string) *string {
	return &s
}

// Float64Ptr returns a pointer to a float64
func Float64Ptr(f float64) *float64 {
	return &f
}

// IntPtr returns a pointer to an int
func IntPtr(i int) *int {
	return &i
}

// Int64Ptr returns a pointer to an int64
func Int64Ptr(i int64) *int64 {
	return &i
}

// TimePtr returns a pointer to a time.Time
func TimePtr(t time.Time) *time.Time {
	return &t
}

// UUIDPtr returns a pointer to a uuid.UUID
func UUIDPtr(u uuid.UUID) *uuid.UUID {
	return &u
}

// BoolPtr returns a pointer to a bool
func BoolPtr(b bool) *bool {
	return &b
}

// ============================================================================
// User fixtures
// ============================================================================

// UserOptions allows customizing test user creation
type UserOptions struct {
	Email   *string
	Name    *string
	Phone   *string
	Role    *user.UserRole
	Auth0ID *string
	Status  *user.UserStatus
}

// CreateTestUser creates a user for testing
func CreateTestUser(t *testing.T, db *gorm.DB, opts *UserOptions) *user.User {
	t.Helper()

	id := uuid.New()
	email := "test-" + id.String()[:8] + "@example.com"
	name := "Test User"
	role := user.UserRoleUser
	auth0ID := "auth0|" + id.String()
	status := user.UserStatusActive

	if opts != nil {
		if opts.Email != nil {
			email = *opts.Email
		}
		if opts.Name != nil {
			name = *opts.Name
		}
		if opts.Role != nil {
			role = *opts.Role
		}
		if opts.Auth0ID != nil {
			auth0ID = *opts.Auth0ID
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	u := &user.User{
		ID:        id,
		Email:     email,
		Name:      name,
		Role:      role,
		Auth0ID:   auth0ID,
		Status:    status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if opts != nil && opts.Phone != nil {
		u.Phone = *opts.Phone
	}

	if err := db.Create(u).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	return u
}

// CreateTestAdmin creates an admin user for testing
func CreateTestAdmin(t *testing.T, db *gorm.DB) *user.User {
	t.Helper()
	role := user.UserRoleAdmin
	return CreateTestUser(t, db, &UserOptions{
		Name: StringPtr("Test Admin"),
		Role: &role,
	})
}

// CreateTestStaff creates a staff user for testing
func CreateTestStaff(t *testing.T, db *gorm.DB) *user.User {
	t.Helper()
	role := user.UserRoleStaff
	return CreateTestUser(t, db, &UserOptions{
		Name: StringPtr("Test Staff"),
		Role: &role,
	})
}

// ============================================================================
// Festival fixtures
// ============================================================================

// FestivalOptions allows customizing test festival creation
type FestivalOptions struct {
	Name         *string
	Description  *string
	StartDate    *time.Time
	EndDate      *time.Time
	Location     *string
	Timezone     *string
	CurrencyName *string
	ExchangeRate *float64
	Status       *festival.FestivalStatus
	CreatedBy    *uuid.UUID
}

// CreateTestFestival creates a festival for testing
func CreateTestFestival(t *testing.T, db *gorm.DB, opts *FestivalOptions) *festival.Festival {
	t.Helper()

	id := uuid.New()
	name := "Test Festival"
	description := "Test festival description"
	startDate := time.Now().AddDate(0, 1, 0)
	endDate := time.Now().AddDate(0, 1, 3)
	location := "Test Location"
	timezone := "Europe/Brussels"
	currencyName := "Jetons"
	exchangeRate := 0.10
	status := festival.FestivalStatusDraft

	if opts != nil {
		if opts.Name != nil {
			name = *opts.Name
		}
		if opts.Description != nil {
			description = *opts.Description
		}
		if opts.StartDate != nil {
			startDate = *opts.StartDate
		}
		if opts.EndDate != nil {
			endDate = *opts.EndDate
		}
		if opts.Location != nil {
			location = *opts.Location
		}
		if opts.Timezone != nil {
			timezone = *opts.Timezone
		}
		if opts.CurrencyName != nil {
			currencyName = *opts.CurrencyName
		}
		if opts.ExchangeRate != nil {
			exchangeRate = *opts.ExchangeRate
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	slug := slugify(name) + "-" + id.String()[:8]

	f := &festival.Festival{
		ID:           id,
		Name:         name,
		Slug:         slug,
		Description:  description,
		StartDate:    startDate,
		EndDate:      endDate,
		Location:     location,
		Timezone:     timezone,
		CurrencyName: currencyName,
		ExchangeRate: exchangeRate,
		Settings: festival.FestivalSettings{
			RefundPolicy:  "manual",
			ReentryPolicy: "single",
		},
		Status:    status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if opts != nil && opts.CreatedBy != nil {
		f.CreatedBy = opts.CreatedBy
	}

	if err := db.Create(f).Error; err != nil {
		t.Fatalf("Failed to create test festival: %v", err)
	}

	return f
}

// CreateActiveFestival creates an active festival for testing
func CreateActiveFestival(t *testing.T, db *gorm.DB, createdBy *uuid.UUID) *festival.Festival {
	t.Helper()
	status := festival.FestivalStatusActive
	return CreateTestFestival(t, db, &FestivalOptions{
		Status:    &status,
		CreatedBy: createdBy,
	})
}

// ============================================================================
// Stand fixtures
// ============================================================================

// StandOptions allows customizing test stand creation
type StandOptions struct {
	Name        *string
	Description *string
	Category    *string
	Location    *string
	Status      *stand.StandStatus
}

// CreateTestStand creates a stand for testing
func CreateTestStand(t *testing.T, db *gorm.DB, festivalID uuid.UUID, opts *StandOptions) *stand.Stand {
	t.Helper()

	id := uuid.New()
	name := "Test Stand"
	description := "Test stand description"
	category := stand.StandCategoryFood
	location := "Zone A"
	status := stand.StandStatusActive

	if opts != nil {
		if opts.Name != nil {
			name = *opts.Name
		}
		if opts.Description != nil {
			description = *opts.Description
		}
		if opts.Category != nil {
			category = stand.StandCategory(*opts.Category)
		}
		if opts.Location != nil {
			location = *opts.Location
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	s := &stand.Stand{
		ID:          id,
		FestivalID:  festivalID,
		Name:        name,
		Description: description,
		Category:    category,
		Location:    location,
		Status:      status,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := db.Create(s).Error; err != nil {
		t.Fatalf("Failed to create test stand: %v", err)
	}

	return s
}

// ============================================================================
// Product fixtures
// ============================================================================

// ProductOptions allows customizing test product creation
type ProductOptions struct {
	Name        *string
	Description *string
	Price       *int64
	Category    *string
	Stock       *int
	Status      *product.ProductStatus
}

// CreateTestProduct creates a product for testing
func CreateTestProduct(t *testing.T, db *gorm.DB, standID uuid.UUID, opts *ProductOptions) *product.Product {
	t.Helper()

	id := uuid.New()
	name := "Test Product"
	description := "Test product description"
	price := int64(500) // 5.00 EUR in cents
	category := product.ProductCategoryBeer
	status := product.ProductStatusActive

	if opts != nil {
		if opts.Name != nil {
			name = *opts.Name
		}
		if opts.Description != nil {
			description = *opts.Description
		}
		if opts.Price != nil {
			price = *opts.Price
		}
		if opts.Category != nil {
			category = product.ProductCategory(*opts.Category)
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	p := &product.Product{
		ID:          id,
		StandID:     standID,
		Name:        name,
		Description: description,
		Price:       price,
		Category:    category,
		Status:      status,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if opts != nil && opts.Stock != nil {
		p.Stock = opts.Stock
	}

	if err := db.Create(p).Error; err != nil {
		t.Fatalf("Failed to create test product: %v", err)
	}

	return p
}

// ============================================================================
// Wallet fixtures
// ============================================================================

// WalletOptions allows customizing test wallet creation
type WalletOptions struct {
	Balance *int64
	Status  *wallet.WalletStatus
}

// CreateTestWallet creates a wallet for testing
func CreateTestWallet(t *testing.T, db *gorm.DB, userID, festivalID uuid.UUID, opts *WalletOptions) *wallet.Wallet {
	t.Helper()

	id := uuid.New()
	balance := int64(0)
	status := wallet.WalletStatusActive

	if opts != nil {
		if opts.Balance != nil {
			balance = *opts.Balance
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	w := &wallet.Wallet{
		ID:         id,
		UserID:     userID,
		FestivalID: festivalID,
		Balance:    balance,
		Status:     status,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := db.Create(w).Error; err != nil {
		t.Fatalf("Failed to create test wallet: %v", err)
	}

	return w
}

// CreateTestWalletWithBalance creates a wallet with a specific balance
func CreateTestWalletWithBalance(t *testing.T, db *gorm.DB, userID, festivalID uuid.UUID, balance int64) *wallet.Wallet {
	t.Helper()
	return CreateTestWallet(t, db, userID, festivalID, &WalletOptions{
		Balance: &balance,
	})
}

// ============================================================================
// Transaction fixtures
// ============================================================================

// TransactionOptions allows customizing test transaction creation
type TransactionOptions struct {
	Type      *wallet.TransactionType
	Amount    *int64
	Reference *string
	StandID   *uuid.UUID
	StaffID   *uuid.UUID
	Status    *wallet.TransactionStatus
}

// CreateTestTransaction creates a transaction for testing
func CreateTestTransaction(t *testing.T, db *gorm.DB, walletID uuid.UUID, balanceBefore, balanceAfter int64, opts *TransactionOptions) *wallet.Transaction {
	t.Helper()

	id := uuid.New()
	txType := wallet.TransactionTypeTopUp
	amount := balanceAfter - balanceBefore
	status := wallet.TransactionStatusCompleted

	if opts != nil {
		if opts.Type != nil {
			txType = *opts.Type
		}
		if opts.Amount != nil {
			amount = *opts.Amount
		}
		if opts.Status != nil {
			status = *opts.Status
		}
	}

	tx := &wallet.Transaction{
		ID:            id,
		WalletID:      walletID,
		Type:          txType,
		Amount:        amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  balanceAfter,
		Status:        status,
		CreatedAt:     time.Now(),
	}

	if opts != nil {
		if opts.Reference != nil {
			tx.Reference = *opts.Reference
		}
		if opts.StandID != nil {
			tx.StandID = opts.StandID
		}
		if opts.StaffID != nil {
			tx.StaffID = opts.StaffID
		}
	}

	if err := db.Create(tx).Error; err != nil {
		t.Fatalf("Failed to create test transaction: %v", err)
	}

	return tx
}

// ============================================================================
// Order fixtures
// ============================================================================

// OrderOptions allows customizing test order creation
type OrderOptions struct {
	Items         *order.OrderItems
	TotalAmount   *int64
	Status        *order.OrderStatus
	PaymentMethod *string
	TransactionID *uuid.UUID
	StaffID       *uuid.UUID
	Notes         *string
}

// CreateTestOrder creates an order for testing
func CreateTestOrder(t *testing.T, db *gorm.DB, festivalID, userID, walletID, standID uuid.UUID, opts *OrderOptions) *order.Order {
	t.Helper()

	id := uuid.New()
	items := order.OrderItems{
		{
			ProductID:   uuid.New(),
			ProductName: "Test Product",
			Quantity:    1,
			UnitPrice:   500,
			TotalPrice:  500,
		},
	}
	totalAmount := int64(500)
	status := order.OrderStatusPending
	paymentMethod := "wallet"

	if opts != nil {
		if opts.Items != nil {
			items = *opts.Items
		}
		if opts.TotalAmount != nil {
			totalAmount = *opts.TotalAmount
		}
		if opts.Status != nil {
			status = *opts.Status
		}
		if opts.PaymentMethod != nil {
			paymentMethod = *opts.PaymentMethod
		}
	}

	o := &order.Order{
		ID:            id,
		FestivalID:    festivalID,
		UserID:        userID,
		WalletID:      walletID,
		StandID:       standID,
		Items:         items,
		TotalAmount:   totalAmount,
		Status:        status,
		PaymentMethod: paymentMethod,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if opts != nil {
		if opts.TransactionID != nil {
			o.TransactionID = opts.TransactionID
		}
		if opts.StaffID != nil {
			o.StaffID = opts.StaffID
		}
		if opts.Notes != nil {
			o.Notes = *opts.Notes
		}
	}

	if err := db.Create(o).Error; err != nil {
		t.Fatalf("Failed to create test order: %v", err)
	}

	return o
}

// ============================================================================
// Auth/Permission fixtures
// ============================================================================

// CreateTestPermission creates a permission for testing
func CreateTestPermission(t *testing.T, db *gorm.DB, resource auth.Resource, action auth.Action, scope auth.Scope) *auth.Permission {
	t.Helper()

	p := &auth.Permission{
		ID:          uuid.New(),
		Resource:    resource,
		Action:      action,
		Scope:       scope,
		Description: string(resource) + ":" + string(action),
		CreatedAt:   time.Now(),
	}

	if err := db.Create(p).Error; err != nil {
		t.Fatalf("Failed to create test permission: %v", err)
	}

	return p
}

// CreateTestRole creates a role for testing
func CreateTestRole(t *testing.T, db *gorm.DB, name, displayName string, festivalID *uuid.UUID, permissions []auth.Permission) *auth.Role {
	t.Helper()

	r := &auth.Role{
		ID:          uuid.New(),
		Name:        name,
		DisplayName: displayName,
		Description: "Test role: " + displayName,
		Type:        auth.RoleTypeCustom,
		FestivalID:  festivalID,
		Permissions: permissions,
		IsActive:    true,
		Priority:    100,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := db.Create(r).Error; err != nil {
		t.Fatalf("Failed to create test role: %v", err)
	}

	return r
}

// CreateTestRoleAssignment creates a role assignment for testing
func CreateTestRoleAssignment(t *testing.T, db *gorm.DB, userID, roleID, assignedBy uuid.UUID, festivalID *uuid.UUID) *auth.RoleAssignment {
	t.Helper()

	ra := &auth.RoleAssignment{
		ID:         uuid.New(),
		UserID:     userID,
		RoleID:     roleID,
		FestivalID: festivalID,
		AssignedBy: assignedBy,
		AssignedAt: time.Now(),
		IsActive:   true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := db.Create(ra).Error; err != nil {
		t.Fatalf("Failed to create test role assignment: %v", err)
	}

	return ra
}

// ============================================================================
// Composite fixtures for common test scenarios
// ============================================================================

// TestSetup contains all commonly needed test entities
type TestSetup struct {
	Admin    *user.User
	Staff    *user.User
	User     *user.User
	Festival *festival.Festival
	Stand    *stand.Stand
	Product  *product.Product
	Wallet   *wallet.Wallet
}

// CreateFullTestSetup creates a complete test environment with all entities
func CreateFullTestSetup(t *testing.T, db *gorm.DB) *TestSetup {
	t.Helper()

	// Create users
	admin := CreateTestAdmin(t, db)
	staff := CreateTestStaff(t, db)
	testUser := CreateTestUser(t, db, nil)

	// Create festival
	fest := CreateActiveFestival(t, db, &admin.ID)

	// Create stand
	testStand := CreateTestStand(t, db, fest.ID, nil)

	// Create product
	testProduct := CreateTestProduct(t, db, testStand.ID, nil)

	// Create wallet with balance
	testWallet := CreateTestWalletWithBalance(t, db, testUser.ID, fest.ID, 10000) // 100 EUR

	return &TestSetup{
		Admin:    admin,
		Staff:    staff,
		User:     testUser,
		Festival: fest,
		Stand:    testStand,
		Product:  testProduct,
		Wallet:   testWallet,
	}
}

// ============================================================================
// Helper functions
// ============================================================================

// slugify converts a string to a URL-friendly slug
func slugify(s string) string {
	result := make([]byte, 0, len(s))
	lastWasDash := false

	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c = c + 32 // lowercase
		}
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			result = append(result, c)
			lastWasDash = false
		} else if !lastWasDash && len(result) > 0 {
			result = append(result, '-')
			lastWasDash = true
		}
	}

	// Remove trailing dash
	if len(result) > 0 && result[len(result)-1] == '-' {
		result = result[:len(result)-1]
	}

	return string(result)
}
