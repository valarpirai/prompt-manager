'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  is_verified: boolean;
}

export function useAuthRedirect(redirectTo?: string) {
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    if (!userData || !token) {
      const currentPath = window.location.pathname + window.location.search;
      const loginUrl = redirectTo
        ? `/login?redirect=${encodeURIComponent(redirectTo)}`
        : `/login?redirect=${encodeURIComponent(currentPath)}`;

      router.push(loginUrl);
    }
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
