// Options page JavaScript
class OptionsManager {
  constructor() {
    this.init();
  }

  async init() {
    // Load current settings
    await this.loadSettings();

    // Set up event listeners
    this.setupEventListeners();

    // Check authentication status
    await this.checkAuthStatus();
  }

  setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    document
      .getElementById('save-settings-btn')
      .addEventListener('click', () => {
        this.saveSettings();
      });

    document
      .getElementById('reset-settings-btn')
      .addEventListener('click', () => {
        this.resetSettings();
      });
  }

  async loadSettings() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });

      if (response.success) {
        const settings = response.settings;

        // Update UI with current settings
        document.getElementById('enabled-toggle').checked = settings.isEnabled;
        document.getElementById('api-url').value = settings.baseURL;

        // Update auth status
        this.updateAuthUI(settings.isLoggedIn);
      } else {
        this.showStatus('Failed to load settings', 'error');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  async saveSettings() {
    try {
      const isEnabled = document.getElementById('enabled-toggle').checked;
      const baseURL = document.getElementById('api-url').value.trim();

      // Validate URL
      if (!baseURL) {
        this.showStatus('Please enter a valid URL', 'error');
        return;
      }

      try {
        new URL(baseURL);
      } catch {
        this.showStatus('Please enter a valid URL', 'error');
        return;
      }

      const settings = {
        pm_is_enabled: isEnabled,
        pm_base_url: baseURL,
      };

      const response = await this.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: settings,
      });

      if (response.success) {
        this.showStatus('Settings saved successfully', 'success');
      } else {
        this.showStatus('Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('Error saving settings', 'error');
    }
  }

  resetSettings() {
    document.getElementById('enabled-toggle').checked = true;
    document.getElementById('api-url').value = 'https://prompt-manager.com';

    this.showStatus('Settings reset to defaults', 'info');
  }

  async handleLogin() {
    try {
      const response = await this.sendMessage({ type: 'OPEN_LOGIN' });

      if (response.success) {
        this.showStatus(
          'Login page opened. Please log in and return to this page.',
          'info'
        );

        // Poll for auth status changes
        this.pollAuthStatus();
      } else {
        this.showStatus('Failed to open login page', 'error');
      }
    } catch (error) {
      console.error('Error opening login:', error);
      this.showStatus('Error opening login page', 'error');
    }
  }

  async handleLogout() {
    try {
      const response = await this.sendMessage({ type: 'LOGOUT' });

      if (response.success) {
        this.updateAuthUI(false);
        this.showStatus('Logged out successfully', 'success');
      } else {
        this.showStatus('Failed to logout', 'error');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      this.showStatus('Error during logout', 'error');
    }
  }

  async checkAuthStatus() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });

      if (response.success) {
        this.updateAuthUI(response.settings.isLoggedIn);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  }

  pollAuthStatus() {
    const pollInterval = setInterval(async () => {
      try {
        const response = await this.sendMessage({ type: 'GET_SETTINGS' });

        if (response.success && response.settings.isLoggedIn) {
          this.updateAuthUI(true);
          this.showStatus('Successfully logged in!', 'success');
          clearInterval(pollInterval);
        }
      } catch (error) {
        // Continue polling
      }
    }, 2000);

    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 120000);
  }

  updateAuthUI(isLoggedIn) {
    const userInfoDiv = document.getElementById('user-info');
    const notLoggedInDiv = document.getElementById('not-logged-in');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (isLoggedIn) {
      userInfoDiv.classList.remove('hidden');
      notLoggedInDiv.classList.add('hidden');
      loginBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');

      // Try to get user email from token (if available)
      this.updateUserEmail();
    } else {
      userInfoDiv.classList.add('hidden');
      notLoggedInDiv.classList.remove('hidden');
      loginBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
    }
  }

  async updateUserEmail() {
    // This would require decoding the JWT token or making an API call
    // For now, just show a generic message
    document.getElementById('user-email').textContent = 'Active session';
  }

  showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 3000);
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});
