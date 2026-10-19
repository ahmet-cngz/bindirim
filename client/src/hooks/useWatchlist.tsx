import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { PriceAlert, Watch } from "../types/models";
import { listAll, request } from "../utils/api";
import { errorMessage } from "../utils/watch";
import { useAuth } from "./useAuth";

interface WatchlistContextValue {
  watches: Watch[];
  alerts: PriceAlert[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  reload: () => Promise<void>;
  addWatch: (url: string, target: string) => Promise<Watch>;
  updateWatch: (id: number, target: string, enabled: boolean) => Promise<Watch>;
  removeWatch: (id: number) => Promise<void>;
  markRead: (id: number) => Promise<void>;
}
const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [watches, setWatches] = useState<Watch[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    setRefreshing(true);
    try {
      const [nextWatches, nextAlerts] = await Promise.all([
        listAll<Watch>("watches/", token),
        listAll<PriceAlert>("alerts/", token),
      ]);
      if (current === sequence.current) {
        setWatches(nextWatches);
        setAlerts(nextAlerts);
        setError("");
      }
    } catch (err) {
      if (current === sequence.current) setError(errorMessage(err));
    } finally {
      if (current === sequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [token]);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    reload();
    const onVisible = () => {
      if (!document.hidden) reload();
    };
    const timer = window.setInterval(onVisible, 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      invalidate();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, invalidate]);
  const addWatch = async (url: string, target: string) => {
    const watch = await request<Watch>("watches/", token, {
      method: "POST",
      data: {
        url: url.trim(),
        target_price: target || null,
        alerts_enabled: true,
      },
    });
    sequence.current++;
    setRefreshing(false);
    setError("");
    setWatches((items) => [watch, ...items]);
    return watch;
  };
  const updateWatch = async (id: number, target: string, enabled: boolean) => {
    const watch = await request<Watch>(`watches/${id}/`, token, {
      method: "PATCH",
      data: { target_price: target || null, alerts_enabled: enabled },
    });
    sequence.current++;
    setRefreshing(false);
    setWatches((items) => items.map((item) => (item.id === id ? watch : item)));
    return watch;
  };
  const removeWatch = async (id: number) => {
    await request(`watches/${id}/`, token, { method: "DELETE" });
    sequence.current++;
    setRefreshing(false);
    setWatches((items) => items.filter((item) => item.id !== id));
    setAlerts((items) => items.filter((item) => item.watch !== id));
  };
  const markRead = async (id: number) => {
    const alert = await request<PriceAlert>(`alerts/${id}/mark-read/`, token, {
      method: "POST",
      data: {},
    });
    sequence.current++;
    setRefreshing(false);
    setAlerts((items) => items.map((item) => (item.id === id ? alert : item)));
  };
  return (
    <WatchlistContext.Provider
      value={{
        watches,
        alerts,
        loading,
        refreshing,
        error,
        reload,
        addWatch,
        updateWatch,
        removeWatch,
        markRead,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context)
    throw new Error("useWatchlist must be used within WatchlistProvider.");
  return context;
}
