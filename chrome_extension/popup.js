// Popup JavaScript
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.updateStatus();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      window.close();
    });

    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin();
    });
  }

  async updateStatus() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });

      if (response.success) {
        const settings = response.settings;
        const statusDiv = document.getElementById('status');
        const loginBtn = document.getElementById('login-btn');

        if (!settings.isLoggedIn) {
          statusDiv.textContent = 'Please log in to use the extension';
          statusDiv.className = 'status not-logged-in';
          loginBtn.style.display = 'block';
        } else if (!settings.isEnabled) {
          statusDiv.textContent = 'Extension is disabled';
          statusDiv.className = 'status disabled';
          loginBtn.style.display = 'none';
        } else {
          statusDiv.textContent = 'Extension is ready';
          statusDiv.className = 'status enabled';
          loginBtn.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async handleLogin() {
    try {
      await this.sendMessage({ type: 'OPEN_LOGIN' });
      window.close();
    } catch (error) {
      console.error('Error opening login:', error);
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
  new PopupManager();
});
