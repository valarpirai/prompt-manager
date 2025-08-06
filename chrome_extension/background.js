// Background service worker for Prompt Manager Extension
class PromptManagerAPI {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.storageKeys = {
      token: 'pm_jwt_token',
      refreshToken: 'pm_refresh_token',
      tokenExpiry: 'pm_token_expiry',
      baseURL: 'pm_base_url',
      isEnabled: 'pm_is_enabled',
    };
    this.refreshPromise = null; // Prevent concurrent refresh attempts
    this.init();
  }

  async init() {
    // Load settings from storage
    const settings = await chrome.storage.local.get([
      this.storageKeys.baseURL,
      this.storageKeys.isEnabled,
    ]);

    this.baseURL = settings[this.storageKeys.baseURL] || this.baseURL;
    this.isEnabled = settings[this.storageKeys.isEnabled] !== false; // default to true
  }

  async getToken() {
    // Check if token is expired before returning it
    const result = await chrome.storage.local.get([
      this.storageKeys.token,
      this.storageKeys.tokenExpiry,
    ]);

    const token = result[this.storageKeys.token];
    const expiry = result[this.storageKeys.tokenExpiry];

    if (!token) return null;

    // If token expires in next 5 minutes, proactively refresh
    if (expiry) {
      const expiryTime = new Date(expiry).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiryTime <= now + fiveMinutes) {
        console.log('Token expires soon, attempting refresh...');
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Return the new token
          const newResult = await chrome.storage.local.get([
            this.storageKeys.token,
          ]);
          return newResult[this.storageKeys.token];
        }
        // If refresh failed but token hasn't expired yet, return current token
        if (expiryTime > now) {
          return token;
        }
        // Token is expired and refresh failed
        return null;
      }
    }

    return token;
  }

  async setToken(token, refreshToken = null, tokenExpiry = null) {
    const data = { [this.storageKeys.token]: token };
    if (refreshToken) {
      data[this.storageKeys.refreshToken] = refreshToken;
    }
    if (tokenExpiry) {
      data[this.storageKeys.tokenExpiry] = tokenExpiry;
    }
    await chrome.storage.local.set(data);
  }

  async clearTokens() {
    await chrome.storage.local.remove([
      this.storageKeys.token,
      this.storageKeys.refreshToken,
      this.storageKeys.tokenExpiry,
    ]);
    this.refreshPromise = null; // Reset refresh promise
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getToken();

    if (!token && !options.skipAuth) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (
      response.status === 401 &&
      !options.skipAuth &&
      !options._retryAttempt
    ) {
      console.log('Received 401, attempting token refresh...');
      // Try to refresh token
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // Retry with new token (mark as retry to prevent infinite loops)
        return this.makeRequest(endpoint, { ...options, _retryAttempt: true });
      } else {
        await this.clearTokens();
        throw new Error('Authentication expired');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async tryRefreshToken() {
    // Prevent concurrent refresh attempts
    if (this.refreshPromise) {
      console.log('Token refresh already in progress, waiting...');
      return await this.refreshPromise;
    }

    this.refreshPromise = this._performTokenRefresh();
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  async _performTokenRefresh() {
    try {
      const result = await chrome.storage.local.get([
        this.storageKeys.refreshToken,
      ]);
      const refreshToken = result[this.storageKeys.refreshToken];

      if (!refreshToken) {
        console.log('No refresh token found');
        return false;
      }

      console.log('Attempting to refresh token...');
      const response = await fetch(
        `${this.baseURL}/api/auth/extension-refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Token refresh successful');

        // Fix field mapping: API returns accessToken, but extension expects token
        const newToken = data.accessToken || data.token;
        const newRefreshToken = data.refreshToken;
        const tokenExpiry = data.tokenExpiry;

        if (!newToken) {
          console.error('No access token in refresh response:', data);
          return false;
        }

        await this.setToken(newToken, newRefreshToken, tokenExpiry);
        return true;
      } else {
        const errorText = await response.text();
        console.error('Token refresh failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }

    return false;
  }

  async getPromptByTitle(title) {
    try {
      const response = await this.makeRequest(
        `/api/prompts?title=${encodeURIComponent(title)}&exact=true`
      );

      console.log('getPromptByTitle response:', response);

      if (response && response.prompts && response.prompts.length > 0) {
        // Return the most recent accessible prompt
        const prompts = response.prompts;
        return prompts.sort(
          (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
        )[0];
      }

      return null;
    } catch (error) {
      console.error('Error in getPromptByTitle:', error);
      throw error;
    }
  }

  async getPromptTitles(query = '', limit = 20) {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      params.append('limit', limit.toString());

      const data = await this.makeRequest(`/api/prompts/titles?${params}`);
      return data.prompts || [];
    } catch (error) {
      console.error('Error fetching prompt titles:', error);
      return [];
    }
  }

  async incrementUsage(promptId) {
    try {
      await this.makeRequest(`/api/prompts/${promptId}/usage`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to increment usage:', error);
      // Don't throw - usage tracking is not critical
    }
  }

  async openLoginPage() {
    const loginURL = `${this.baseURL}/auth/extension-login`;
    await chrome.tabs.create({ url: loginURL });
  }

  async updateSettings(settings) {
    await chrome.storage.local.set(settings);

    // Update instance properties
    if (settings[this.storageKeys.baseURL]) {
      this.baseURL = settings[this.storageKeys.baseURL];
    }
    if (settings[this.storageKeys.isEnabled] !== undefined) {
      this.isEnabled = settings[this.storageKeys.isEnabled];
    }
  }

  async getSettings() {
    const settings = await chrome.storage.local.get([
      this.storageKeys.baseURL,
      this.storageKeys.isEnabled,
      this.storageKeys.token,
    ]);

    return {
      baseURL: settings[this.storageKeys.baseURL] || this.baseURL,
      isEnabled: settings[this.storageKeys.isEnabled] !== false,
      isLoggedIn: !!settings[this.storageKeys.token],
    };
  }
}

// Initialize API instance
const api = new PromptManagerAPI();

// Message handling from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PROMPT') {
    handleGetPrompt(request, sendResponse);
    return true; // Keep message channel open for async response
  } else if (request.type === 'OPEN_LOGIN') {
    handleOpenLogin(sendResponse);
    return true;
  } else if (request.type === 'GET_SETTINGS') {
    handleGetSettings(sendResponse);
    return true;
  } else if (request.type === 'UPDATE_SETTINGS') {
    handleUpdateSettings(request, sendResponse);
    return true;
  } else if (request.type === 'LOGOUT') {
    handleLogout(sendResponse);
    return true;
  } else if (request.type === 'SAVE_AUTH_TOKENS') {
    handleSaveAuthTokens(request, sendResponse);
    return true;
  } else if (request.type === 'GET_PROMPT_TITLES') {
    handleGetPromptTitles(request, sendResponse);
    return true;
  }
});

async function handleGetPrompt(request, sendResponse) {
  try {
    const settings = await api.getSettings();

    if (!settings.isEnabled) {
      sendResponse({
        success: false,
        error: 'Extension is disabled',
      });
      return;
    }

    if (!settings.isLoggedIn) {
      sendResponse({
        success: false,
        error: 'Not authenticated',
        needsAuth: true,
      });
      return;
    }

    const prompt = await api.getPromptByTitle(request.title);

    if (prompt) {
      // Increment usage count
      api.incrementUsage(prompt.id);

      sendResponse({
        success: true,
        promptText: prompt.prompt_text || prompt.content,
        promptId: prompt.id,
      });
    } else {
      sendResponse({
        success: false,
        error: `Prompt '${request.title}' not found`,
      });
    }
  } catch (error) {
    console.error('Error fetching prompt:', error);

    if (error.message === 'Authentication expired') {
      sendResponse({
        success: false,
        error: 'Please log in again',
        needsAuth: true,
      });
    } else {
      sendResponse({
        success: false,
        error: 'Failed to fetch prompt. Try again later.',
      });
    }
  }
}

async function handleOpenLogin(sendResponse) {
  try {
    await api.openLoginPage();
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error opening login page:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetSettings(sendResponse) {
  try {
    const settings = await api.getSettings();
    sendResponse({ success: true, settings });
  } catch (error) {
    console.error('Error getting settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUpdateSettings(request, sendResponse) {
  try {
    await api.updateSettings(request.settings);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleLogout(sendResponse) {
  try {
    await api.clearTokens();
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSaveAuthTokens(request, sendResponse) {
  try {
    const token = request.accessToken || request.token;
    const refreshToken = request.refreshToken;
    const tokenExpiry = request.tokenExpiry;

    if (!token) {
      throw new Error('No access token provided');
    }

    await api.setToken(token, refreshToken, tokenExpiry);
    console.log('Auth tokens saved successfully');
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error saving auth tokens:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetPromptTitles(request, sendResponse) {
  try {
    const settings = await api.getSettings();

    if (!settings.isEnabled) {
      sendResponse({
        success: false,
        error: 'Extension is disabled',
      });
      return;
    }

    if (!settings.isLoggedIn) {
      sendResponse({
        success: false,
        error: 'Not authenticated',
        needsAuth: true,
      });
      return;
    }

    const prompts = await api.getPromptTitles(request.query, request.limit);
    sendResponse({
      success: true,
      prompts,
    });
  } catch (error) {
    console.error('Error fetching prompt titles:', error);
    sendResponse({
      success: false,
      error: 'Failed to fetch prompt titles',
    });
  }
}

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Prompt Manager Extension installed');
    // Set default settings
    chrome.storage.local.set({
      [api.storageKeys.baseURL]: api.baseURL,
      [api.storageKeys.isEnabled]: true,
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Prompt Manager Extension started');
});
