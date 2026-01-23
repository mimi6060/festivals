package order

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mimi6060/festivals/backend/internal/domain/product"
	"github.com/mimi6060/festivals/backend/internal/domain/wallet"
	"github.com/mimi6060/festivals/backend/internal/pkg/errors"
)

type Service struct {
	repo          Repository
	productRepo   product.Repository
	walletService *wallet.Service
}

func NewService(repo Repository, productRepo product.Repository, walletService *wallet.Service) *Service {
	return &Service{
		repo:          repo,
		productRepo:   productRepo,
		walletService: walletService,
	}
}

// CreateOrder creates a new order from cart items
func (s *Service) CreateOrder(ctx context.Context, userID, festivalID, walletID uuid.UUID, req CreateOrderRequest, staffID *uuid.UUID) (*Order, error) {
	// Validate and build order items
	items := make([]OrderItem, 0, len(req.Items))
	var totalAmount int64

	for _, itemReq := range req.Items {
		// Get product details
		prod, err := s.productRepo.GetByID(ctx, itemReq.ProductID)
		if err != nil {
			return nil, fmt.Errorf("failed to get product: %w", err)
		}
		if prod == nil {
			return nil, fmt.Errorf("product %s not found", itemReq.ProductID)
		}

		// Verify product belongs to the stand
		if prod.StandID != req.StandID {
			return nil, fmt.Errorf("product %s does not belong to stand %s", itemReq.ProductID, req.StandID)
		}

		// Check product availability
		if prod.Status != product.ProductStatusActive {
			return nil, fmt.Errorf("product %s is not available", prod.Name)
		}

		// Check stock if applicable
		if prod.Stock != nil && *prod.Stock < itemReq.Quantity {
			return nil, fmt.Errorf("insufficient stock for product %s", prod.Name)
		}

		itemTotal := prod.Price * int64(itemReq.Quantity)
		items = append(items, OrderItem{
			ProductID:   prod.ID,
			ProductName: prod.Name,
			Quantity:    itemReq.Quantity,
			UnitPrice:   prod.Price,
			TotalPrice:  itemTotal,
		})
		totalAmount += itemTotal
	}

	// Create order
	order := &Order{
		ID:            uuid.New(),
		FestivalID:    festivalID,
		UserID:        userID,
		WalletID:      walletID,
		StandID:       req.StandID,
		Items:         items,
		TotalAmount:   totalAmount,
		Status:        OrderStatusPending,
		PaymentMethod: req.PaymentMethod,
		StaffID:       staffID,
		Notes:         req.Notes,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.repo.CreateOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	return order, nil
}

// ProcessPayment processes payment for an order using the wallet
func (s *Service) ProcessPayment(ctx context.Context, orderID uuid.UUID, staffID uuid.UUID) (*Order, error) {
	order, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, errors.ErrNotFound
	}

	if order.Status != OrderStatusPending {
		return nil, fmt.Errorf("order is not in pending status")
	}

	// Process payment based on payment method
	switch order.PaymentMethod {
	case PaymentMethodWallet:
		// Process wallet payment
		tx, err := s.walletService.ProcessPayment(ctx, wallet.PaymentRequest{
			WalletID:   order.WalletID,
			Amount:     order.TotalAmount,
			StandID:    order.StandID,
			ProductIDs: s.extractProductIDs(order.Items),
		}, staffID)
		if err != nil {
			return nil, fmt.Errorf("payment failed: %w", err)
		}
		order.TransactionID = &tx.ID

	case PaymentMethodCash, PaymentMethodCard:
		// For cash/card payments, we just mark the order as paid
		// The actual payment handling is done externally
		break

	default:
		return nil, fmt.Errorf("unsupported payment method: %s", order.PaymentMethod)
	}

	// Update order status
	order.Status = OrderStatusPaid
	order.StaffID = &staffID
	order.UpdatedAt = time.Now()

	if err := s.repo.UpdateOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to update order: %w", err)
	}

	// Update product stock
	if err := s.updateProductStock(ctx, order.Items, -1); err != nil {
		// Log error but don't fail the payment
		fmt.Printf("failed to update product stock: %v\n", err)
	}

	return order, nil
}

