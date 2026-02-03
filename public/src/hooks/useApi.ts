import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/lib/api'

// Festival hooks
export function useFestival(idOrSlug: string) {
  return useQuery({
    queryKey: ['festival', idOrSlug],
    queryFn: () => api.getFestival(idOrSlug),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useActiveFestivals() {
  return useQuery({
    queryKey: ['festivals', 'active'],
    queryFn: api.getActiveFestivals,
    staleTime: 5 * 60 * 1000,
  })
}

// Ticket hooks
export function useTicketTypes(festivalId: string) {
  return useQuery({
    queryKey: ['ticketTypes', festivalId],
    queryFn: () => api.getTicketTypes(festivalId),
    staleTime: 60 * 1000, // 1 minute - tickets can sell out
    enabled: !!festivalId,
  })
}

// Lineup hooks
export function useLineup(festivalId: string) {
  return useQuery({
    queryKey: ['lineup', festivalId],
    queryFn: () => api.getLineup(festivalId),
    staleTime: 5 * 60 * 1000,
    enabled: !!festivalId,
  })
}

export function useArtists(festivalId: string) {
  return useQuery({
    queryKey: ['artists', festivalId],
    queryFn: () => api.getArtists(festivalId),
    staleTime: 5 * 60 * 1000,
    enabled: !!festivalId,
  })
}

export function useStages(festivalId: string) {
  return useQuery({
    queryKey: ['stages', festivalId],
    queryFn: () => api.getStages(festivalId),
    staleTime: 5 * 60 * 1000,
    enabled: !!festivalId,
  })
}

export function useDaySchedule(festivalId: string, day: string) {
  return useQuery({
    queryKey: ['schedule', festivalId, day],
    queryFn: () => api.getDaySchedule(festivalId, day),
    staleTime: 60 * 1000,
    enabled: !!festivalId && !!day,
  })
}

// Order hooks
export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.createOrder,
    onSuccess: () => {
      // Invalidate ticket types to refresh availability
      queryClient.invalidateQueries({ queryKey: ['ticketTypes'] })
    },
  })
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.getOrder(orderId),
    enabled: !!orderId,
  })
}

// User hooks (require auth token)
export function useUserTickets(token: string | null) {
  return useQuery({
    queryKey: ['userTickets'],
    queryFn: () => api.getUserTickets(token!),
    enabled: !!token,
  })
}

export function useUserOrders(token: string | null) {
  return useQuery({
    queryKey: ['userOrders'],
    queryFn: () => api.getUserOrders(token!),
    enabled: !!token,
  })
}

// FAQ hooks
export function useFAQs(festivalId: string) {
  return useQuery({
    queryKey: ['faqs', festivalId],
    queryFn: () => api.getFAQs(festivalId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!festivalId,
  })
}

// Info hooks
export function useFestivalInfo(festivalId: string) {
  return useQuery({
    queryKey: ['festivalInfo', festivalId],
    queryFn: () => api.getFestivalInfo(festivalId),
    staleTime: 10 * 60 * 1000,
    enabled: !!festivalId,
  })
}
