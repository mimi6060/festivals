import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Festival {
  id: string
  name: string
  slug: string
  startDate: string
  endDate: string
  location: string
  currencyName: string
  exchangeRate: number
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
}

interface FestivalState {
  currentFestival: Festival | null
  festivals: Festival[]
  setCurrentFestival: (festival: Festival | null) => void
  setFestivals: (festivals: Festival[]) => void
  addFestival: (festival: Festival) => void
  updateFestival: (id: string, updates: Partial<Festival>) => void
}

export const useFestivalStore = create<FestivalState>()(
  persist(
    (set) => ({
      currentFestival: null,
      festivals: [],
      setCurrentFestival: (festival) => set({ currentFestival: festival }),
      setFestivals: (festivals) => set({ festivals }),
      addFestival: (festival) =>
        set((state) => ({ festivals: [...state.festivals, festival] })),
      updateFestival: (id, updates) =>
        set((state) => ({
          festivals: state.festivals.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
          currentFestival:
            state.currentFestival?.id === id
              ? { ...state.currentFestival, ...updates }
              : state.currentFestival,
        })),
    }),
    {
      name: 'festival-storage',
    }
  )
)
