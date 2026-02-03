import { apiClient, ENDPOINTS, API_URL } from '@/config/api';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  festivalId: string;
  festivalName: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  fees: number;
  total: number;
  currency: string;
  paymentMethod?: string;
  standId?: string;
  standName?: string;
  createdAt: string;
  completedAt?: string;
  receiptUrl?: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface OrderFilters {
  festivalId?: string;
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

// Get user's orders with optional filters
export async function getOrders(filters?: OrderFilters): Promise<OrdersResponse> {
  const params = new URLSearchParams();

  if (filters?.festivalId) {
    params.append('festivalId', filters.festivalId);
  }
  if (filters?.status) {
    params.append('status', filters.status);
  }
  if (filters?.page !== undefined) {
    params.append('page', filters.page.toString());
  }
  if (filters?.limit !== undefined) {
    params.append('limit', filters.limit.toString());
  }

  const queryString = params.toString();
  const endpoint = `/orders${queryString ? `?${queryString}` : ''}`;

  return apiClient.get<OrdersResponse>(endpoint);
}

// Get single order by ID
export async function getOrderById(orderId: string): Promise<Order> {
  return apiClient.get<Order>(`/orders/${orderId}`);
}

// Download receipt for an order
export async function getReceiptUrl(orderId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/orders/${orderId}/receipt`);
  return response.url;
}

// Get available festivals for filtering
export interface FestivalOption {
  id: string;
  name: string;
  orderCount: number;
}

export async function getOrderFestivals(): Promise<FestivalOption[]> {
  return apiClient.get<FestivalOption[]>('/orders/festivals');
}
