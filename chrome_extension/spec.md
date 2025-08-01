Prompt Manager Chrome Extension Product Specification

1. Overview

The Prompt Manager Chrome Extension enhances the user experience of the Prompt Manager web application by allowing users to seamlessly insert prompts into text fields across the web. Users can type ::promptname in any text input or textarea, press Tab or Shift+Enter, and the extension will replace the typed string with the corresponding prompt text retrieved from the Prompt Manager service. The extension integrates with the service’s REST APIs, authenticates users securely, and operates without a dedicated UI for prompt selection, relying solely on the text-based trigger mechanism.

2. Features

2.1 Prompt Insertion

Trigger Mechanism:

Users type ::promptname in any HTML text input or textarea element (e.g., <input type="text">, <textarea>).

promptname is a case-insensitive string matching the title of a prompt in the Prompt Manager service.

Pressing Tab or Shift+Enter triggers the replacement of ::promptname with the prompt’s prompt_text.

Behavior:

The extension detects the :: prefix and monitors for a valid prompt name followed by Tab or Shift+Enter.

On trigger, the extension sends a request to the Prompt Manager service’s API to fetch the prompt by title.

If a matching prompt is found (accessible to the user based on visibility or team permissions), the prompt_text replaces ::promptname in the text field.

If no matching prompt is found, or the user lacks access, an unobtrusive error message (e.g., a temporary tooltip) is displayed near the text field.

The usage_count of the prompt is incremented via the API upon successful insertion.

Edge Cases:

If multiple prompts have the same title, the extension selects the most recent version of a prompt the user has access to (based on updated_at).

If ::promptname is typed but no trigger key is pressed, no action is taken.

Partial matches (e.g., ::prom) are ignored until a valid title is fully typed.

The extension ignores non-text fields (e.g., <input type="number">).

2.2 Authentication

Login:

