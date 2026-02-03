import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Artist {
  id: string;
  name: string;
  photo: string;
  bio: string;
  genre: string;
  country: string;
  socialLinks: {
    instagram?: string;
    spotify?: string;
    website?: string;
  };
}

export interface Stage {
  id: string;
  name: string;
  description: string;
  location: string;
  color: string;
}

export interface Performance {
  id: string;
  artistId: string;
  stageId: string;
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  dayIndex: number;
}

export interface FestivalDay {
  date: string; // ISO date string
  dayName: string;
  shortLabel: string;
}

interface LineupState {
  artists: Artist[];
  stages: Stage[];
  performances: Performance[];
  days: FestivalDay[];
  favorites: string[]; // artist IDs
  selectedDayIndex: number;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLineup: (festivalId: string) => Promise<void>;
  toggleFavorite: (artistId: string) => void;
  setSelectedDay: (index: number) => void;
  setSearchQuery: (query: string) => void;

  // Selectors
  getArtistById: (id: string) => Artist | undefined;
  getStageById: (id: string) => Stage | undefined;
  getPerformancesByDay: (dayIndex: number) => Performance[];
  getPerformancesByStage: (dayIndex: number, stageId: string) => Performance[];
  getPerformancesByArtist: (artistId: string) => Performance[];
  getCurrentPerformance: () => Performance | null;
  getUpcomingPerformances: (limit?: number) => Performance[];
  isFavorite: (artistId: string) => boolean;
  getFavoriteArtists: () => Artist[];
  getFilteredPerformances: (dayIndex: number, query: string) => Performance[];
}

// Mock data for development
const mockDays: FestivalDay[] = [
  { date: '2026-07-10', dayName: 'Vendredi', shortLabel: 'Ven 10' },
  { date: '2026-07-11', dayName: 'Samedi', shortLabel: 'Sam 11' },
  { date: '2026-07-12', dayName: 'Dimanche', shortLabel: 'Dim 12' },
];

const mockStages: Stage[] = [
  { id: 'stage-1', name: 'Main Stage', description: 'The main stage', location: 'Zone A', color: '#6366F1' },
  { id: 'stage-2', name: 'Techno Tent', description: 'Electronic music stage', location: 'Zone B', color: '#10B981' },
  { id: 'stage-3', name: 'Acoustic Garden', description: 'Intimate acoustic performances', location: 'Zone C', color: '#F59E0B' },
  { id: 'stage-4', name: 'Bass Arena', description: 'Heavy bass music', location: 'Zone D', color: '#EF4444' },
];

