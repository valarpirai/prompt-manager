import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    
    var statusItem: NSStatusItem?
    var searchWindowController: SearchWindowController?
    var hotKeyManager: HotKeyManager?
    
    func applicationDidFinishLaunching(_ aNotification: Notification) {
        setupMenuBar()
        setupHotKeys()
        setupSearchWindow()
        
        // Request accessibility permissions if needed
        requestAccessibilityPermissions()
    }
    
    func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        
        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "text.bubble", accessibilityDescription: "Prompt Manager")
            button.action = #selector(showMenu)
            button.target = self
        }
        
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Search Prompts (⌃Space)", action: #selector(showSearchWindow), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate), keyEquivalent: "q"))
        
        statusItem?.menu = menu
    }
    
    func setupHotKeys() {
        hotKeyManager = HotKeyManager()
        hotKeyManager?.delegate = self
        hotKeyManager?.registerGlobalHotKey()
    }
    
    func setupSearchWindow() {
        searchWindowController = SearchWindowController()
    }
    
    func requestAccessibilityPermissions() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
        let accessEnabled = AXIsProcessTrustedWithOptions(options as CFDictionary)
        
        if !accessEnabled {
            let alert = NSAlert()
            alert.messageText = "Accessibility Access Required"
            alert.informativeText = "Prompt Manager needs accessibility access to insert text into other applications. Please enable it in System Preferences > Security & Privacy > Accessibility."
            alert.addButton(withTitle: "OK")
            alert.runModal()
        }
    }
    
    @objc func showMenu() {
        // Menu will show automatically when button is clicked
    }
    
    @objc func showSearchWindow() {
        searchWindowController?.showWindow()
    }
    
    @objc func showSettings() {
        // TODO: Implement settings window
        let alert = NSAlert()
        alert.messageText = "Settings"
        alert.informativeText = "Settings panel coming soon!"
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    
    func applicationWillTerminate(_ aNotification: Notification) {
        hotKeyManager?.unregisterGlobalHotKey()
    }
    
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showSearchWindow()
        return true
    }
}

extension AppDelegate: HotKeyManagerDelegate {
    func hotKeyPressed() {
        showSearchWindow()
    }
}