On first use (or after logout), the extension opens a new tab to the Prompt Manager service’s login page (e.g., https://prompt-manager.com/auth/login).

Users log in using email/password or Google OAuth (as supported by the service).

Upon successful login, the service returns a JWT token, which the extension stores securely in Chrome’s chrome.storage.local.

Token Management:

The JWT token is included in the Authorization header for all API requests to the Prompt Manager service.

If a token expires (e.g., 401 Unauthorized response), the extension prompts the user to re-authenticate by opening the login page.

Refresh tokens (if supported by the service) are used to silently refresh the JWT token without requiring re-login.

Logout:

Users can log out via the extension’s options page, which clears the stored JWT token.

Logging out from the Prompt Manager web application also invalidates the extension’s token (handled by the service).

2.3 API Integration

Endpoint Usage:

GET /api/prompts?title={promptname}&exact=true: Fetches a prompt by exact title match (case-insensitive).

Query parameters ensure the user has access (public, private, or team prompts).

Returns the latest version of the prompt if multiple exist.

POST /api/prompts/:id/usage: Increments the usage_count of a prompt after successful insertion.

Request Handling:

All API requests include the user’s JWT token for authentication.

Requests are rate-limited by the service (e.g., 100 requests per minute per user).

The extension caches prompt titles locally (in chrome.storage.local) for 1 hour to reduce API calls for autocomplete validation (optional, see Assumptions).

2.4 Error Handling

Common Errors:

No Matching Prompt: Display a tooltip (e.g., “Prompt ‘promptname’ not found”) for 3 seconds.

Access Denied: Display a tooltip (e.g., “You don’t have access to this prompt”).

API Failure: Display a tooltip (e.g., “Failed to fetch prompt. Try again later”).

Invalid Token: Redirect to the login page and display a tooltip (e.g., “Please log in”).

User Feedback:

Tooltips are styled minimally (e.g., small, semi-transparent box near the cursor) to avoid disrupting the user experience.

Errors are logged to the extension’s console for debugging (accessible via Chrome’s DevTools).

2.5 Options Page

Purpose: Provide basic configuration and user management.

Features:

Display the current user’s email (if logged in).

Button to log out (clears JWT token).

Toggle for enabling/disabling the extension (default: enabled).

Input field for the Prompt Manager service URL (default: https://prompt-manager.com).

Access: Available via the extension’s context menu or chrome://extensions options link.

3. Technical Requirements

3.1 Extension Architecture

Manifest Version: Chrome Manifest V3.

Components:

Content Script:

Injected into all web pages ("matches": ["<all_urls>"]).

Listens for keypress events in text inputs and textareas to detect ::promptname and trigger keys (Tab, Shift+Enter).

Replaces text in the DOM and displays tooltips for errors.

Background Script (Service Worker):

Handles API requests to the Prompt Manager service.

Manages JWT token storage and refresh.

Communicates with the content script via Chrome’s messaging API.

Options Page:

HTML page with JavaScript for user configuration.

Uses Chrome’s storage API to save settings.

Permissions:

storage: For storing JWT tokens and settings.

activeTab: For interacting with the current tab’s content.

http://_/_, https://_/_: For making API requests to the Prompt Manager service.

contextMenus (optional): For adding a link to the options page.

3.2 Implementation Details

Content Script:

Uses document.addEventListener to capture keydown events on text inputs and textareas.

Parses input value to detect :: followed by a prompt name.

On Tab (keyCode 9) or Shift+Enter (keyCode 13 with shiftKey), sends a message to the background script with the prompt name.

Updates the text field value using element.value or document.execCommand('insertText') for compatibility.

Creates dynamic <div> elements for tooltips, positioned near the cursor.

Background Script:

Uses fetch API to make HTTP requests to the Prompt Manager service.

Stores JWT tokens in chrome.storage.local (encrypted by Chrome’s storage API).

Handles token refresh logic if supported by the service.

Listens for messages from the content script and responds with prompt text or error messages.

Options Page:

Built with plain HTML/CSS/JavaScript (no framework to minimize bundle size).

Uses chrome.storage.local to read/write settings.

Includes a simple form for the service URL and buttons for login/logout.

Security:

JWT tokens are stored securely in chrome.storage.local and never exposed to content scripts.

API requests use HTTPS and include proper Authorization headers.

Content scripts sanitize input to prevent XSS (e.g., escape prompt text before insertion).

The extension follows Chrome’s Content Security Policy (CSP) for Manifest V3.

3.3 Manifest File (Example)

{
"manifest_version": 3,
"name": "Prompt Manager Extension",
"version": "1.0.0",
"description": "Insert prompts from Prompt Manager into text fields using ::promptname",
"permissions": [
"storage",
"activeTab"
],
"host_permissions": [
"http://*/*",
"https://*/*"
],
"content_scripts": [
{
"matches": ["<all_urls>"],
"js": ["content.js"]
}
],
"background": {
"service_worker": "background.js"
},
"options_page": "options.html",
"icons": {
"48": "icon48.png",
"128": "icon128.png"
}
}

4. Assumptions

The Prompt Manager service has a publicly accessible API at a configurable URL (e.g., https://prompt-manager.com).

The GET /api/prompts endpoint supports an exact=true parameter for case-insensitive title matching.

The service returns prompt data in a consistent format (e.g., { id, title, prompt_text, visibility }).

Prompt titles are unique enough to avoid frequent conflicts (if not, the latest accessible version is used).

No autocomplete or prompt suggestion UI is needed, as the user must know the exact prompt title.

The extension does not cache prompt text locally to ensure freshness and respect visibility changes.

Tab and Shift+Enter are sufficient triggers; other keys (e.g., Enter alone) are not required.

The extension works in all text fields except those explicitly excluded (e.g., password fields).

No specific branding or icon requirements were provided, so a generic icon is assumed.

The service handles rate limiting and JWT expiration, and the extension respects these constraints.

5. Non-Functional Requirements

Performance:

Keypress detection adds minimal overhead (<1ms per keystroke).

API requests complete within 500ms under normal network conditions.

Tooltip rendering is lightweight and does not affect page performance.

Security:

JWT tokens are stored securely and cleared on logout.

Prompt text is sanitized to prevent injection attacks.

All API communication uses HTTPS.

Compatibility:

Works on Chrome 88+ (latest stable as of August 2025).

Compatible with text inputs and textareas on most websites (exceptions handled gracefully).

Usability:

Tooltips are clear, concise, and non-intrusive.

The extension requires minimal user configuration (default settings work out of the box).

Reliability:

Graceful degradation if the Prompt Manager service is unavailable (e.g., show error tooltip).

Errors are logged for debugging without exposing sensitive information.

6. Future Considerations

Support for prompt autocompletion (e.g., suggest prompt names after typing ::).

Context menu integration for manual prompt selection.

Support for other browsers (e.g., Firefox, Edge).

Offline mode with cached prompts (if permitted by the service).

Customizable trigger keys or prefixes (e.g., allow !! instead of ::).

Integration with specific platforms (e.g., GitHub, Jira) for targeted prompt insertion.

7. Dependencies

Prompt Manager Service: REST APIs for prompt retrieval and usage tracking.

Chrome APIs: chrome.storage, chrome.runtime, chrome.tabs for extension functionality.

No External Libraries: To minimize bundle size and avoid CSP issues.
