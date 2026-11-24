import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { LanguageCode, t as translate } from '../lib/i18n';
import type {
  AppView,
  Brand,
  Category,
  DraftMaterialItem,
  NotificationItem,
  Product,
  SupplierDirectoryItem,
  UserProfile,
} from '../types';

interface AppContextValue {
  view: AppView;
  setView: (v: AppView) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  user: UserProfile | null;
  authLoading: boolean;
  token: string | null;
  setSessionAuth: (token: string, profile: UserProfile) => void;
  signInWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  categories: Category[];
  brands: Brand[];
  products: Product[];
  suppliers: SupplierDirectoryItem[];
  catalogLoading: boolean;
  reloadCatalog: () => Promise<void>;
  draftList: DraftMaterialItem[];
  draftListName: string;
  setDraftListName: (name: string) => void;
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  addCatalogItemToDraft: (product: Product, qty?: number) => void;
  addCustomItemToDraft: (item: Omit<DraftMaterialItem, 'localId'>) => void;
  updateDraftItem: (localId: string, patch: Partial<DraftMaterialItem>) => void;
  removeDraftItem: (localId: string) => void;
  clearDraftList: () => void;
  loadItemsIntoDraft: (items: Omit<DraftMaterialItem, 'localId'>[], listName?: string) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  reloadNotifications: () => Promise<void>;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  catalogSearchQuery: string;
  setCatalogSearchQuery: (q: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (cat: string) => void;
  bannerNotice: { type: 'success' | 'error'; text: string } | null;
  showNotice: (type: 'success' | 'error', text: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<AppView>('home');
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDirectoryItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [draftList, setDraftList] = useState<DraftMaterialItem[]>([]);
  const [draftListName, setDraftListName] = useState('New Project Material List');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = useCallback((type: 'success' | 'error', text: string) => {
    setBannerNotice({ type, text });
    window.setTimeout(() => {
      setBannerNotice((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  }, []);

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      } else if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${idToken}`);
      }
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  const reloadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [catRes, supRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch('/api/suppliers'),
      ]);
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.categories || []);
        setBrands(data.brands || []);
        setProducts(data.products || []);
      }
      if (supRes.ok) {
        const supData = await supRes.json();
        setSuppliers(supData.suppliers || []);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const reloadNotifications = useCallback(async () => {
    if (!token && !auth.currentUser) {
      setNotifications([]);
      return;
    }
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // ignore transient
    }
  }, [apiFetch, token]);

  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);
          const res = await fetch('/api/auth/google-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.profile);
            if (data.profile?.preferredLanguage === 'ta') {
              setLanguageState('ta');
            }
          }
        } catch (e) {
          console.error('Firebase sync error:', e);
        }
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      reloadNotifications();
    } else {
      setNotifications([]);
    }
  }, [user, reloadNotifications]);

  const setSessionAuth = useCallback((newToken: string, profile: UserProfile) => {
    setToken(newToken);
    setUser(profile);
    if (profile.preferredLanguage === 'ta' || profile.preferredLanguage === 'en') {
      setLanguageState(profile.preferredLanguage as LanguageCode);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setToken(idToken);
    const res = await fetch('/api/auth/google-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!res.ok) {
      throw new Error('Failed to sync Google account with BuildMate');
    }
    const data = await res.json();
    setUser(data.profile);
    return data.profile as UserProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      setUser(data.profile);
    }
  }, [apiFetch]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore if not firebase session
    }
    setToken(null);
    setUser(null);
    setNotifications([]);
    setView('home');
  }, []);

  const setLanguage = useCallback(
    async (lang: LanguageCode) => {
      const safeLang: LanguageCode = lang === 'ta' ? 'ta' : 'en';
      setLanguageState(safeLang);
      if (user) {
        try {
          await apiFetch('/api/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ preferredLanguage: safeLang }),
          });
        } catch {
          // ignore
        }
      }
    },
    [apiFetch, user]
  );

  const addCatalogItemToDraft = useCallback(
    (product: Product, qty = 1) => {
      setDraftList((prev) => {
        const existing = prev.find((i) => i.productId === product.id && !i.isCustom);
        if (existing) {
          return prev.map((i) =>
            i.localId === existing.localId
              ? { ...i, quantity: i.quantity + qty }
              : i
          );
        }
        return [
          ...prev,
          {
            localId: `cat-${product.id}-${Date.now()}`,
            productId: product.id,
            isCustom: false,
            domain: product.domain,
            categoryName: product.categoryName,
            productName: product.name,
            brand: product.brandName,
            specification: product.specification,
            unit: product.unit,
            quantity: qty,
            estimatedUnitPrice: product.estimatedPrice,
            gstRate: product.gstRate,
            notes: '',
          },
        ];
      });
      showNotice('success', `Added "${product.name}" to Material List`);
    },
    [showNotice]
  );

  const addCustomItemToDraft = useCallback(
    (item: Omit<DraftMaterialItem, 'localId'>) => {
      setDraftList((prev) => [
        ...prev,
        {
          ...item,
          localId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
      ]);
      showNotice('success', `Added custom item "${item.productName}"`);
    },
    [showNotice]
  );

  const updateDraftItem = useCallback(
    (localId: string, patch: Partial<DraftMaterialItem>) => {
      setDraftList((prev) =>
        prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const removeDraftItem = useCallback((localId: string) => {
    setDraftList((prev) => prev.filter((item) => item.localId !== localId));
  }, []);

  const clearDraftList = useCallback(() => {
    setDraftList([]);
  }, []);

  const loadItemsIntoDraft = useCallback(
    (items: Omit<DraftMaterialItem, 'localId'>[], listName?: string) => {
      setDraftList(
        items.map((item, idx) => ({
          ...item,
          localId: `loaded-${idx}-${Date.now()}`,
        }))
      );
      if (listName) setDraftListName(listName);
    },
    []
  );

  const t = useCallback((key: string) => translate(language, key), [language]);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppContext.Provider
      value={{
        view,
        setView: (v) => {
          setView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        language,
        setLanguage,
        t,
        user,
        authLoading,
        token,
        setSessionAuth,
        signInWithGoogle,
        logout,
        refreshProfile,
        apiFetch,
        categories,
        brands,
        products,
        suppliers,
        catalogLoading,
        reloadCatalog,
        draftList,
        draftListName,
        setDraftListName,
        selectedProjectId,
        setSelectedProjectId,
        addCatalogItemToDraft,
        addCustomItemToDraft,
        updateDraftItem,
        removeDraftItem,
        clearDraftList,
        loadItemsIntoDraft,
        notifications,
        unreadCount,
        reloadNotifications,
        aiDrawerOpen,
        setAiDrawerOpen,
        catalogSearchQuery,
        setCatalogSearchQuery,
        selectedCategoryFilter,
        setSelectedCategoryFilter,
        bannerNotice,
        showNotice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