const mockArtists: Artist[] = [
  {
    id: 'artist-1',
    name: 'DJ Aurora',
    photo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    bio: 'DJ Aurora is a rising star in the electronic music scene, known for her mesmerizing melodic techno sets that blend atmospheric sounds with driving beats. Born in Berlin, she has performed at major festivals across Europe.',
    genre: 'Melodic Techno',
    country: 'Germany',
    socialLinks: {
      instagram: 'https://instagram.com/djaurora',
      spotify: 'https://open.spotify.com/artist/djaurora',
    },
  },
  {
    id: 'artist-2',
    name: 'The Wanderers',
    photo: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
    bio: 'The Wanderers are a folk-rock band from Ireland, weaving traditional Celtic melodies with modern rock energy. Their live shows are legendary for their raw emotion and audience connection.',
    genre: 'Folk Rock',
    country: 'Ireland',
    socialLinks: {
      instagram: 'https://instagram.com/thewanderers',
      spotify: 'https://open.spotify.com/artist/thewanderers',
      website: 'https://thewanderers.com',
    },
  },
  {
    id: 'artist-3',
    name: 'Bass Mechanics',
    photo: 'https://images.unsplash.com/photo-1571266028243-d220c6c2e8ff?w=400',
    bio: 'Bass Mechanics is a duo specializing in heavy dubstep and drum & bass. Known for their bone-shaking drops and intricate sound design, they have become fixtures in the bass music community.',
    genre: 'Dubstep / DnB',
    country: 'UK',
    socialLinks: {
      instagram: 'https://instagram.com/bassmechanics',
      spotify: 'https://open.spotify.com/artist/bassmechanics',
    },
  },
  {
    id: 'artist-4',
    name: 'Luna Sol',
    photo: 'https://images.unsplash.com/photo-1529518969858-8baa65152fc8?w=400',
    bio: 'Luna Sol brings a unique fusion of Latin rhythms and electronic production. Her sets transport audiences to tropical paradises while keeping the dancefloor moving.',
    genre: 'Latin House',
    country: 'Colombia',
    socialLinks: {
      instagram: 'https://instagram.com/lunasol',
      spotify: 'https://open.spotify.com/artist/lunasol',
    },
  },
  {
    id: 'artist-5',
    name: 'Midnight Echo',
    photo: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400',
    bio: 'Midnight Echo is an indie electronic artist known for haunting vocals layered over dark, pulsing synths. Their atmospheric soundscapes have earned them a devoted following.',
    genre: 'Dark Wave',
    country: 'France',
    socialLinks: {
      instagram: 'https://instagram.com/midnightecho',
      spotify: 'https://open.spotify.com/artist/midnightecho',
    },
  },
  {
    id: 'artist-6',
    name: 'Sunset Collective',
    photo: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=400',
    bio: 'A collective of musicians who create immersive, genre-defying live performances. Each show is unique, blending jazz, electronic, and world music influences.',
    genre: 'World Fusion',
    country: 'Brazil',
    socialLinks: {
      instagram: 'https://instagram.com/sunsetcollective',
      website: 'https://sunsetcollective.com',
    },
  },
  {
    id: 'artist-7',
    name: 'Neon Dreams',
    photo: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    bio: 'Neon Dreams delivers high-energy synthwave and retro-futuristic sounds. Their sets are a nostalgic journey through 80s aesthetics with a modern twist.',
    genre: 'Synthwave',
    country: 'USA',
    socialLinks: {
      instagram: 'https://instagram.com/neondreams',
      spotify: 'https://open.spotify.com/artist/neondreams',
    },
  },
  {
    id: 'artist-8',
    name: 'Terra Nova',
    photo: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400',
    bio: 'Terra Nova is a progressive trance project known for epic buildups and transcendent moments. Their music is designed for peak festival experiences.',
    genre: 'Progressive Trance',
    country: 'Netherlands',
    socialLinks: {
      instagram: 'https://instagram.com/terranova',
      spotify: 'https://open.spotify.com/artist/terranova',
    },
  },
];

const mockPerformances: Performance[] = [
  // Day 0 - Friday
  { id: 'perf-1', artistId: 'artist-1', stageId: 'stage-1', startTime: '2026-07-10T20:00:00', endTime: '2026-07-10T22:00:00', dayIndex: 0 },
  { id: 'perf-2', artistId: 'artist-2', stageId: 'stage-3', startTime: '2026-07-10T19:00:00', endTime: '2026-07-10T21:00:00', dayIndex: 0 },
  { id: 'perf-3', artistId: 'artist-3', stageId: 'stage-4', startTime: '2026-07-10T22:00:00', endTime: '2026-07-11T00:00:00', dayIndex: 0 },
  { id: 'perf-4', artistId: 'artist-4', stageId: 'stage-2', startTime: '2026-07-10T21:00:00', endTime: '2026-07-10T23:00:00', dayIndex: 0 },
  { id: 'perf-5', artistId: 'artist-5', stageId: 'stage-1', startTime: '2026-07-10T22:30:00', endTime: '2026-07-11T00:30:00', dayIndex: 0 },

  // Day 1 - Saturday
  { id: 'perf-6', artistId: 'artist-6', stageId: 'stage-3', startTime: '2026-07-11T17:00:00', endTime: '2026-07-11T19:00:00', dayIndex: 1 },
  { id: 'perf-7', artistId: 'artist-7', stageId: 'stage-2', startTime: '2026-07-11T20:00:00', endTime: '2026-07-11T22:00:00', dayIndex: 1 },
  { id: 'perf-8', artistId: 'artist-8', stageId: 'stage-1', startTime: '2026-07-11T22:00:00', endTime: '2026-07-12T00:00:00', dayIndex: 1 },
  { id: 'perf-9', artistId: 'artist-1', stageId: 'stage-2', startTime: '2026-07-11T23:00:00', endTime: '2026-07-12T01:00:00', dayIndex: 1 },
  { id: 'perf-10', artistId: 'artist-3', stageId: 'stage-4', startTime: '2026-07-11T21:00:00', endTime: '2026-07-11T23:00:00', dayIndex: 1 },

  // Day 2 - Sunday
  { id: 'perf-11', artistId: 'artist-2', stageId: 'stage-1', startTime: '2026-07-12T18:00:00', endTime: '2026-07-12T20:00:00', dayIndex: 2 },
  { id: 'perf-12', artistId: 'artist-4', stageId: 'stage-2', startTime: '2026-07-12T19:00:00', endTime: '2026-07-12T21:00:00', dayIndex: 2 },
  { id: 'perf-13', artistId: 'artist-5', stageId: 'stage-3', startTime: '2026-07-12T17:00:00', endTime: '2026-07-12T19:00:00', dayIndex: 2 },
  { id: 'perf-14', artistId: 'artist-6', stageId: 'stage-1', startTime: '2026-07-12T20:30:00', endTime: '2026-07-12T22:30:00', dayIndex: 2 },
  { id: 'perf-15', artistId: 'artist-8', stageId: 'stage-2', startTime: '2026-07-12T22:00:00', endTime: '2026-07-13T00:00:00', dayIndex: 2 },
];

