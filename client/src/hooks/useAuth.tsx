import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ApiError, request } from "../utils/api";
import { errorMessage } from "../utils/watch";
import type { User } from "../types/models";
import type { NotificationPreferences } from "../utils/api.types";

const SESSION_KEY = "bindirim.session";
function readToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}
function persistToken(token: string) {
  try {
    token
      ? sessionStorage.setItem(SESSION_KEY, token)
      : sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* In-memory auth still works. */
  }
}

interface AuthContextValue {
  token: string;
  user: User | null;
  loading: boolean;
  error: string;
  authenticate: (
    email: string,
    password: string,
    signup: boolean,
  ) => Promise<void>;
  updateNotificationPreferences: (preferences: NotificationPreferences) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  retry: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const clearSession = useCallback(() => {
    persistToken("");
    setToken("");
    setUser(null);
    setLoading(false);
    setError("");
  }, []);

  useEffect(() => {
    const handleExpired = () => clearSession();
    window.addEventListener("bindirim:unauthorized", handleExpired);
    return () =>
      window.removeEventListener("bindirim:unauthorized", handleExpired);
  }, [clearSession]);

  useEffect(() => {
    if (!token || user) return;
    let active = true;
    setLoading(true);
    setError("");
    request<User>("auth/me/", token)
      .then((result) => {
        if (active) setUser(result);
      })
      .catch((err) => {
        if (active && (!(err instanceof ApiError) || err.status !== 401))
          setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, user, attempt]);

  const authenticate = async (
    email: string,
    password: string,
    signup: boolean,
  ) => {
    const result = await request<{ user: User; token: string }>(
      `auth/${signup ? "register" : "login"}/`,
      undefined,
      { method: "POST", data: { email, password } },
    );
    persistToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setError("");
  };
  const updateNotificationPreferences = async (preferences: NotificationPreferences) => {
    const updated = await request<User>("auth/me/", token, {
      method: "PATCH", data: preferences,
    });
    setUser(updated);
  };
  const logout = async () => {
    await request("auth/logout/", token, { method: "POST", data: {} });
    clearSession();
  };
  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        error,
        authenticate,
        updateNotificationPreferences,
        logout,
        clearSession,
        retry: () => setAttempt((n) => n + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
