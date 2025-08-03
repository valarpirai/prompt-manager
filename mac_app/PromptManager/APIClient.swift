import Foundation

class APIClient {
    private let baseURL: String
    private var accessToken: String?
    private var refreshToken: String?
    
    init(baseURL: String = "http://localhost:3000") {
        self.baseURL = baseURL
        loadTokensFromKeychain()
    }
    
    // MARK: - Authentication
    
    func login(email: String, password: String, completion: @escaping (Result<AuthResponse, Error>) -> Void) {
        let url = URL(string: "\(baseURL)/api/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["email": email, "password": password]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(APIError(error: "No data received", message: nil)))
                return
            }
            
            do {
                let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
                self?.accessToken = authResponse.accessToken
                self?.refreshToken = authResponse.refreshToken
                self?.saveTokensToKeychain()
                completion(.success(authResponse))
            } catch {
                // Try to decode error response
                if let apiError = try? JSONDecoder().decode(APIError.self, from: data) {
                    completion(.failure(apiError))
                } else {
                    completion(.failure(error))
                }
            }
        }.resume()
    }
    
    func logout() {
        accessToken = nil
        refreshToken = nil
        removeTokensFromKeychain()
    }
    
    // MARK: - Prompts
    
    func fetchPrompts(completion: @escaping (Result<[Prompt], Error>) -> Void) {
        guard let accessToken = accessToken else {
            completion(.failure(APIError(error: "Not authenticated", message: "Please log in first")))
            return
        }
        
        let url = URL(string: "\(baseURL)/api/prompts")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            // Check for 401 and try to refresh token
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 401 {
                self?.refreshTokenAndRetry {
                    self?.fetchPrompts(completion: completion)
                } failure: {
                    completion(.failure(APIError(error: "Authentication failed", message: "Please log in again")))
                }
                return
            }
            
            guard let data = data else {
                completion(.failure(APIError(error: "No data received", message: nil)))
                return
            }
            
            do {
                let response = try JSONDecoder().decode(PromptsResponse.self, from: data)
                completion(.success(response.prompts))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    func incrementUsage(promptId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let accessToken = accessToken else {
            completion(.failure(APIError(error: "Not authenticated", message: "Please log in first")))
            return
        }
        
        let url = URL(string: "\(baseURL)/api/prompts/\(promptId)/usage")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                completion(.success(()))
            } else {
                completion(.failure(APIError(error: "Failed to update usage", message: nil)))
            }
        }.resume()
    }
    
    // MARK: - Token Management
    
    private func refreshTokenAndRetry(success: @escaping () -> Void, failure: @escaping () -> Void) {
        guard let refreshToken = refreshToken else {
            failure()
            return
        }
        
        let url = URL(string: "\(baseURL)/api/auth/refresh")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["refreshToken": refreshToken]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let data = data,
                  let authResponse = try? JSONDecoder().decode(AuthResponse.self, from: data) else {
                failure()
                return
            }
            
            self?.accessToken = authResponse.accessToken
            self?.refreshToken = authResponse.refreshToken
            self?.saveTokensToKeychain()
            success()
        }.resume()
    }
    
    // MARK: - Keychain Storage
    
    private func saveTokensToKeychain() {
        guard let accessToken = accessToken, let refreshToken = refreshToken else { return }
        
        let accessTokenData = accessToken.data(using: .utf8)!
        let refreshTokenData = refreshToken.data(using: .utf8)!
        
        // Save access token
        let accessTokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "prompt-manager-access-token",
            kSecValueData as String: accessTokenData
        ]
        
        SecItemDelete(accessTokenQuery as CFDictionary)
        SecItemAdd(accessTokenQuery as CFDictionary, nil)
        
        // Save refresh token
        let refreshTokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "prompt-manager-refresh-token",
            kSecValueData as String: refreshTokenData
        ]
        
        SecItemDelete(refreshTokenQuery as CFDictionary)
        SecItemAdd(refreshTokenQuery as CFDictionary, nil)
    }
    
    private func loadTokensFromKeychain() {
        // Load access token
        let accessTokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "prompt-manager-access-token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var accessTokenItem: CFTypeRef?
        if SecItemCopyMatching(accessTokenQuery as CFDictionary, &accessTokenItem) == errSecSuccess,
           let accessTokenData = accessTokenItem as? Data {
            accessToken = String(data: accessTokenData, encoding: .utf8)
        }
        
        // Load refresh token
        let refreshTokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "prompt-manager-refresh-token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var refreshTokenItem: CFTypeRef?
        if SecItemCopyMatching(refreshTokenQuery as CFDictionary, &refreshTokenItem) == errSecSuccess,
           let refreshTokenData = refreshTokenItem as? Data {
            refreshToken = String(data: refreshTokenData, encoding: .utf8)
        }
    }
    
    private func removeTokensFromKeychain() {
        let accessTokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "prompt-manager-access-token"
        ]
        SecItemDelete(accessTokenQuery as CFDictionary)
        
        let refreshTokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "prompt-manager-refresh-token"
        ]
        SecItemDelete(refreshTokenQuery as CFDictionary)
    }
    
    // MARK: - Public API
    
    var isAuthenticated: Bool {
        return accessToken != nil
    }
}