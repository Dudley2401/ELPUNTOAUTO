import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null); // null = checking, false = anon, object = admin
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setAdmin(data);
    } catch {
      setAdmin(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAdmin({ id: data.id, email: data.email, name: data.name, role: data.role });
      return true;
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    setAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ admin, error, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
