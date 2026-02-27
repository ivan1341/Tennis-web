import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginRequest, registerRequest, getMeRequest } from '../services/authService';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'tennis_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const initialize = async () => {
      if (!token) return;
      try {
        const me = await getMeRequest(token);
        setUser(me);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    };

    void initialize();
  }, [token]);

  const login = async (phone: string, password: string) => {
    const { token: newToken, user: authUser } = await loginRequest(phone, password);
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(authUser);
  };

  const register = async (name: string, phone: string, password: string) => {
    const { token: newToken, user: authUser } = await registerRequest(name, phone, password);
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(authUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

