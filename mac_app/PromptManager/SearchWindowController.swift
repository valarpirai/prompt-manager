import Cocoa

class SearchWindowController: NSWindowController {
    
    private var searchField: NSSearchField!
    private var tableView: NSTableView!
    private var scrollView: NSScrollView!
    private var prompts: [Prompt] = []
    private var filteredPrompts: [Prompt] = []
    private var apiClient = APIClient()
    
    init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 600, height: 400),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        super.init(window: window)
        
        setupWindow()
        setupUI()
        loadPrompts()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupWindow() {
        guard let window = window else { return }
        
        window.title = "Search Prompts"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        
        // Center window on screen
        window.center()
    }
    
    private func setupUI() {
        guard let contentView = window?.contentView else { return }
        
        // Search field
        searchField = NSSearchField(frame: NSRect(x: 20, y: 350, width: 560, height: 30))
        searchField.placeholderString = "Search prompts..."
        searchField.target = self
        searchField.action = #selector(searchFieldChanged)
        contentView.addSubview(searchField)
        
        // Table view
        tableView = NSTableView()
        tableView.headerView = nil
        tableView.target = self
        tableView.doubleAction = #selector(tableViewDoubleClicked)
        tableView.delegate = self
        tableView.dataSource = self
        
        // Add column
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("PromptColumn"))
        column.title = "Prompts"
        column.width = 560
        tableView.addTableColumn(column)
        
        // Scroll view
        scrollView = NSScrollView(frame: NSRect(x: 20, y: 20, width: 560, height: 320))
        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        contentView.addSubview(scrollView)
        
        // Setup key handling
        window?.makeFirstResponder(searchField)
    }
    
    func showWindow() {
        guard let window = window else { return }
        
        // Reset search
        searchField.stringValue = ""
        filteredPrompts = prompts
        tableView.reloadData()
        
        // Show and focus window
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        
        // Focus search field
        window.makeFirstResponder(searchField)
    }
    
    private func loadPrompts() {
        apiClient.fetchPrompts { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let prompts):
                    self?.prompts = prompts
                    self?.filteredPrompts = prompts
                    self?.tableView.reloadData()
                case .failure(let error):
                    print("Failed to load prompts: \(error)")
                    // Show error alert
                    let alert = NSAlert()
                    alert.messageText = "Failed to Load Prompts"
                    alert.informativeText = error.localizedDescription
                    alert.addButton(withTitle: "OK")
                    alert.runModal()
                }
            }
        }
    }
    
    @objc private func searchFieldChanged() {
        let searchText = searchField.stringValue.lowercased()
        
        if searchText.isEmpty {
            filteredPrompts = prompts
        } else {
            filteredPrompts = prompts.filter { prompt in
                prompt.title.lowercased().contains(searchText) ||
                prompt.promptText.lowercased().contains(searchText)
            }
        }
        
        tableView.reloadData()
        
        // Select first item if available
        if !filteredPrompts.isEmpty {
            tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
        }
    }
    
    @objc private func tableViewDoubleClicked() {
        insertSelectedPrompt()
    }
    
    private func insertSelectedPrompt() {
        let selectedRow = tableView.selectedRow
        guard selectedRow >= 0, selectedRow < filteredPrompts.count else { return }
        
        let prompt = filteredPrompts[selectedRow]
        
        // Copy to clipboard
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(prompt.promptText, forType: .string)
        
        // Close window
        window?.orderOut(nil)
        
        // Simulate Cmd+V to paste
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.simulatePaste()
        }
        
        // Update usage count
        apiClient.incrementUsage(promptId: prompt.id) { _ in }
    }
    
    private func simulatePaste() {
        // Create and post Cmd+V key event
        guard let source = CGEventSource(stateID: .combinedSessionState) else { return }
        
        // Cmd+V key down
        let keyDownEvent = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true)
        keyDownEvent?.flags = .maskCommand
        keyDownEvent?.post(tap: .cgSessionEventTap)
        
        // Cmd+V key up
        let keyUpEvent = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false)
        keyUpEvent?.flags = .maskCommand
        keyUpEvent?.post(tap: .cgSessionEventTap)
    }
    
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 36: // Enter
            if event.modifierFlags.contains(.command) {
                insertSelectedPrompt()
            }
        case 125: // Down arrow
            let selectedRow = tableView.selectedRow
            let nextRow = min(selectedRow + 1, filteredPrompts.count - 1)
            tableView.selectRowIndexes(IndexSet(integer: nextRow), byExtendingSelection: false)
            tableView.scrollRowToVisible(nextRow)
        case 126: // Up arrow
            let selectedRow = tableView.selectedRow
            let prevRow = max(selectedRow - 1, 0)
            tableView.selectRowIndexes(IndexSet(integer: prevRow), byExtendingSelection: false)
            tableView.scrollRowToVisible(prevRow)
        case 53: // Escape
            window?.orderOut(nil)
        default:
            super.keyDown(with: event)
        }
    }
}

extension SearchWindowController: NSTableViewDataSource {
    func numberOfRows(in tableView: NSTableView) -> Int {
        return filteredPrompts.count
    }
}

extension SearchWindowController: NSTableViewDelegate {
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < filteredPrompts.count else { return nil }
        
        let prompt = filteredPrompts[row]
        
        let cellView = NSTableCellView()
        
        // Title label
        let titleLabel = NSTextField(labelWithString: prompt.title)
        titleLabel.font = NSFont.systemFont(ofSize: 14, weight: .medium)
        titleLabel.textColor = .labelColor
        
        // Preview label
        let previewText = String(prompt.promptText.prefix(100))
        let previewLabel = NSTextField(labelWithString: previewText + (prompt.promptText.count > 100 ? "..." : ""))
        previewLabel.font = NSFont.systemFont(ofSize: 12)
        previewLabel.textColor = .secondaryLabelColor
        
        // Stack view
        let stackView = NSStackView(views: [titleLabel, previewLabel])
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = 2
        
        cellView.addSubview(stackView)
        stackView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: cellView.leadingAnchor, constant: 8),
            stackView.trailingAnchor.constraint(equalTo: cellView.trailingAnchor, constant: -8),
            stackView.topAnchor.constraint(equalTo: cellView.topAnchor, constant: 4),
            stackView.bottomAnchor.constraint(equalTo: cellView.bottomAnchor, constant: -4)
        ])
        
        return cellView
    }
    
    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        return 50
    }
}