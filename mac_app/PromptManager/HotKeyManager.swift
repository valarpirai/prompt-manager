import Cocoa
import Carbon

protocol HotKeyManagerDelegate: AnyObject {
    func hotKeyPressed()
}

class HotKeyManager {
    weak var delegate: HotKeyManagerDelegate?
    private var hotKeyRef: EventHotKeyRef?
    private let hotKeyID = EventHotKeyID(signature: OSType(0x50524D54), id: 1) // 'PRMT'
    
    func registerGlobalHotKey() {
        // Register Ctrl+Space (Control + Space)
        let keyCode = UInt32(kVK_Space)
        let modifiers = UInt32(controlKey)
        
        var eventType = EventTypeSpec()
        eventType.eventClass = OSType(kEventClassKeyboard)
        eventType.eventKind = OSType(kEventHotKeyPressed)
        
        InstallEventHandler(GetApplicationEventTarget(), { (nextHandler, theEvent, userData) -> OSStatus in
            // Handle hot key press
            if let manager = Unmanaged<HotKeyManager>.fromOpaque(userData!).takeUnretainedValue() as HotKeyManager? {
                DispatchQueue.main.async {
                    manager.delegate?.hotKeyPressed()
                }
            }
            return noErr
        }, 1, &eventType, Unmanaged.passUnretained(self).toOpaque(), nil)
        
        RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
    }
    
    func unregisterGlobalHotKey() {
        if let hotKeyRef = hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
    }
}