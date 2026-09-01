import { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ramp_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    AuthAPI.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("ramp_access_token");
        localStorage.removeItem("ramp_refresh_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { data } = await AuthAPI.login({ username, password });
    localStorage.setItem("ramp_access_token", data.access);
    localStorage.setItem("ramp_refresh_token", data.refresh);
    const me = await AuthAPI.me();
    setUser(me.data);
  }

  async function register(payload) {
    await AuthAPI.register(payload);
    await login(payload.username, payload.password);
  }

  function logout() {
    localStorage.removeItem("ramp_access_token");
    localStorage.removeItem("ramp_refresh_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
