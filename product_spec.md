Prompt Manager Product Specification
1. Overview
The Prompt Manager is a web-based application designed to help users create, manage, and collaborate on AI prompts. It supports user signup via email/password and Google OAuth, email verification, prompt creation with version history, team collaboration, and a prompt generator powered by a Large Language Model (LLM). The application provides REST APIs for programmatic access, secured with JWT-based authentication, rate limiting, and role-based access control (RBAC). It uses PostgreSQL 16 with Prisma for database management and includes features like prompt search and displaying popular prompts.
2. Features
2.1 User Authentication

User Signup:

Methods:

Email/password: Users can sign up with a valid email and password.
Google OAuth: Users can sign up or log in using their Gmail account via Google OAuth.


Validation:

Email must be unique and follow a valid format (e.g., user@domain.com).
Password must meet complexity requirements (e.g., minimum 8 characters, including uppercase, lowercase, number, and special character).


Email Verification:

After signup via email/password, users receive a verification email with a unique link.
The link expires after 24 hours.
Users cannot access the application (except for a verification pending page) until their email is verified.
Google OAuth users are automatically verified (since Google handles email validation).




User Login:

Supports login via email/password or Google OAuth.
On successful login, users receive a JWT token for API access.
JWT tokens expire after a configurable period (e.g., 1 hour) and can be refreshed with a refresh token.


User Profile:

Basic profile information: email, display name, and optional fields like avatar or bio.
Users can update their profile or change their password (for email/password accounts).



2.2 Prompt Management

Prompt Properties:

title: String, required, max 100 characters, user-defined title for the prompt.
prompt_text: Text, required, the actual content of the AI prompt.
usage_count: Integer, tracks how many times the prompt has been used (e.g., executed or viewed).
version: Integer, auto-incremented for each change to the prompt.
deleted_at: Timestamp, nullable, marks soft deletion for prompts (for recovery or audit purposes).
tags: Array of strings, user-defined tags for categorization (e.g., ["code review", "java"]).
visibility: Enum (public, private), determines if the prompt is accessible to all users or only the owner/team.
owner_id: Foreign key referencing the user who created the prompt.
team_id: Foreign key (nullable) referencing the team the prompt is associated with (if any).
created_at: Timestamp, when the prompt was created.
updated_at: Timestamp, when the prompt was last modified.
created_by: Foreign key referencing the user who created the prompt version.


Prompt Creation:

Users can create prompts with a title, prompt text, tags, and visibility (public or private).
Prompts are automatically assigned to the creating user as the owner.
Initial version is set to 1, and usage_count is set to 0.


Version History:

Every change to a prompt (title, prompt text, or tags) creates a new version.
Each version stores:

The full prompt state (title, prompt text, tags).
Timestamp of the change.
User who made the change.


Users can view the version history of a prompt and revert to a previous version.
Reverting creates a new version with the restored state.


Prompt Deletion:

Soft deletion: Sets deleted_at timestamp without removing the prompt from the database.
Users can restore soft-deleted prompts within a configurable period (e.g., 30 days) before permanent deletion.



2.3 Prompt Generator

Functionality:

Users input a short description (e.g., "Java code review").
The application calls an LLM (e.g., via xAI’s API) to generate a detailed AI prompt based on the input.
Generated prompts are displayed for user review.
Users can edit and approve the prompt, after which it is saved with the properties listed above (title, prompt text, tags, etc.).
Default visibility is private, but users can change it to public during approval.


Implementation Notes:

The LLM API call should include context to ensure relevant and high-quality prompt generation.
Rate limits apply to LLM calls to prevent abuse (e.g., 10 generations per user per hour).



2.4 Team Management

Team Creation:

Users can create teams with a name and optional description.
The creator is automatically assigned the admin role.


Team Roles:

Admin: Can add/remove users and prompts, edit team details, and manage all prompts in the team.
Editor: Can edit prompts assigned to the team.
Viewer: Can view prompts assigned to the team.
Roles are team-specific (a user can have different roles in different teams).


