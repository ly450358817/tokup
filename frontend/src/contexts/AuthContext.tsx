import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../utils/api';

interface User {
  id: string;
  email: string;
  nickname: string;
  token_balance: number;
  total_recharged: number;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuth: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      localStorage.removeItem('tokup_token');
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('tokup_token');
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('tokup_token', data.token);
    await refreshUser();
  };

  const register = async (email: string, password: string) => {
    const data = await authApi.register(email, password);
    localStorage.setItem('tokup_token', data.token);
    await refreshUser();
  };

  const logout = () => {
    localStorage.removeItem('tokup_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuth: !!user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
