interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseURL: string;
  private refreshing: Promise<boolean> | null = null;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  private async getAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async getRefreshToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshing) {
      return this.refreshing;
    }

    this.refreshing = this._refreshAccessToken();
    const result = await this.refreshing;
    this.refreshing = null;
    return result;
  }

  private async _refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        this.redirectToLogin();
        return false;
      }

      const response = await fetch(`${this.baseURL}/auth/extension-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.redirectToLogin();
        return false;
      }

      const data = await response.json();

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.redirectToLogin();
      return false;
    }
  }

  private redirectToLogin() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseURL}${endpoint}`;
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401 && token) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newToken = await this.getAccessToken();
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            },
          });

          if (retryResponse.ok) {
            const data = await retryResponse.json();
            return {
              ok: true,
              status: retryResponse.status,
              data,
            };
          } else {
            const errorData = await retryResponse.json().catch(() => ({}));
            return {
              ok: false,
              status: retryResponse.status,
              error: errorData.error || 'Request failed',
            };
          }
        }

        return {
          ok: false,
          status: 401,
          error: 'Authentication failed',
        };
      }

      if (response.ok) {
        const data = await response.json();
        return {
          ok: true,
          status: response.status,
          data,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          status: response.status,
          error: errorData.error || 'Request failed',
        };
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export type { ApiResponse };