Team Operations:

Admins can add/remove users to/from the team.
Admins can assign/remove prompts to/from the team.
Only team members can access team-associated prompts (based on their role).
Prompts assigned to a team have a team_id set in the database.
Public prompts are not tied to teams and are accessible to all users.


Access Control:

Private prompts are only accessible to the owner or team members (with appropriate roles).
Public prompts are viewable by all authenticated users but editable only by the owner or team editors/admins.



2.5 Search Prompts

Search Criteria:

Search by title (partial match, case-insensitive).
Search by prompt_text (partial match, case-insensitive).
Search by tags (exact match or partial match on tag names).
Filters:

Visibility: Public, private (user-owned), or team-specific prompts.
Team: Filter by prompts assigned to a specific team (for team members).


Results are paginated (e.g., 20 prompts per page) and sortable by title, created_at, or usage_count.


Implementation Notes:

Use full-text search capabilities in PostgreSQL 16 for efficient searching on title and prompt_text.
Tag searches should support AND/OR logic (e.g., prompts with both "java" and "code review").



2.6 Popular Prompts

Functionality:

Display a list of the most popular prompts based on usage_count.
Only public prompts are shown in the popular prompts list.
Sorting options: Top prompts by usage count (all-time, last 7 days, last 30 days).
Display limit: Top 10 prompts (configurable).
Each prompt shows title, tags, usage_count, and a preview of prompt_text.


Implementation Notes:

Use a database query to aggregate usage_count and filter by visibility = public.
Cache results for performance (e.g., refresh every 5 minutes).



2.7 REST APIs

Endpoints:

User Management:

POST /api/auth/signup: Create a new user (email/password or Google OAuth).
POST /api/auth/login: Authenticate and return JWT token.
POST /api/auth/verify-email: Verify email with token.
GET /api/users/me: Get current user profile.
PUT /api/users/me: Update user profile.


Prompt Management:

POST /api/prompts: Create a new prompt.
GET /api/prompts/:id: Get a prompt by ID.
PUT /api/prompts/:id: Update a prompt (creates new version).
DELETE /api/prompts/:id: Soft delete a prompt.
GET /api/prompts/:id/versions: List version history for a prompt.
POST /api/prompts/:id/revert: Revert to a specific version.
GET /api/prompts: List prompts (with search and filter parameters).


Prompt Generator:

POST /api/prompts/generate: Generate a prompt using LLM based on user input.


Team Management:

POST /api/teams: Create a new team.
GET /api/teams/:id: Get team details.
PUT /api/teams/:id: Update team details (admin only).
POST /api/teams/:id/users: Add user to team (admin only).
DELETE /api/teams/:id/users/:userId: Remove user from team (admin only).
POST /api/teams/:id/prompts: Assign prompt to team (admin only).
DELETE /api/teams/:id/prompts/:promptId: Remove prompt from team (admin only).


Popular Prompts:

GET /api/prompts/popular: List popular prompts with sorting options.




Security:

JWT Authentication: All endpoints (except POST /api/auth/signup and POST /api/auth/login) require a valid JWT token in the Authorization header.
Rate Limiting: Limit API requests per user (e.g., 100 requests per minute per user, configurable).
Role-Based Access Control (RBAC):

Users can only access their own private prompts or public prompts.
Team members can access team prompts based on their role (admin, editor, viewer).
Admins have full control over team resources.
Endpoint-specific permissions (e.g., only prompt owners or team editors/admins can update prompts).





3. Database Schema (Using PostgreSQL 16 and Prisma)
Below is the Prisma schema reflecting the requirements:
prismamodel User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  password      String?   // Null for Google OAuth users
  display_name  String?
  is_verified   Boolean   @default(false)
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  prompts       Prompt[]  @relation("PromptOwner")
  team_members  TeamMember[]
}

