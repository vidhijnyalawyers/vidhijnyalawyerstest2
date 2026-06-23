# AI Agent Guidelines for Vidhijnyalawyerstest2

This is a legal tech SaaS application built with React frontend and Node.js/Express backend, providing AI-powered legal analysis tools.

## Quick Start for Agents

**Build & Development Commands:**
```bash
pnpm install          # Install dependencies (uses pnpm)
pnpm dev              # Start dev server (runs on port 3000)
pnpm build            # Build frontend + bundle backend
pnpm start            # Run production build
pnpm lint             # TypeScript type checking
```

**Tech Stack:**
- Frontend: React 19, Vite 6, Tailwind CSS 4, TypeScript
- Backend: Express, Node.js with TypeScript
- Package Manager: pnpm (primary), npm (fallback)
- Target: ES2022

## Project Structure

```
├── server.ts          # Express backend with 4 main API endpoints
├── vite.config.ts     # Frontend build configuration
├── tsconfig.json      # TypeScript settings
├── index.html         # React app entry point
├── package.json       # Dependencies and scripts
├── .npmrc            # pnpm configuration
└── clients_db.xml    # Client database (generated at runtime)
```

## API Endpoints

All endpoints return **mock responses** (no external AI APIs currently):

1. **POST /api/evaluate-legal-aid**
   - Evaluates legal aid eligibility for open-source projects
   - Returns: approval status, score, advisory opinions, remediation roadmap
   - Supports: English, Chinese (中文), Nepali (नेपाली)

2. **POST /api/summarize-brief**
   - Summarizes legal briefs and regulatory documents
   - Accepts: text paste or URL resource link
   - Returns: executive summary, key takeaways, critical risks, compliance steps

3. **POST /api/analyze-compliance**
   - Analyzes tech products against compliance frameworks
   - Sectors: ai-governance, smart-contracts, ip-strategy, privacy-cyber
   - Returns: risk level, score, gaps analysis, mitigation steps

4. **POST /api/legal-insights**
   - Provides technology law news and regulatory updates
   - Returns: array of 5 curated legal insights
   - Supports: English, Chinese, Nepali

## Key Conventions

### Multilingual Support
- All endpoints accept `language` parameter ("en", "zh", "ne")
- Mock responses hardcoded for all three languages
- Always default to English if language not recognized

### Response Format
- All APIs return JSON objects
- Include `apiKeyMissing: true` field in mock responses
- Follow specific schema for each endpoint (check server.ts for structure)

### Backend Architecture
- **Express middleware:** Only `express.json()` currently configured
- **URL fetching:** `fetchUrlContent()` helper strips HTML, truncates to 10KB
- **Error handling:** Try-catch blocks return 500 status with error message
- **Database:** XML-based persistence in `clients_db.xml`

### XML Database Pattern
```typescript
interface ClientRecord {
  username: string;
  passwordHash: string;
  fullName: string;
  caseNumber: string;
  status: string;
  priority: string;
  assignedCounsel: string;
  nextAction: string;
  jurisdiction: string;
  notes: ClientNote[];
}
```
- Use `escapeXml()` and `unescapeXml()` functions for XML safety
- Use regex pattern `<tag>([\\s\\S]*?)</tag>` to extract values

### TypeScript Settings
- Strict mode enabled
- Target: ES2022
- Supports decorator syntax
- Path alias: `@/*` maps to root directory

## Important Implementation Details

### Google AI Libraries Removed
- `@google/genai` dependency removed from package.json
- No `GoogleGenAI` client or `Type` imports
- All endpoints use mock responses only
- Remove any references to: `getGeminiClient()`, `Type.OBJECT`, `googleSearch` tools

### Environment Variables
- `.env.local` file (not committed)
- Previously used: `GEMINI_API_KEY` (now unused)
- New env vars should follow: `CONSTANT_CASE` naming

### Development Server
- Runs on `http://localhost:3000`
- Vite HMR disabled via `DISABLE_HMR` env var
- File watching disabled when `DISABLE_HMR=true` (prevents flickering during edits)

## Common Tasks

### Adding a New API Endpoint
1. Define request/response types
2. Add `app.post("/api/endpoint-name", async (req, res) => { ... })`
3. Validate request body fields
4. Return JSON response or 400/500 error
5. Include mock response fallback

### Modifying Mock Responses
- Edit the `mockEvaluations`, `mockSummaries`, `mockFeedbacks`, or `fallbackInsights` objects
- Ensure all three languages (en, zh, ne) have corresponding entries
- Test with language parameter variations

### Building for Production
- Run `pnpm build` (creates `dist/` folder)
- Frontend bundle via Vite
- Backend bundled via esbuild to `dist/server.cjs`
- Start via `pnpm start`

## File Editing Patterns

**String Replacements:**
- Use 3-5 lines of context before/after target text for unambiguous matches
- For multiple edits, use batch operations when possible

**Creating Files:**
- Only create essential files (avoid unnecessary documentation)
- Link to existing docs instead of duplicating content

## Related Documentation

- [README.md](README.md) - Basic setup instructions
- [package.json](package.json) - Dependency versions and scripts
- [.npmrc](.npmrc) - pnpm configuration details
