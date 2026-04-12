// ---------------------------------------------------------------------------
// store/index.ts — Zustand 全局状态管理
// ---------------------------------------------------------------------------

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// 订阅状态
// ---------------------------------------------------------------------------

interface SubscriptionState {
  isPro: boolean;
  proExpiry?: number;
  entriesThisMonth: number;
  loading: boolean;
  setSubscription: (sub: Partial<SubscriptionState>) => void;
  clearSubscription: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isPro: false,
  proExpiry: undefined,
  entriesThisMonth: 0,
  loading: false,
  setSubscription: (sub) => set((state) => ({ ...state, ...sub })),
  clearSubscription: () => set({ isPro: false, proExpiry: undefined, entriesThisMonth: 0 }),
}));

// ---------------------------------------------------------------------------
// 登录状态
// ---------------------------------------------------------------------------

interface AuthState {
  openid: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  setOpenid: (openid: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  openid: null,
  isLoggedIn: false,
  loading: false,
  setOpenid: (openid) => set({ openid, isLoggedIn: !!openid }),
  clearAuth: () => set({ openid: null, isLoggedIn: false }),
}));

// ---------------------------------------------------------------------------
// 日记列表（分页）
// ---------------------------------------------------------------------------

interface Entry {
  _id?: string;
  id?: string;
  [key: string]: any;
}

interface EntriesState {
  entries: Entry[];
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  offset: number;
  PAGE_LIMIT: number;
  setEntries: (entries: Entry[]) => void;
  appendEntries: (entries: Entry[]) => void;
  prependEntry: (entry: Entry) => void;
  removeEntry: (id: string) => void;
  updateEntry: (id: string, updates: Partial<Entry>) => void;
  setHasMore: (hasMore: boolean) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  loadMore: () => void;
  reset: () => void;
}

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  hasMore: true,
  loading: false,
  refreshing: false,
  offset: 0,
  PAGE_LIMIT: 10,

  setEntries: (entries) => set({ entries, offset: entries.length }),

  appendEntries: (newEntries) => set((state) => ({
    entries: [...state.entries, ...newEntries],
    offset: state.offset + newEntries.length,
  })),

  prependEntry: (entry) => set((state) => ({
    entries: [entry, ...state.entries],
    offset: state.offset + 1,
  })),

  removeEntry: (id) => set((state) => ({
    entries: state.entries.filter(e => (e.id || e._id) !== id),
  })),

  updateEntry: (id, updates) => set((state) => ({
    entries: state.entries.map(e =>
      (e.id || e._id) === id ? { ...e, ...updates } : e,
    ),
  })),

  setHasMore: (hasMore) => set({ hasMore }),
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),

  loadMore: () => {
    const { offset, PAGE_LIMIT } = get();
    set({ offset: offset + PAGE_LIMIT });
  },

  reset: () => set({ entries: [], hasMore: true, loading: false, refreshing: false, offset: 0 }),
}));
