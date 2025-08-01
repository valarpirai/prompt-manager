// Content script for Prompt Manager Extension
class PromptDetector {
  constructor() {
    this.isProcessing = false;
    this.tooltipTimeout = null;
    this.activeElement = null;
    this.autocompleteDropdown = null;
    this.autocompletePrompts = [];
    this.selectedIndex = -1;
    this.currentQuery = '';
    this.autocompleteTimeout = null;
    this.currentAutocompleteMatch = null;
    this.init();
  }

  init() {
    // Listen for keydown events on the entire document
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('click', this.handleClick.bind(this), true);
    
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
    document.removeEventListener('click', this.handleClick.bind(this), true);
  }

  handleClick(event) {
    // Hide autocomplete if clicking outside of input or dropdown
    if (this.autocompleteDropdown && this.autocompleteDropdown.style.display !== 'none') {
      const target = event.target;
      const clickedOnInput = this.isValidTextElement(target);
      const clickedOnDropdown = this.autocompleteDropdown.contains(target);
      
      if (!clickedOnInput && !clickedOnDropdown) {
        this.hideAutocomplete();
      }
    }
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
    
    // Check for autocomplete trigger
    const autocompleteMatch = this.detectAutocomplete(element);
    if (autocompleteMatch) {
      this.currentAutocompleteMatch = autocompleteMatch;
      this.showAutocomplete(element, autocompleteMatch);
    } else {
      this.hideAutocomplete();
    }
  }

