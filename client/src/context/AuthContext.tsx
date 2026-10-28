'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setAuthTokens } from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res?.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = pathname === '/login' || pathname === '/forgot-password';

    if (!user && !isPublicRoute) {
      router.push('/login');
      return;
    }

    if (user) {
      // Force password reset if flagged
      if (user.mustChangePassword && pathname !== '/set-password') {
        router.push('/set-password');
        return;
      }

      if (isPublicRoute) {
        if (user.role === 'ADMIN') {
          router.push('/admin/dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password });
    const loggedUser = res.data.user;
    
    // Store tokens in memory/localStorage to withstand cross-site Incognito third-party cookie blocking
    const accessToken = res.data?.accessToken || res.data?.token;
    const refreshToken = res.data?.refreshToken;
    if (accessToken) {
      setAuthTokens(accessToken, refreshToken);
    }

    setUser(loggedUser);

    if (loggedUser.mustChangePassword) {
      router.push('/set-password');
    } else if (loggedUser.role === 'ADMIN') {
      router.push('/admin/dashboard');
    } else {
      router.push('/dashboard');
    }
    return loggedUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthTokens(null, null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