export const useLineupStore = create<LineupState>()(
  persist(
    (set, get) => ({
      artists: mockArtists,
      stages: mockStages,
      performances: mockPerformances,
      days: mockDays,
      favorites: [],
      selectedDayIndex: 0,
      searchQuery: '',
      isLoading: false,
      error: null,

      fetchLineup: async (festivalId: string) => {
        set({ isLoading: true, error: null });
        try {
          // In production, this would fetch from API
          // const response = await fetch(`/api/festivals/${festivalId}/lineup`);
          // const data = await response.json();

          // For now, we use mock data (already set in initial state)
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

          set({
            isLoading: false,
            // artists: data.artists,
            // stages: data.stages,
            // performances: data.performances,
            // days: data.days,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch lineup',
          });
        }
      },

      toggleFavorite: (artistId: string) => {
        set((state) => {
          const isFavorited = state.favorites.includes(artistId);
          return {
            favorites: isFavorited
              ? state.favorites.filter((id) => id !== artistId)
              : [...state.favorites, artistId],
          };
        });
      },

      setSelectedDay: (index: number) => {
        set({ selectedDayIndex: index });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      getArtistById: (id: string) => {
        return get().artists.find((artist) => artist.id === id);
      },

      getStageById: (id: string) => {
        return get().stages.find((stage) => stage.id === id);
      },

      getPerformancesByDay: (dayIndex: number) => {
        return get().performances
          .filter((perf) => perf.dayIndex === dayIndex)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      },

      getPerformancesByStage: (dayIndex: number, stageId: string) => {
        return get().performances
          .filter((perf) => perf.dayIndex === dayIndex && perf.stageId === stageId)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      },

      getPerformancesByArtist: (artistId: string) => {
        return get().performances
          .filter((perf) => perf.artistId === artistId)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      },

      getCurrentPerformance: () => {
        const now = new Date();
        return get().performances.find((perf) => {
          const start = new Date(perf.startTime);
          const end = new Date(perf.endTime);
          return now >= start && now <= end;
        }) || null;
      },

      getUpcomingPerformances: (limit = 5) => {
        const now = new Date();
        return get().performances
          .filter((perf) => new Date(perf.startTime) > now)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .slice(0, limit);
      },

      isFavorite: (artistId: string) => {
        return get().favorites.includes(artistId);
      },

      getFavoriteArtists: () => {
        const { artists, favorites } = get();
        return artists.filter((artist) => favorites.includes(artist.id));
      },

      getFilteredPerformances: (dayIndex: number, query: string) => {
        const { performances, artists } = get();
        const lowerQuery = query.toLowerCase().trim();

        if (!lowerQuery) {
          return performances
            .filter((perf) => perf.dayIndex === dayIndex)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        }

        return performances
          .filter((perf) => {
            if (perf.dayIndex !== dayIndex) return false;
            const artist = artists.find((a) => a.id === perf.artistId);
            if (!artist) return false;
            return (
              artist.name.toLowerCase().includes(lowerQuery) ||
              artist.genre.toLowerCase().includes(lowerQuery)
            );
          })
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      },
    }),
    {
      name: 'lineup-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        favorites: state.favorites,
        selectedDayIndex: state.selectedDayIndex,
      }),
    }
  )
);
