import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type POICategory =
  | 'stand'
  | 'stage'
  | 'toilet'
  | 'first_aid'
  | 'food'
  | 'drink'
  | 'merch'
  | 'info'
  | 'parking'
  | 'entrance'
  | 'atm'
  | 'charging';

export type StandCategory =
  | 'food'
  | 'drink'
  | 'merch'
  | 'sponsor'
  | 'craft';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  available: boolean;
}

export interface Stand {
  id: string;
  name: string;
  description: string;
  category: StandCategory;
  location: Coordinate;
  products: Product[];
  openingHours: string;
  imageUrl?: string;
  isCashless: boolean;
}

export interface MapStage {
  id: string;
  name: string;
  description: string;
  location: Coordinate;
  capacity: number;
  color: string;
  currentPerformance?: {
    artistId: string;
    artistName: string;
    startTime: string;
    endTime: string;
  };
  nextPerformance?: {
    artistId: string;
    artistName: string;
    startTime: string;
    endTime: string;
  };
}

export interface Facility {
  id: string;
  name: string;
  type: POICategory;
  location: Coordinate;
  description?: string;
  isAccessible?: boolean;
  status?: 'open' | 'closed' | 'busy';
}

export type POI = (Stand & { poiType: 'stand' }) | (MapStage & { poiType: 'stage' }) | (Facility & { poiType: 'facility' });

export interface UserLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  accuracy?: number;
}

