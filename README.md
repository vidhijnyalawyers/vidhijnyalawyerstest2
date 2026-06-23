# Vidhijnyalawyerstest2

A legal tech SaaS application providing AI-powered legal analysis tools with support for multiple languages (English, Chinese, Nepali).

## Code Changes

Removed all Google AI library dependencies and migrated to mock response architecture. All endpoints now return high-fidelity mock data without external API calls.

### Implementation Changes
```markdown
- Removed @google/genai dependency from package.json
- Removed GoogleGenAI imports and Type enum references
- Removed getGeminiClient() initialization logic
- Removed try-catch blocks calling Gemini API
- All 4 endpoints now use integrated mock responses
- Added pnpm configuration with .npmrc
```

## Tech Stack

### Technology Overview
```markdown
Frontend:
  - React 19
  - Vite 6
  - Tailwind CSS 4
  - TypeScript (ES2022)

Backend:
  - Express
  - Node.js
  - TypeScript

Package Manager:
  - pnpm (primary)
  - npm (fallback)

Database:
  - XML-based persistence (clients_db.xml)
```

## Features

- **Legal Aid Evaluation** - Assess eligibility for legal aid clinics based on project details
- **Legal Brief Summarization** - Analyze and summarize legal documents and regulatory briefs
- **Compliance Analysis** - Evaluate tech products against compliance frameworks (AI governance, smart contracts, IP strategy, privacy/cybersecurity)
- **Legal Insights** - Curated technology law news and regulatory updates
- **Multilingual Support** - All endpoints support English, Chinese (中文), and Nepali (नेपाली)

## Getting Started with pnpm

**Prerequisites:** Node.js 18+ and pnpm

### Install pnpm Globally
```bash
npm install -g pnpm
```

### Clone and Setup Project
```bash
git clone <repository-url>
cd vidhijnyalawyerstest2
pnpm install
```

### Start Development Server
```bash
pnpm dev
```
The app will be available at `http://localhost:3000`

### Build for Production
```bash
pnpm build
pnpm start
```

## Available Scripts

### Command Reference
```bash
pnpm dev       # Start Vite dev server with Express backend (http://localhost:3000)
pnpm build     # Build frontend bundle + bundle backend to dist/server.cjs
pnpm start     # Run production build from dist/
pnpm lint      # Run TypeScript type checking
pnpm clean     # Remove dist/ and build artifacts
```

### Development Details
```markdown
- Frontend builds with Vite (hot module reloading)
- Backend runs via tsx (TypeScript execution)
- Both bundled together in production
- Express server runs on port 3000
- Vite HMR can be disabled via DISABLE_HMR env var
```

## Development

For detailed development conventions, build commands, and architecture patterns, see [AGENTS.md](AGENTS.md).
