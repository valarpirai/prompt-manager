# Prompt Manager Chrome Extension

A Chrome extension that allows users to seamlessly insert prompts from the Prompt Manager service into any text field on the web using a simple trigger mechanism.

## Features

- **Text Replacement**: Type `::promptname` in any text field and press Tab or Shift+Enter to replace it with the prompt text
- **Universal Compatibility**: Works in all text inputs, textareas, and contenteditable elements across all websites
- **Secure Authentication**: JWT-based authentication with token refresh support
- **Configurable API URL**: Support for custom Prompt Manager service URLs
- **Error Handling**: User-friendly tooltips for errors and authentication issues
- **Usage Tracking**: Automatically increments prompt usage counts

## Installation

### From Source

1. Clone or download this extension
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will be installed and ready to use

### Configuration

1. Click the extension icon in Chrome's toolbar
2. Click "Open Settings" or right-click the extension and select "Options"
3. Configure your Prompt Manager service URL (default: https://prompt-manager.com)
4. Enable/disable the extension as needed

## Usage

### Authentication

1. Click the extension icon and select "Log In" or use the Options page
2. You'll be redirected to your Prompt Manager service login page
3. Log in using your email/password or Google OAuth
4. Return to the extension - you should now be authenticated

### Inserting Prompts

1. Navigate to any website with text input fields
2. Click in a text field (input, textarea, or contenteditable element)
3. Type `::promptname` where `promptname` is the title of your prompt
4. Press **Tab** or **Shift+Enter**
5. The `::promptname` text will be replaced with the actual prompt content

### Examples

- `::welcome-email` → Replaces with your "Welcome Email" prompt
- `::meeting-agenda` → Replaces with your "Meeting Agenda" prompt
- `::code-review` → Replaces with your "Code Review" prompt

## Supported Elements

The extension works with:
- `<input type="text">`, `<input type="search">`, `<input type="url">`, `<input type="email">`
- `<textarea>` elements
- Any element with `contenteditable="true"`

## Error Handling

The extension provides helpful error messages:
- **"Prompt 'name' not found"**: The prompt doesn't exist or you don't have access
- **"Please log in"**: Authentication required
- **"Failed to fetch prompt"**: Network or API error

## Technical Details

### Architecture
- **Manifest V3**: Latest Chrome extension standard
- **Content Script**: Detects triggers and handles text replacement
- **Background Service Worker**: Handles API requests and authentication
- **Options Page**: Configuration and user management

### Security
- JWT tokens stored securely in Chrome's local storage
- All API requests use HTTPS
- Content Security Policy compliant
- No sensitive data exposed to content scripts

### API Integration

The extension integrates with these Prompt Manager API endpoints:
- `GET /api/prompts?title={name}&exact=true` - Fetch prompt by title
- `POST /api/prompts/:id/usage` - Increment usage count
- Token refresh endpoints for authentication

## Development

### Files Structure
```
chrome_extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls
├── content.js            # Content script for text replacement
├── options.html          # Settings page
├── options.js            # Settings page logic
├── popup.html            # Extension popup
├── popup.js              # Popup logic
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
└── README.md             # This file
```

### Permissions
- `storage`: For storing JWT tokens and settings
- `activeTab`: For interacting with web pages
- `http://*/*`, `https://*/*`: For API requests

## Troubleshooting

### Extension Not Working
- Check if the extension is enabled in `chrome://extensions/`
- Ensure you're logged in via the Options page
- Verify the API URL is correct in settings

### Prompts Not Found
- Check that the prompt exists in your Prompt Manager service
- Ensure you have access to the prompt (visibility permissions)
- Verify the prompt name is spelled correctly (case-insensitive)

### Authentication Issues
- Try logging out and logging back in
- Check if your Prompt Manager service is accessible
- Clear extension data and reconfigure if needed

## Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Chromium-based browsers (Edge, Brave, etc.)

## Privacy

The extension:
- Only stores authentication tokens locally
- Only makes requests to your configured Prompt Manager service
- Does not collect or transmit personal data
- Only activates on text input interactions

## Support

For issues related to the extension, please check:
1. This README for common solutions
2. Chrome's extension developer console for error messages
3. Your Prompt Manager service status and API availability

## License

This extension is designed to work with the Prompt Manager service. Please refer to your service provider's terms of use.