// Festival region (example: a festival grounds near Lyon, France)
export const FESTIVAL_REGION = {
  latitude: 45.7640,
  longitude: 4.8357,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

// Mock data for development
const mockStands: Stand[] = [
  {
    id: 'stand-1',
    name: 'Burger Paradise',
    description: 'Les meilleurs burgers du festival avec des options vegetariennes',
    category: 'food',
    location: { latitude: 45.7645, longitude: 4.8350 },
    products: [
      { id: 'prod-1', name: 'Classic Burger', price: 12, available: true },
      { id: 'prod-2', name: 'Veggie Burger', price: 11, available: true },
      { id: 'prod-3', name: 'Frites', price: 4, available: true },
    ],
    openingHours: '11:00 - 02:00',
    isCashless: true,
  },
  {
    id: 'stand-2',
    name: 'Pizza Corner',
    description: 'Pizzas artisanales cuites au feu de bois',
    category: 'food',
    location: { latitude: 45.7638, longitude: 4.8365 },
    products: [
      { id: 'prod-4', name: 'Margherita', price: 10, available: true },
      { id: 'prod-5', name: 'Pepperoni', price: 12, available: true },
      { id: 'prod-6', name: '4 Fromages', price: 13, available: false },
    ],
    openingHours: '12:00 - 01:00',
    isCashless: true,
  },
  {
    id: 'stand-3',
    name: 'Bar Central',
    description: 'Bieres artisanales et cocktails',
    category: 'drink',
    location: { latitude: 45.7642, longitude: 4.8360 },
    products: [
      { id: 'prod-7', name: 'Biere Blonde', price: 6, available: true },
      { id: 'prod-8', name: 'Biere IPA', price: 7, available: true },
      { id: 'prod-9', name: 'Mojito', price: 10, available: true },
      { id: 'prod-10', name: 'Eau minerale', price: 2, available: true },
    ],
    openingHours: '14:00 - 04:00',
    isCashless: true,
  },
  {
    id: 'stand-4',
    name: 'Cocktail Lounge',
    description: 'Espace VIP avec cocktails premium',
    category: 'drink',
    location: { latitude: 45.7648, longitude: 4.8355 },
    products: [
      { id: 'prod-11', name: 'Pina Colada', price: 12, available: true },
      { id: 'prod-12', name: 'Margarita', price: 11, available: true },
      { id: 'prod-13', name: 'Virgin Mojito', price: 8, available: true },
    ],
    openingHours: '16:00 - 03:00',
    isCashless: true,
  },
  {
    id: 'stand-5',
    name: 'Official Merch',
    description: 'Merchandising officiel du festival',
    category: 'merch',
    location: { latitude: 45.7635, longitude: 4.8345 },
    products: [
      { id: 'prod-14', name: 'T-Shirt Festival', price: 30, available: true },
      { id: 'prod-15', name: 'Hoodie Festival', price: 55, available: true },
      { id: 'prod-16', name: 'Casquette', price: 20, available: true },
      { id: 'prod-17', name: 'Poster', price: 15, available: true },
    ],
    openingHours: '10:00 - 00:00',
    isCashless: true,
  },
  {
    id: 'stand-6',
    name: 'Artisan Local',
    description: 'Creations artisanales locales',
    category: 'craft',
    location: { latitude: 45.7650, longitude: 4.8362 },
    products: [
      { id: 'prod-18', name: 'Bijoux faits main', price: 25, available: true },
      { id: 'prod-19', name: 'Pochette brodee', price: 35, available: true },
    ],
    openingHours: '11:00 - 23:00',
    isCashless: true,
  },
];

const mockStages: MapStage[] = [
  {
    id: 'stage-1',
    name: 'Main Stage',
    description: 'La scene principale du festival',
    location: { latitude: 45.7640, longitude: 4.8357 },
    capacity: 15000,
    color: '#6366F1',
    currentPerformance: {
      artistId: 'artist-1',
      artistName: 'DJ Aurora',
      startTime: '2026-07-10T20:00:00',
      endTime: '2026-07-10T22:00:00',
    },
    nextPerformance: {
      artistId: 'artist-5',
      artistName: 'Midnight Echo',
      startTime: '2026-07-10T22:30:00',
      endTime: '2026-07-11T00:30:00',
    },
  },
  {
    id: 'stage-2',
    name: 'Techno Tent',
    description: 'Scene dediee a la musique electronique',
    location: { latitude: 45.7652, longitude: 4.8370 },
    capacity: 5000,
    color: '#10B981',
    currentPerformance: {
      artistId: 'artist-4',
      artistName: 'Luna Sol',
      startTime: '2026-07-10T21:00:00',
      endTime: '2026-07-10T23:00:00',
    },
  },
  {
    id: 'stage-3',
    name: 'Acoustic Garden',
    description: 'Performances acoustiques intimistes',
    location: { latitude: 45.7632, longitude: 4.8340 },
    capacity: 2000,
    color: '#F59E0B',
    currentPerformance: {
      artistId: 'artist-2',
      artistName: 'The Wanderers',
      startTime: '2026-07-10T19:00:00',
      endTime: '2026-07-10T21:00:00',
    },
  },
  {
    id: 'stage-4',
    name: 'Bass Arena',
    description: 'Pour les amateurs de basses',
    location: { latitude: 45.7655, longitude: 4.8348 },
    capacity: 3000,
    color: '#EF4444',
    nextPerformance: {
      artistId: 'artist-3',
      artistName: 'Bass Mechanics',
      startTime: '2026-07-10T22:00:00',
      endTime: '2026-07-11T00:00:00',
    },
  },
];

const mockFacilities: Facility[] = [
  {
    id: 'facility-1',
    name: 'Toilettes Zone A',
    type: 'toilet',
    location: { latitude: 45.7643, longitude: 4.8352 },
    isAccessible: true,
    status: 'open',
  },
  {
    id: 'facility-2',
    name: 'Toilettes Zone B',
    type: 'toilet',
    location: { latitude: 45.7647, longitude: 4.8368 },
    isAccessible: false,
    status: 'open',
  },
  {
    id: 'facility-3',
    name: 'Toilettes Zone C',
    type: 'toilet',
    location: { latitude: 45.7635, longitude: 4.8358 },
    isAccessible: true,
    status: 'busy',
  },
  {
    id: 'facility-4',
    name: 'Poste de Secours Principal',
    type: 'first_aid',
    location: { latitude: 45.7640, longitude: 4.8345 },
    description: 'Premiers secours et assistance medicale 24h/24',
    isAccessible: true,
    status: 'open',
  },
  {
    id: 'facility-5',
    name: 'Poste de Secours Nord',
    type: 'first_aid',
    location: { latitude: 45.7658, longitude: 4.8360 },
    description: 'Premiers secours',
    isAccessible: true,
    status: 'open',
  },
  {
    id: 'facility-6',
    name: 'Point Info',
    type: 'info',
    location: { latitude: 45.7638, longitude: 4.8350 },
    description: 'Informations, objets trouves, assistance',
    isAccessible: true,
    status: 'open',
  },
  {
    id: 'facility-7',
    name: 'Entree Principale',
    type: 'entrance',
    location: { latitude: 45.7628, longitude: 4.8357 },
    description: 'Entree principale du festival',
    isAccessible: true,
    status: 'open',
  },
  {
    id: 'facility-8',
    name: 'Entree VIP',
    type: 'entrance',
    location: { latitude: 45.7630, longitude: 4.8370 },
    description: 'Entree reservee aux VIP',
    status: 'open',
  },
  {
    id: 'facility-9',
    name: 'Parking Principal',
    type: 'parking',
    location: { latitude: 45.7620, longitude: 4.8340 },
    description: 'Parking principal - 2000 places',
    status: 'open',
  },
  {
    id: 'facility-10',
    name: 'Distributeur ATM',
    type: 'atm',
    location: { latitude: 45.7636, longitude: 4.8355 },
    status: 'open',
  },
  {
    id: 'facility-11',
    name: 'Station de Recharge',
    type: 'charging',
    location: { latitude: 45.7644, longitude: 4.8365 },
    description: 'Rechargez vos appareils gratuitement',
    status: 'open',
  },
];

interface MapState {
  // Data
  stands: Stand[];
  stages: MapStage[];
  facilities: Facility[];

  // User state
  userLocation: UserLocation | null;
  selectedPOI: POI | null;
  filterCategory: POICategory | null;
  searchQuery: string;

  // UI state
  isLoading: boolean;
  error: string | null;
  showUserLocation: boolean;

  // Actions
  fetchMapData: (festivalId: string) => Promise<void>;
  setUserLocation: (location: UserLocation | null) => void;
  selectPOI: (poi: POI | null) => void;
  setFilterCategory: (category: POICategory | null) => void;
  setSearchQuery: (query: string) => void;
  toggleUserLocation: () => void;
  clearError: () => void;

  // Selectors
  getStandById: (id: string) => Stand | undefined;
  getStageById: (id: string) => MapStage | undefined;
  getFacilityById: (id: string) => Facility | undefined;
  getFilteredStands: () => Stand[];
  getFilteredFacilities: () => Facility[];
  getAllPOIs: () => POI[];
  searchPOIs: (query: string) => POI[];
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      // Initial data
      stands: mockStands,
      stages: mockStages,
      facilities: mockFacilities,

      // Initial user state
      userLocation: null,
      selectedPOI: null,
      filterCategory: null,
      searchQuery: '',

      // Initial UI state
      isLoading: false,
      error: null,
      showUserLocation: true,

      // Actions
      fetchMapData: async (festivalId: string) => {
        set({ isLoading: true, error: null });
        try {
          // In production, this would fetch from API
          // const response = await fetch(`/api/festivals/${festivalId}/map`);
          // const data = await response.json();

          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 500));

          // For now, we use mock data (already set in initial state)
          set({
            isLoading: false,
            // stands: data.stands,
            // stages: data.stages,
            // facilities: data.facilities,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Erreur lors du chargement de la carte',
          });
        }
      },

      setUserLocation: (location) => {
        set({ userLocation: location });
      },

      selectPOI: (poi) => {
        set({ selectedPOI: poi });
      },

      setFilterCategory: (category) => {
        set({ filterCategory: category });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      toggleUserLocation: () => {
        set((state) => ({ showUserLocation: !state.showUserLocation }));
      },

      clearError: () => {
        set({ error: null });
      },

      // Selectors
      getStandById: (id) => {
        return get().stands.find((stand) => stand.id === id);
      },

      getStageById: (id) => {
        return get().stages.find((stage) => stage.id === id);
      },

      getFacilityById: (id) => {
        return get().facilities.find((facility) => facility.id === id);
      },

      getFilteredStands: () => {
        const { stands, filterCategory } = get();
        if (!filterCategory) return stands;

        // Map POI categories to stand categories
        const standCategoryMap: Partial<Record<POICategory, StandCategory>> = {
          food: 'food',
          drink: 'drink',
          merch: 'merch',
        };

        const standCategory = standCategoryMap[filterCategory];
        if (!standCategory) return [];

        return stands.filter((stand) => stand.category === standCategory);
      },

      getFilteredFacilities: () => {
        const { facilities, filterCategory } = get();
        if (!filterCategory) return facilities;
        return facilities.filter((facility) => facility.type === filterCategory);
      },

      getAllPOIs: () => {
        const { stands, stages, facilities, filterCategory } = get();
        const pois: POI[] = [];

        // Add stands
        if (!filterCategory || ['stand', 'food', 'drink', 'merch'].includes(filterCategory)) {
          const filteredStands = !filterCategory
            ? stands
            : stands.filter((s) => {
                if (filterCategory === 'stand') return true;
                return s.category === filterCategory;
              });
          pois.push(...filteredStands.map((s) => ({ ...s, poiType: 'stand' as const })));
        }

        // Add stages
        if (!filterCategory || filterCategory === 'stage') {
          pois.push(...stages.map((s) => ({ ...s, poiType: 'stage' as const })));
        }

        // Add facilities
        if (!filterCategory || !['stand', 'stage', 'food', 'drink', 'merch'].includes(filterCategory)) {
          const filteredFacilities = !filterCategory
            ? facilities
            : facilities.filter((f) => f.type === filterCategory);
          pois.push(...filteredFacilities.map((f) => ({ ...f, poiType: 'facility' as const })));
        }

        return pois;
      },

      searchPOIs: (query) => {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) return get().getAllPOIs();

        const { stands, stages, facilities } = get();
        const results: POI[] = [];

        // Search stands
        stands.forEach((stand) => {
          if (
            stand.name.toLowerCase().includes(lowerQuery) ||
            stand.description.toLowerCase().includes(lowerQuery) ||
            stand.products.some((p) => p.name.toLowerCase().includes(lowerQuery))
          ) {
            results.push({ ...stand, poiType: 'stand' });
          }
        });

        // Search stages
        stages.forEach((stage) => {
          if (
            stage.name.toLowerCase().includes(lowerQuery) ||
            stage.description.toLowerCase().includes(lowerQuery) ||
            stage.currentPerformance?.artistName.toLowerCase().includes(lowerQuery) ||
            stage.nextPerformance?.artistName.toLowerCase().includes(lowerQuery)
          ) {
            results.push({ ...stage, poiType: 'stage' });
          }
        });

        // Search facilities
        facilities.forEach((facility) => {
          if (
            facility.name.toLowerCase().includes(lowerQuery) ||
            facility.description?.toLowerCase().includes(lowerQuery)
          ) {
            results.push({ ...facility, poiType: 'facility' });
          }
        });

        return results;
      },
    }),
    {
      name: 'map-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        showUserLocation: state.showUserLocation,
      }),
    }
  )
);

