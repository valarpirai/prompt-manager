# Prompt Manager Mac App

A native macOS app that provides global access to your Prompt Manager prompts with a simple keyboard shortcut.

## Features

- **Global Hotkey**: Press `Ctrl+Space` anywhere to open the search interface
- **Real-time Search**: Type to filter prompts by title or content
- **Quick Insertion**: Press `Cmd+Enter` to paste the selected prompt
- **Menu Bar App**: Runs quietly in the background with a menu bar icon
- **Secure Authentication**: JWT tokens stored securely in Keychain

## Usage

1. **Launch**: The app runs as a menu bar application (look for the speech bubble icon)
2. **Search**: Press `Ctrl+Space` anywhere to open the search window
3. **Find Prompts**: Type to search through your prompts
4. **Navigate**: Use arrow keys to select different prompts
5. **Insert**: Press `Cmd+Enter` to paste the selected prompt text

## Keyboard Shortcuts

- `Ctrl+Space` - Open search window (global)
- `↑/↓` - Navigate through search results
- `Cmd+Enter` - Insert selected prompt text
- `Escape` - Close search window

## Setup Instructions

### Prerequisites

- macOS 10.15 or later
- Xcode 12 or later
- Prompt Manager service running (default: http://localhost:3000)

### Building the App

1. Open Terminal and navigate to the mac_app directory
2. Create a new Xcode project:
   ```bash
   open -a Xcode
   ```
3. Create a new macOS app project with the following settings:
   - Product Name: PromptManager
   - Bundle Identifier: com.yourcompany.promptmanager
   - Language: Swift
   - Interface: AppKit
   - Use Core Data: No

4. Replace the default files with the provided Swift files:
   - `AppDelegate.swift`
   - `HotKeyManager.swift`
   - `SearchWindowController.swift`
   - `APIClient.swift`
   - `Models.swift`

5. Update `Info.plist` with the provided configuration

6. Build and run the project

### Permissions

The app requires:

1. **Accessibility Access**: To insert text into other applications
   - Go to System Preferences > Security & Privacy > Accessibility
   - Add and enable your app

2. **Input Monitoring** (if needed): For global keyboard monitoring
   - Go to System Preferences > Security & Privacy > Input Monitoring
   - Add and enable your app if prompted

### Configuration

- The app defaults to connecting to `http://localhost:3000`
- You can modify the base URL in `APIClient.swift`
- Authentication uses the same JWT system as the Chrome extension

## Architecture

### Components

- **AppDelegate**: Main app controller, manages menu bar and hotkeys
- **HotKeyManager**: Handles global keyboard shortcuts using Carbon APIs
- **SearchWindowController**: Floating search interface with real-time filtering
- **APIClient**: Handles authentication and API communication
- **Models**: Data structures for prompts and API responses

### Security

- JWT tokens are stored securely in macOS Keychain
- All API communication uses HTTPS in production
- Automatic token refresh when expired
- No sensitive data is logged or cached

## Troubleshooting

### Search Window Not Appearing

- Check that accessibility permissions are granted
- Verify the app is running (menu bar icon should be visible)
- Try quitting and restarting the app

### Authentication Issues

- Ensure your Prompt Manager service is running and accessible
- Check the API base URL in APIClient.swift
- Try logging out and back in through the menu bar

### Global Hotkey Not Working

- Some apps may capture Ctrl+Space (like Spotlight or other launchers)
- Check for conflicting keyboard shortcuts in System Preferences
- Try changing the hotkey combination in HotKeyManager.swift

## Customization

### Changing the Hotkey

Edit `HotKeyManager.swift` and modify:

```swift
let keyCode = UInt32(kVK_Space)  // Change key
let modifiers = UInt32(controlKey)  // Change modifier
```

### Styling the Search Window

Modify `SearchWindowController.swift` to customize:

- Window appearance and size
- Search field styling
- Table view layout
- Color scheme

### API Configuration

Update `APIClient.swift` to change:

- Base URL
- Request timeouts
- Authentication flow
- Error handling

## Development

### Adding Features

1. **Settings Window**: Implement preferences for API URL, hotkeys, etc.
2. **Offline Caching**: Cache frequently used prompts locally
3. **Prompt Creation**: Add prompts directly from the Mac app
4. **Team Support**: Better filtering and organization by teams
5. **Rich Text Support**: Handle formatted prompt content

### Testing

- Test with different text applications (browsers, editors, etc.)
- Verify global hotkey works across all apps
- Test authentication flow and token refresh
- Check accessibility permissions handling

## License

This Mac app is designed to work with the Prompt Manager service. Please refer to your service provider's terms of use.