// CancelOrder cancels a pending order
func (s *Service) CancelOrder(ctx context.Context, orderID uuid.UUID, reason string, staffID *uuid.UUID) (*Order, error) {
	order, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, errors.ErrNotFound
	}

	if order.Status != OrderStatusPending {
		return nil, fmt.Errorf("only pending orders can be cancelled")
	}

	order.Status = OrderStatusCancelled
	order.Notes = reason
	order.StaffID = staffID
	order.UpdatedAt = time.Now()

	if err := s.repo.UpdateOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to cancel order: %w", err)
	}

	return order, nil
}

// RefundOrder refunds a paid order
func (s *Service) RefundOrder(ctx context.Context, orderID uuid.UUID, reason string, staffID *uuid.UUID) (*Order, error) {
	order, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, errors.ErrNotFound
	}

	if order.Status != OrderStatusPaid {
		return nil, fmt.Errorf("only paid orders can be refunded")
	}

	// Process refund based on payment method
	if order.PaymentMethod == PaymentMethodWallet && order.TransactionID != nil {
		// Refund wallet transaction
		_, err := s.walletService.RefundTransaction(ctx, *order.TransactionID, reason, staffID)
		if err != nil {
			return nil, fmt.Errorf("refund failed: %w", err)
		}
	}

	// Update order status
	order.Status = OrderStatusRefunded
	order.Notes = reason
	order.StaffID = staffID
	order.UpdatedAt = time.Now()

	if err := s.repo.UpdateOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to update order: %w", err)
	}

	// Restore product stock
	if err := s.updateProductStock(ctx, order.Items, 1); err != nil {
		// Log error but don't fail the refund
		fmt.Printf("failed to restore product stock: %v\n", err)
	}

	return order, nil
}

// GetOrder returns an order by ID
func (s *Service) GetOrder(ctx context.Context, orderID uuid.UUID) (*Order, error) {
	order, err := s.repo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, errors.ErrNotFound
	}
	return order, nil
}

// GetOrderHistory returns paginated order history for a user in a festival
func (s *Service) GetOrderHistory(ctx context.Context, userID, festivalID uuid.UUID, page, perPage int) ([]Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetOrdersByUser(ctx, userID, festivalID, offset, perPage)
}

// GetOrdersByStand returns paginated orders for a stand
func (s *Service) GetOrdersByStand(ctx context.Context, standID uuid.UUID, page, perPage int, filter *OrderFilter) ([]Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetOrdersByStand(ctx, standID, offset, perPage, filter)
}

// GetOrdersByFestival returns paginated orders for a festival
func (s *Service) GetOrdersByFestival(ctx context.Context, festivalID uuid.UUID, page, perPage int, filter *OrderFilter) ([]Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	offset := (page - 1) * perPage
	return s.repo.GetOrdersByFestival(ctx, festivalID, offset, perPage, filter)
}

// GetStandStats returns order statistics for a stand
func (s *Service) GetStandStats(ctx context.Context, standID uuid.UUID, startDate, endDate *time.Time) (*OrderStandStats, error) {
	return s.repo.GetStandStats(ctx, standID, startDate, endDate)
}

// Helper functions

func (s *Service) extractProductIDs(items []OrderItem) []string {
	ids := make([]string, len(items))
	for i, item := range items {
		ids[i] = item.ProductID.String()
	}
	return ids
}

func (s *Service) updateProductStock(ctx context.Context, items []OrderItem, multiplier int) error {
	for _, item := range items {
		prod, err := s.productRepo.GetByID(ctx, item.ProductID)
		if err != nil {
			return err
		}
		if prod == nil || prod.Stock == nil {
			continue
		}

		newStock := *prod.Stock + (item.Quantity * multiplier)
		if newStock < 0 {
			newStock = 0
		}
		prod.Stock = &newStock

		if err := s.productRepo.Update(ctx, prod); err != nil {
			return err
		}
	}
	return nil
}