// Helper functions for getting category icons and labels
export const getCategoryIcon = (category: POICategory): string => {
  const iconMap: Record<POICategory, string> = {
    stand: 'storefront-outline',
    stage: 'musical-notes-outline',
    toilet: 'water-outline',
    first_aid: 'medkit-outline',
    food: 'fast-food-outline',
    drink: 'beer-outline',
    merch: 'shirt-outline',
    info: 'information-circle-outline',
    parking: 'car-outline',
    entrance: 'enter-outline',
    atm: 'card-outline',
    charging: 'battery-charging-outline',
  };
  return iconMap[category] || 'location-outline';
};

export const getCategoryLabel = (category: POICategory): string => {
  const labelMap: Record<POICategory, string> = {
    stand: 'Stands',
    stage: 'Scenes',
    toilet: 'Toilettes',
    first_aid: 'Secours',
    food: 'Nourriture',
    drink: 'Boissons',
    merch: 'Boutique',
    info: 'Infos',
    parking: 'Parking',
    entrance: 'Entrees',
    atm: 'Distributeur',
    charging: 'Recharge',
  };
  return labelMap[category] || category;
};

export const getCategoryColor = (category: POICategory): string => {
  const colorMap: Record<POICategory, string> = {
    stand: '#6366F1',
    stage: '#8B5CF6',
    toilet: '#3B82F6',
    first_aid: '#EF4444',
    food: '#F97316',
    drink: '#EAB308',
    merch: '#EC4899',
    info: '#14B8A6',
    parking: '#6B7280',
    entrance: '#22C55E',
    atm: '#0EA5E9',
    charging: '#84CC16',
  };
  return colorMap[category] || '#6B7280';
};

export const getStandCategoryIcon = (category: StandCategory): string => {
  const iconMap: Record<StandCategory, string> = {
    food: 'fast-food-outline',
    drink: 'beer-outline',
    merch: 'shirt-outline',
    sponsor: 'megaphone-outline',
    craft: 'color-palette-outline',
  };
  return iconMap[category] || 'storefront-outline';
};