model Prompt {
  id            Int       @id @default(autoincrement())
  title         String    @db.VarChar(100)
  prompt_text   String
  usage_count   Int       @default(0)
  version       Int       @default(1)
  deleted_at    DateTime?
  visibility    String    // Enum: 'public', 'private'
  owner_id      Int
  owner         User      @relation("PromptOwner", fields: [owner_id], references: [id])
  team_id       Int?
  team          Team?     @relation(fields: [team_id], references: [id])
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  created_by    Int
  creator       User      @relation(fields: [created_by], references: [id])
  tags          Tag[]
  versions      PromptVersion[]
}

model PromptVersion {
  id            Int       @id @default(autoincrement())
  prompt_id     Int
  prompt        Prompt    @relation(fields: [prompt_id], references: [id])
  title         String    @db.VarChar(100)
  prompt_text   String
  version       Int
  created_at    DateTime  @default(now())
  created_by    Int
  creator       User      @relation(fields: [created_by], references: [id])
  tags          Tag[]
}

model Tag {
  id            Int       @id @default(autoincrement())
  name          String    @unique
  prompts       Prompt[]
  prompt_versions PromptVersion[]
}

model Team {
  id            Int       @id @default(autoincrement())
  name          String
  description   String?
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  prompts       Prompt[]
  members       TeamMember[]
}

model TeamMember {
  id            Int       @id @default(autoincrement())
  user_id       Int
  user          User      @relation(fields: [user_id], references: [id])
  team_id       Int
  team          Team      @relation(fields: [team_id], references: [id])
  role          String    // Enum: 'admin', 'editor', 'viewer'
  created_at    DateTime  @default(now())
}

Notes:

Uses soft deletion for prompts (deleted_at).
Full-text search indexes on Prompt.title and Prompt.prompt_text for efficient searching.
Tag model supports many-to-many relationships with Prompt and PromptVersion.
TeamMember model links users to teams with roles.



4. Technical Requirements

Backend:

Framework: Node.js with Express (or similar) for REST API.
Database: PostgreSQL 16, managed via Prisma ORM.
Authentication: JWT (e.g., using jsonwebtoken library), Google OAuth (e.g., via Passport.js).
Rate Limiting: Implement using middleware (e.g., express-rate-limit).
LLM Integration: Use xAI’s API (or similar) for prompt generation.


Frontend

Framework: React with Next.js for a responsive UI.
Features: Forms for prompt creation, search UI, team management dashboard, and prompt generator interface.


Deployement:
Containerize application
Create Docker-compose.yml for dependent services like postgres, pgbouncer


5. Assumptions

Web-based interface with standard usability patterns.
No compliance requirements (e.g., GDPR) were specified, but the system uses secure practices (e.g., hashed passwords, JWT).
The LLM for the prompt generator is assumed to be accessible via an API (e.g., xAI’s API).
Rate limiting and JWT expiration periods are configurable but not specified (default values assumed).
No specific performance requirements (e.g., max latency, concurrent users) were provided, so standard scalability practices are assumed.

6. Non-Functional Requirements

Security:

Passwords are hashed (e.g., using bcrypt).
JWT tokens are securely signed and validated.
HTTPS is enforced for all API and frontend communication.


Scalability:

Database queries are optimized with indexes (e.g., for search and popular prompts).
Caching is used for frequently accessed data (e.g., popular prompts).


Reliability:

Database backups are performed regularly.
Soft deletion ensures data recovery within a defined period.


Performance:

API response time: <200ms for 95% of requests (excluding LLM calls).
Search results return within 500ms.



7. Future Considerations

Support for additional authentication methods (e.g., GitHub, Microsoft).
Advanced analytics for prompt usage (e.g., usage trends, user-specific metrics).
Export/import prompts in bulk.
Integration with external tools (e.g., IDE plugins for prompt execution).


This spec covers all requirements and clarified details. If you have additional requirements, modifications, or further questions, please let me know, and I can refine the spec accordingly!
