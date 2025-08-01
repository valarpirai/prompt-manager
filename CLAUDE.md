# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Prompt Manager application built with Next.js, designed to help users create, manage, and collaborate on AI prompts. The application includes user authentication, team management, prompt versioning, and an AI-powered prompt generator.

## Development Commands

The main application is located in the `my-nextjs-app/` directory. All commands should be run from within this directory:

```bash
cd my-nextjs-app
```

- **Development server**: `npm run dev` (uses Turbopack for faster builds)
- **Build**: `npm run build`
- **Production server**: `npm start`
- **Linting**: `npm run lint`
- **Database seeding**: `npm run db:seed`

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with JWT authentication
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Email/password with JWT tokens, Google OAuth support via NextAuth
- **Email**: Nodemailer for email verification

### Core Models (Prisma Schema)
- **User**: Authentication, profiles, email verification
- **Prompt**: Core prompt entity with versioning, visibility (public/private/team), tags, vote counts
- **PromptVersion**: Version history for prompts
- **PromptVote**: User voting system for prompts (upvote/downvote)
- **Team**: Team collaboration with role-based access (admin/editor/viewer)  
- **TeamMember**: User-team relationships with roles
- **Tag**: Categorization system for prompts
- **EmailVerification**: Email verification tokens

### API Structure
- `/api/auth/*`: Authentication endpoints (login, signup, verify-email)
- `/api/prompts/*`: CRUD operations, versioning, cloning, team linking, voting
- `/api/teams/*`: Team management and member operations
- `/api/user/*`: User profile and settings

### Frontend Structure
- `/app/`: Next.js App Router pages
- `/components/`: Reusable React components
- `/lib/`: Utility functions (auth, email, validation, Prisma client)

### Key Features
- **Prompt Management**: Create, edit, version, and soft-delete prompts with 3 visibility modes (private, public, team)
- **Team Collaboration**: Role-based access control for shared prompts
- **Voting System**: Users can upvote/downvote prompts (except their own)
- **AI Prompt Generator**: LLM-powered prompt creation
- **Version History**: Track changes and revert to previous versions
- **Search & Discovery**: Full-text search and popular prompts with voting-based sorting
- **Email Verification**: Required for new user accounts

### Visibility Modes
- **Private**: Only owner can access and edit. Cannot be assigned to teams.
- **Public**: Any logged-in user can view and clone, only owner can edit. May optionally be assigned to a team.
- **Team**: Only owner and team members can access based on their team role. Must be assigned to a team.

### Team Assignment Rules
- Private prompts: Cannot have team assignments
- Public prompts: Optional team assignment (for organizational purposes)
- Team prompts: Required team assignment with proper member permissions

### Database Setup
The application uses Prisma migrations. The schema includes proper indexing for search performance and supports soft deletion for prompts.

### Security
- JWT-based authentication with refresh tokens
- Rate limiting on API endpoints
- Role-based access control for teams
- Email verification required for new accounts
- Secure password hashing with bcrypt