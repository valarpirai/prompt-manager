import Foundation

struct Prompt: Codable, Identifiable {
    let id: String
    let title: String
    let promptText: String
    let visibility: String
    let createdBy: String
    let teamName: String?
    let usageCount: Int
    let createdAt: String
    let updatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case promptText = "prompt_text"
        case visibility
        case createdBy = "created_by"
        case teamName = "team_name"
        case usageCount = "usage_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct PromptsResponse: Codable {
    let prompts: [Prompt]
    let total: Int
}

struct User: Codable {
    let id: String
    let email: String
    let name: String?
}

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: User
    
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

struct APIError: Codable, LocalizedError {
    let error: String
    let message: String?
    
    var errorDescription: String? {
        return message ?? error
    }
}