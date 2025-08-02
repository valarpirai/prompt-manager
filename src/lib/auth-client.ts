'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { apiClient } from './api-client';

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  is_verified: boolean;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true;
  }
}

async function refreshTokenIfNeeded(): Promise<boolean> {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  if (!accessToken || !refreshToken) {
    return false;
  }

  if (!isTokenExpired(accessToken)) {
    return true;
  }

  const response = await apiClient.post<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }>('/auth/extension-refresh', {
    refreshToken,
  });

  if (response.ok && response.data) {
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return true;
  }

  return false;
}

export function useAuthRedirect(redirectTo?: string) {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');

      if (!userData || !token) {
        const currentPath = window.location.pathname + window.location.search;
        const loginUrl = redirectTo
          ? `/login?redirect=${encodeURIComponent(redirectTo)}`
          : `/login?redirect=${encodeURIComponent(currentPath)}`;

        router.push(loginUrl);
        return;
      }

      const isValid = await refreshTokenIfNeeded();
      if (!isValid) {
        const currentPath = window.location.pathname + window.location.search;
        const loginUrl = redirectTo
          ? `/login?redirect=${encodeURIComponent(redirectTo)}`
          : `/login?redirect=${encodeURIComponent(currentPath)}`;

        router.push(loginUrl);
      }
    };

    checkAuth();
  }, [router, redirectTo]);
}

export function getAuthUser(): User | null {
  if (typeof window === 'undefined') return null;

  const userData = localStorage.getItem('user');
  const token = localStorage.getItem('accessToken');

  if (!userData || !token) return null;

  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

export function redirectToLogin(currentPath?: string) {
  const redirectPath =
    currentPath || window.location.pathname + window.location.search;
  const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  window.location.href = loginUrl;
}

export function logout() {
  localStorage.removeItem('user');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}

export { apiClient } from './api-client';
export { refreshTokenIfNeeded };
