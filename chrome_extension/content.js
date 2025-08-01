// Content script for Prompt Manager Extension
class PromptDetector {
  constructor() {
    this.isProcessing = false;
    this.tooltipTimeout = null;
    this.activeElement = null;
    this.init();
  }

  init() {
    // Listen for keydown events on the entire document
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('input', this.handleInput.bind(this), true);
    
    // Clean up when extension is disabled
    this.checkExtensionStatus();
  }

  async checkExtensionStatus() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success && !response.settings.isEnabled) {
        this.removeListeners();
      }
    } catch (error) {
      console.error('Failed to check extension status:', error);
    }
  }

  removeListeners() {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.removeEventListener('input', this.handleInput.bind(this), true);
  }

  isValidTextElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName?.toLowerCase();
    const type = element.type?.toLowerCase();
    
    // Check for text inputs and textareas
    if (tagName === 'textarea') return true;
    if (tagName === 'input') {
      // Only allow text-like input types
      const validTypes = ['text', 'search', 'url', 'email', 'tel'];
      return !type || validTypes.includes(type);
    }
    
    // Check for contenteditable elements
    if (element.contentEditable === 'true') return true;
    
    return false;
  }

  handleInput(event) {
    const element = event.target;
    if (!this.isValidTextElement(element)) return;
    
    this.activeElement = element;
  }

  async handleKeyDown(event) {
    if (this.isProcessing) return;
    
    const element = event.target;
    if (!this.isValidTextElement(element)) return;

    const isTab = event.key === 'Tab';
    const isShiftEnter = event.key === 'Enter' && event.shiftKey;
    
    if (!isTab && !isShiftEnter) return;

    const promptMatch = this.extractPromptName(element);
    if (!promptMatch) return;

    // Prevent default behavior
    event.preventDefault();
    event.stopPropagation();

    this.isProcessing = true;
    
    try {
      await this.processPromptReplacement(element, promptMatch);
    } catch (error) {
      console.error('Error processing prompt:', error);
      this.showTooltip(element, 'An error occurred. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  extractPromptName(element) {
    let value, selectionStart, selectionEnd;
    
    if (element.contentEditable === 'true') {
      // Handle contenteditable elements
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return null;
      
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      if (textNode.nodeType !== Node.TEXT_NODE) return null;
      
      value = textNode.textContent;
      selectionStart = range.startOffset;
      selectionEnd = range.endOffset;
    } else {
      // Handle input and textarea elements
      value = element.value;
      selectionStart = element.selectionStart;
      selectionEnd = element.selectionEnd;
    }

    if (!value) return null;

    // Look for ::promptname pattern before cursor
    const beforeCursor = value.substring(0, selectionStart);
    const match = beforeCursor.match(/::([a-zA-Z0-9\s\-_]+)$/);
    
    if (!match) return null;

    const fullMatch = match[0]; // ::promptname
    const promptName = match[1].trim(); // promptname
    const startPos = selectionStart - fullMatch.length;
    
    return {
      promptName,
      startPos,
      endPos: selectionStart,
      fullMatch,
      element
    };
  }

  async processPromptReplacement(element, promptMatch) {
    try {
      const response = await this.sendMessage({
        type: 'GET_PROMPT',
        title: promptMatch.promptName
      });

      if (response.success) {
        this.replaceText(element, promptMatch, response.promptText);
        this.showTooltip(element, `Inserted prompt: ${promptMatch.promptName}`, 'success');
      } else {
        if (response.needsAuth) {
          this.showTooltip(element, 'Please log in', 'error');
          // Optionally open login page
          this.sendMessage({ type: 'OPEN_LOGIN' });
        } else {
          this.showTooltip(element, response.error || 'Prompt not found', 'error');
        }
      }
    } catch (error) {
      console.error('Failed to get prompt:', error);
      this.showTooltip(element, 'Failed to fetch prompt. Try again later.', 'error');
    }
  }

  replaceText(element, promptMatch, newText) {
    if (element.contentEditable === 'true') {
      this.replaceTextInContentEditable(element, promptMatch, newText);
    } else {
      this.replaceTextInInput(element, promptMatch, newText);
    }
  }

  replaceTextInInput(element, promptMatch, newText) {
    const value = element.value;
    const newValue = value.substring(0, promptMatch.startPos) + 
                    newText + 
                    value.substring(promptMatch.endPos);
    
    element.value = newValue;
    
    // Set cursor position after the inserted text
    const newCursorPos = promptMatch.startPos + newText.length;
    element.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger input event for any listeners
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  replaceTextInContentEditable(element, promptMatch, newText) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    
    // Create new text content
    const oldText = textNode.textContent;
    const newTextContent = oldText.substring(0, promptMatch.startPos) + 
                          newText + 
                          oldText.substring(promptMatch.endPos);
    
    textNode.textContent = newTextContent;
    
    // Set cursor position after inserted text
    const newCursorPos = promptMatch.startPos + newText.length;
    range.setStart(textNode, newCursorPos);
    range.setEnd(textNode, newCursorPos);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  showTooltip(element, message, type = 'info') {
    // Clear existing tooltip
    this.clearTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.id = 'prompt-manager-tooltip';
    tooltip.textContent = message;
    
    // Style the tooltip
    Object.assign(tooltip.style, {
      position: 'fixed',
      zIndex: '999999',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: 'white',
      pointerEvents: 'none',
      maxWidth: '300px',
      wordWrap: 'break-word',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      transition: 'opacity 0.2s ease-in-out'
    });
    
    // Set color based on type
    if (type === 'success') {
      tooltip.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
      tooltip.style.backgroundColor = '#ef4444';
    } else {
      tooltip.style.backgroundColor = '#374151';
    }
    
    // Position tooltip near the element
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    
    // Add to document
    document.body.appendChild(tooltip);
    
    // Auto-hide after 3 seconds
    this.tooltipTimeout = setTimeout(() => {
      this.clearTooltip();
    }, 3000);
  }

  clearTooltip() {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    
    const existingTooltip = document.getElementById('prompt-manager-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PromptDetector();
    initExtensionLoginListener();
  });
} else {
  new PromptDetector();
  initExtensionLoginListener();
}

// Handle extension login page communication
function initExtensionLoginListener() {
  // Only run on extension login pages
  if (window.location.pathname.includes('/auth/extension-login')) {
    // Listen for custom events from the extension login page
    window.addEventListener('extensionLoginSuccess', (event) => {
      const { accessToken, refreshToken, user } = event.detail;
      
      // Send tokens to background script
      chrome.runtime.sendMessage({
        type: 'SAVE_AUTH_TOKENS',
        accessToken,
        refreshToken,
        user
      }, (response) => {
        if (response && response.success) {
          console.log('Extension login successful');
          // Close the tab after a brief delay
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          console.error('Failed to save tokens to extension:', response);
        }
      });
    });

    // Also check localStorage periodically for fallback tokens
    const checkForTokens = () => {
      const token = localStorage.getItem('extensionAuthToken');
      const refreshToken = localStorage.getItem('extensionRefreshToken');
      const user = localStorage.getItem('extensionUser');
      
      if (token && refreshToken && user) {
        // Clear the localStorage items
        localStorage.removeItem('extensionAuthToken');
        localStorage.removeItem('extensionRefreshToken');
        localStorage.removeItem('extensionUser');
        
        // Send to extension
        chrome.runtime.sendMessage({
          type: 'SAVE_AUTH_TOKENS',
          accessToken: token,
          refreshToken: refreshToken,
          user: JSON.parse(user)
        }, (response) => {
          if (response && response.success) {
            console.log('Extension login successful via localStorage');
          } else {
            console.error('Failed to save tokens to extension:', response);
          }
        });
      }
    };
    
    // Check for tokens every second for 10 seconds
    let attempts = 0;
    const tokenCheckInterval = setInterval(() => {
      checkForTokens();
      attempts++;
      if (attempts >= 10) {
        clearInterval(tokenCheckInterval);
      }
    }, 1000);
  }
}

// Handle dynamic content changes
const observer = new MutationObserver((mutations) => {
  // Reinitialize if significant DOM changes occur
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if any text input elements were added
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const textElements = node.querySelectorAll('input[type="text"], input[type="search"], input[type="url"], input[type="email"], textarea, [contenteditable="true"]');
          if (textElements.length > 0 || node.matches('input[type="text"], input[type="search"], input[type="url"], input[type="email"], textarea, [contenteditable="true"]')) {
            // New text elements added, detector should handle them automatically
          }
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});