  async handleKeyDown(event) {
    if (this.isProcessing) return;
    
    const element = event.target;
    if (!this.isValidTextElement(element)) return;

    // Handle autocomplete navigation
    if (this.autocompleteDropdown && this.autocompleteDropdown.style.display !== 'none') {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectNextAutocomplete();
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectPrevAutocomplete();
        return;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectAutocompleteItem(this.selectedIndex);
        }
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.hideAutocomplete();
        return;
      }
    }

    const isTab = event.key === 'Tab';
    const isShiftEnter = event.key === 'Enter' && event.shiftKey;
    
    if (!isTab && !isShiftEnter) return;

    // Don't process if autocomplete is showing
    if (this.autocompleteDropdown && this.autocompleteDropdown.style.display !== 'none') {
      return;
    }

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
    const match = beforeCursor.match(/::(.*)$/);
    
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
    
    console.log('Replacing text in input:');
    console.log('Original value:', value);
    console.log('Match start pos:', promptMatch.startPos);
    console.log('Match end pos:', promptMatch.endPos);
    console.log('Text to replace:', value.substring(promptMatch.startPos, promptMatch.endPos));
    console.log('New text:', newText);
    
    const newValue = value.substring(0, promptMatch.startPos) + 
                    newText + 
                    value.substring(promptMatch.endPos);
    
    console.log('New value:', newValue);
    
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
    
    console.log('Replacing text in contentEditable:');
    console.log('Original text:', oldText);
    console.log('Match start pos:', promptMatch.startPos);
    console.log('Match end pos:', promptMatch.endPos);
    console.log('Text to replace:', oldText.substring(promptMatch.startPos, promptMatch.endPos));
    console.log('New text:', newText);
    
    const newTextContent = oldText.substring(0, promptMatch.startPos) + 
                          newText + 
                          oldText.substring(promptMatch.endPos);
    
    console.log('New text content:', newTextContent);
    
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

  detectAutocomplete(element) {
    let value, selectionStart;
    
    if (element.contentEditable === 'true') {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return null;
      
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      if (textNode.nodeType !== Node.TEXT_NODE) return null;
      
      value = textNode.textContent;
      selectionStart = range.startOffset;
    } else {
      value = element.value;
      selectionStart = element.selectionStart;
    }

    if (!value) return null;

    // Look for :: pattern before cursor - simple greedy match
    const beforeCursor = value.substring(0, selectionStart);
    const match = beforeCursor.match(/::(.*)$/);
    
    if (!match) return null;

    const fullMatch = match[0]; // This includes the :: prefix
    const query = match[1];     // This is just the query part
    const startPos = selectionStart - fullMatch.length;
    
    console.log('detectAutocomplete:', { beforeCursor, fullMatch, query, startPos, selectionStart });
    
    return {
      query,
      promptName: query.trim(), // Add this for compatibility with replaceText
      fullMatch,
      startPos,
      endPos: selectionStart,
      element
    };
  }

  async showAutocomplete(element, autocompleteMatch) {
    const query = autocompleteMatch.query;
    
    // Debounce the API call
    if (this.autocompleteTimeout) {
      clearTimeout(this.autocompleteTimeout);
    }
    
    this.autocompleteTimeout = setTimeout(async () => {
      try {
        // Only fetch if query changed
        if (this.currentQuery !== query) {
          this.currentQuery = query;
          const response = await this.sendMessage({
            type: 'GET_PROMPT_TITLES',
            query: query,
            limit: 10
          });

          if (response.success) {
            this.autocompletePrompts = response.prompts;
            this.selectedIndex = -1;
            this.renderAutocomplete(element);
          } else {
            this.hideAutocomplete();
          }
        }
      } catch (error) {
        console.error('Failed to fetch prompt titles:', error);
        this.hideAutocomplete();
      }
    }, 200);
  }

  renderAutocomplete(element) {
    if (this.autocompletePrompts.length === 0) {
      this.hideAutocomplete();
      return;
    }

    if (!this.autocompleteDropdown) {
      this.createAutocompleteDropdown();
    }

    // Clear existing items
    this.autocompleteDropdown.innerHTML = '';

    // Add prompt items
    this.autocompletePrompts.forEach((prompt, index) => {
      const item = document.createElement('div');
      item.className = 'prompt-autocomplete-item';
      item.dataset.index = index;
      
      item.innerHTML = `
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-meta">
          <span class="prompt-visibility ${prompt.visibility.toLowerCase()}">${prompt.visibility}</span>
          ${prompt.team ? `<span class="prompt-team">${this.escapeHtml(prompt.team)}</span>` : ''}
          <span class="prompt-owner">by ${this.escapeHtml(prompt.owner)}</span>
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.selectAutocompleteItem(index);
      });
      
      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.updateAutocompleteSelection();
      });
      
      this.autocompleteDropdown.appendChild(item);
    });

    // Position dropdown
    this.positionAutocomplete(element);
    this.autocompleteDropdown.style.display = 'block';
  }

  createAutocompleteDropdown() {
    this.autocompleteDropdown = document.createElement('div');
    this.autocompleteDropdown.id = 'prompt-autocomplete-dropdown';
    
    // Styles
    Object.assign(this.autocompleteDropdown.style, {
      position: 'fixed',
      zIndex: '999999',
      maxHeight: '200px',
      overflowY: 'auto',
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      minWidth: '300px',
      display: 'none'
    });

    // Add CSS for items
    const style = document.createElement('style');
    style.textContent = `
      .prompt-autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      }
      .prompt-autocomplete-item:last-child {
        border-bottom: none;
      }
      .prompt-autocomplete-item:hover,
      .prompt-autocomplete-item.selected {
        background-color: #f3f4f6;
      }
      .prompt-title {
        font-weight: 500;
        color: #1f2937;
        margin-bottom: 2px;
      }
      .prompt-meta {
        display: flex;
        gap: 8px;
        font-size: 12px;
        color: #6b7280;
      }
      .prompt-visibility {
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
        text-transform: uppercase;
      }
      .prompt-visibility.public {
        background-color: #dcfce7;
        color: #166534;
      }
      .prompt-visibility.private {
        background-color: #f3f4f6;
        color: #374151;
      }
      .prompt-visibility.team {
        background-color: #dbeafe;
        color: #1e40af;
      }
      .prompt-team {
        color: #7c3aed;
      }
    `;
    
    if (!document.getElementById('prompt-autocomplete-styles')) {
      style.id = 'prompt-autocomplete-styles';
      document.head.appendChild(style);
    }

    document.body.appendChild(this.autocompleteDropdown);
  }

  positionAutocomplete(element) {
    const rect = element.getBoundingClientRect();
    const dropdown = this.autocompleteDropdown;
    
    // Position below the element
    let top = rect.bottom + window.scrollY + 2;
    let left = rect.left + window.scrollX;
    
    // Ensure dropdown stays within viewport
    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if needed
    if (left + dropdownRect.width > viewportWidth) {
      left = viewportWidth - dropdownRect.width - 10;
    }
    
    // Adjust vertical position if needed
    if (top + dropdownRect.height > viewportHeight) {
      top = rect.top + window.scrollY - dropdownRect.height - 2;
    }
    
    dropdown.style.left = `${Math.max(10, left)}px`;
    dropdown.style.top = `${Math.max(10, top)}px`;
  }

  hideAutocomplete() {
    if (this.autocompleteDropdown) {
      this.autocompleteDropdown.style.display = 'none';
    }
    this.selectedIndex = -1;
    this.currentQuery = '';
    this.currentAutocompleteMatch = null;
    if (this.autocompleteTimeout) {
      clearTimeout(this.autocompleteTimeout);
    }
  }

  selectNextAutocomplete() {
    if (this.autocompletePrompts.length === 0) return;
    
    this.selectedIndex = (this.selectedIndex + 1) % this.autocompletePrompts.length;
    this.updateAutocompleteSelection();
  }

  selectPrevAutocomplete() {
    if (this.autocompletePrompts.length === 0) return;
    
    this.selectedIndex = this.selectedIndex <= 0 
      ? this.autocompletePrompts.length - 1 
      : this.selectedIndex - 1;
    this.updateAutocompleteSelection();
  }

  updateAutocompleteSelection() {
    const items = this.autocompleteDropdown.querySelectorAll('.prompt-autocomplete-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
    
    // Scroll selected item into view
    if (this.selectedIndex >= 0) {
      const selectedItem = items[this.selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  async selectAutocompleteItem(index) {
    if (index < 0 || index >= this.autocompletePrompts.length) return;
    
    const prompt = this.autocompletePrompts[index];
    const element = this.activeElement;
    
    console.log('=== AUTOCOMPLETE SELECTION ===');
    console.log('Selected prompt:', prompt);
    console.log('Active element:', element);
    console.log('Element type:', element.tagName, element.type);
    
    if (!element) {
      console.log('No active element!');
      return;
    }
    
    // Check current state before hiding autocomplete
    const currentValue = element.contentEditable === 'true' 
      ? element.textContent || element.innerText 
      : element.value;
    const currentCursor = element.contentEditable === 'true'
      ? window.getSelection().getRangeAt(0).startOffset
      : element.selectionStart;
    
    console.log('Current text:', currentValue);
    console.log('Current cursor position:', currentCursor);
    
    this.hideAutocomplete();
    
    // Replace the :: query with the full prompt text
    try {
      console.log('Fetching prompt content for:', prompt.title);
      const response = await this.sendMessage({
        type: 'GET_PROMPT',
        title: prompt.title
      });

      console.log('Prompt fetch response:', response);

      if (response.success) {
        console.log('Prompt text to insert:', response.promptText);
        // Try to replace text using a more direct approach
        if (this.replaceAutocompleteTextDirect(element, response.promptText)) {
          this.showTooltip(element, `Inserted prompt: ${prompt.title}`, 'success');
          console.log('=== REPLACEMENT SUCCESSFUL ===');
        } else {
          this.showTooltip(element, 'Could not find text to replace', 'error');
          console.log('=== REPLACEMENT FAILED ===');
        }
      } else {
        console.log('Failed to fetch prompt:', response.error);
        this.showTooltip(element, response.error || 'Failed to fetch prompt', 'error');
      }
    } catch (error) {
      console.error('Failed to insert prompt:', error);
      this.showTooltip(element, 'Failed to insert prompt', 'error');
    }
  }

  replaceAutocompleteTextDirect(element, newText) {
    console.log('=== REPLACE AUTOCOMPLETE TEXT DIRECT ===');
    console.log('Element:', element);
    console.log('New text:', newText);
    
    let value, selectionStart;
    
    if (element.contentEditable === 'true') {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) {
        console.log('No selection range found');
        return false;
      }
      
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      if (textNode.nodeType !== Node.TEXT_NODE) {
        console.log('Not a text node:', textNode.nodeType);
        return false;
      }
      
      value = textNode.textContent;
      selectionStart = range.startOffset;
    } else {
      value = element.value;
      selectionStart = element.selectionStart;
    }

    console.log('Current value:', JSON.stringify(value));
    console.log('Selection start:', selectionStart);

    if (!value) {
      console.log('No value found');
      return false;
    }

    // Find the :: pattern before cursor
    const beforeCursor = value.substring(0, selectionStart);
    console.log('Before cursor:', JSON.stringify(beforeCursor));
    
    const match = beforeCursor.match(/::(.*)$/);
    console.log('Regex match result:', match);
    
    if (!match) {
      console.log('No :: pattern found');
      return false;
    }

    const fullMatch = match[0];
    const query = match[1];
    const matchStartPos = selectionStart - fullMatch.length;
    
    console.log('=== MATCH DETAILS ===');
    console.log('Full match:', JSON.stringify(fullMatch));
    console.log('Query part:', JSON.stringify(query));
    console.log('Match start pos:', matchStartPos);
    console.log('Match end pos:', selectionStart);
    console.log('Text to replace:', JSON.stringify(value.substring(matchStartPos, selectionStart)));
    console.log('Replacing with:', JSON.stringify(newText));
    
    if (element.contentEditable === 'true') {
      console.log('=== CONTENTEDITABLE REPLACEMENT ===');
      // Handle contenteditable
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      
      const oldText = textNode.textContent;
      console.log('Old text node content:', JSON.stringify(oldText));
      
      const newTextContent = oldText.substring(0, matchStartPos) + 
                            newText + 
                            oldText.substring(selectionStart);
      
      console.log('New text content:', JSON.stringify(newTextContent));
      
      textNode.textContent = newTextContent;
      
      // Set cursor position after inserted text
      const newCursorPos = matchStartPos + newText.length;
      console.log('Setting cursor to position:', newCursorPos);
      
      range.setStart(textNode, newCursorPos);
      range.setEnd(textNode, newCursorPos);
      selection.removeAllRanges();
      selection.addRange(range);
      
      element.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('=== CONTENTEDITABLE REPLACEMENT COMPLETE ===');
    } else {
      console.log('=== INPUT/TEXTAREA REPLACEMENT ===');
      // Handle regular input/textarea
      console.log('Original value:', JSON.stringify(value));
      
      const newValue = value.substring(0, matchStartPos) + 
                      newText + 
                      value.substring(selectionStart);
      
      console.log('New value:', JSON.stringify(newValue));
      
      element.value = newValue;
      
      // Set cursor position after the inserted text
      const newCursorPos = matchStartPos + newText.length;
      console.log('Setting cursor to position:', newCursorPos);
      
      element.setSelectionRange(newCursorPos, newCursorPos);
      
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('=== INPUT/TEXTAREA REPLACEMENT COMPLETE ===');
    }
    
    console.log('=== REPLACEMENT SUCCESSFUL ===');
    return true;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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