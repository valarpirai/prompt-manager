# Prompt Manager Chrome Extension API Documentation

This document describes the API endpoints available for the Chrome extension to authenticate users and access prompts.

## Authentication Flow

### 1. Extension Login

The extension should direct users to the extension-specific login page for authentication:

```
https://your-domain.com/auth/extension-login
```

This page will handle the login and communicate the authentication tokens back to the extension.

### 2. API Endpoints

#### Login Endpoint

```
POST /api/auth/extension-login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response (Success):**

```json
{
  "message": "Extension login successful",
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "display_name": "User Name",
    "is_verified": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpiry": "2024-01-01T13:00:00.000Z"
}
```

#### Token Refresh

```
POST /api/auth/extension-refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success):**

```json
{
  "message": "Token refreshed successfully",
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "display_name": "User Name",
    "is_verified": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpiry": "2024-01-01T14:00:00.000Z"
}
```

### 3. Prompt Access

#### Get Prompt by Exact Title

```
GET /api/prompts?title=promptname&exact=true
Authorization: Bearer {accessToken}
```

**Response (Success):**

```json
{
  "prompts": [
    {
      "id": 456,
      "title": "promptname",
      "prompt_text": "This is the prompt content...",
      "usage_count": 42,
      "upvote_count": 15,
      "downvote_count": 2,
      "visibility": "PUBLIC",
      "owner": {
        "id": 123,
        "display_name": "Owner Name",
        "email": "owner@example.com"
      },
      "team": {
        "id": 789,
        "name": "Team Name"
      },
      "tags": [
        {
          "id": 1,
          "name": "tag1"
        }
      ],
      "votes": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 1,
    "total": 1,
    "pages": 1
  }
}
```

#### Track Prompt Usage

```
POST /api/prompts/{promptId}/usage
Authorization: Bearer {accessToken}
```

**Response (Success):**

```json
{
  "message": "Usage count updated successfully",
  "usage_count": 43
}
```

## Error Responses

All endpoints return standard HTTP status codes and error messages:

```json
{
  "error": "Error message description"
}
```

Common status codes:

- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (email not verified)
- `404` - Not Found (prompt not found or no access)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## CORS Support

All extension-specific endpoints include proper CORS headers to allow cross-origin requests from the Chrome extension.

## Token Management

- Access tokens expire after 1 hour
- Refresh tokens expire after 7 days
- The extension should refresh tokens before they expire using the refresh endpoint
- Store tokens securely using Chrome's `chrome.storage.local` API

## Example Extension Implementation

```javascript
// Background script example
class AuthManager {
  constructor() {
    this.baseUrl = 'https://your-domain.com/api';
  }

  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/extension-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      await chrome.storage.local.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        tokenExpiry: data.tokenExpiry,
      });
      return data;
    }
    throw new Error('Login failed');
  }

  async getPromptByTitle(title) {
    const { accessToken } = await chrome.storage.local.get(['accessToken']);

    const response = await fetch(
      `${this.baseUrl}/prompts?title=${encodeURIComponent(title)}&exact=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.prompts[0] || null;
    }

    if (response.status === 401) {
      // Token expired, try to refresh
      await this.refreshToken();
      // Retry the request...
    }

    return null;
  }

  async trackUsage(promptId) {
    const { accessToken } = await chrome.storage.local.get(['accessToken']);

    await fetch(`${this.baseUrl}/prompts/${promptId}/usage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async refreshToken() {
    const { refreshToken } = await chrome.storage.local.get(['refreshToken']);

    const response = await fetch(`${this.baseUrl}/auth/extension-refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      await chrome.storage.local.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: data.tokenExpiry,
      });
    }
  }
}
```
