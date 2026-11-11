# Graph Report - APP  (2026-11-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 468 nodes · 1217 edges · 34 communities (18 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b735a82`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Frontend UI: screens, components & theme
- Admin, mock data, services & domain types
- Opportunities domain: filters, service & date utils
- Expo app config (app.json)
- Frontend service layer (auth, profile, saved, notifications)
- Backend tooling & dev dependencies
- Backend Express app, routes & API types
- Backend SQLite database & seed data
- Backend runtime dependencies
- Backend TypeScript config
- Frontend core runtime dependencies
- Backend auth (JWT) & Express
- Frontend package manifest
- Shared UI component props & StatCard
- Frontend TypeScript config
- Frontend npm scripts
- Backend npm scripts
- App root layout, provider & toast host
- expo
- expo-constants
- expo-device
- expo-font
- expo-glass-effect
- expo-image
- expo-linking
- expo-secure-store
- expo-status-bar
- expo-symbols
- @expo/ui
- expo-web-browser
- react-dom
- react-native-gesture-handler
- react-native-reanimated
- react-native-screens

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 31 edges
2. `react-native` - 31 edges
3. `colors` - 30 edges
4. `spacing` - 27 edges
5. `AppHeader()` - 25 edges
6. `@expo/vector-icons` - 25 edges
7. `EmptyState()` - 20 edges
8. `radius` - 20 edges
9. `expo-router` - 19 edges
10. `type` - 18 edges

## Surprising Connections (you probably didn't know these)
- `typescript@~6.0.3` --declares--> `typescript`  [EXTRACTED]
  FRONTEND/package.json → BACKEND/package.json
- `AuthResponse` --references--> `UserProfile`  [EXTRACTED]
  FRONTEND/src/services/authService.ts → FRONTEND/src/types/index.ts
- `updateApplicationStatus()` --calls--> `apiRequest()`  [EXTRACTED]
  FRONTEND/src/services/applicationService.ts → FRONTEND/src/services/api.ts
- `getOpportunities()` --calls--> `apiRequest()`  [EXTRACTED]
  FRONTEND/src/services/opportunityService.ts → FRONTEND/src/services/api.ts
- `AppContextValue` --references--> `Opportunity`  [EXTRACTED]
  FRONTEND/src/state/AppProvider.tsx → FRONTEND/src/types/index.ts

## Import Cycles
- None detected.

## Communities (34 total, 16 thin omitted)

### Community 0 - "Frontend UI: screens, components & theme"
Cohesion: 0.08
Nodes (85): ApplicationsScreen(), statusHints, styles, AuthScreen(), FormErrors, FormState, Mode, styles (+77 more)

### Community 1 - "Admin, mock data, services & domain types"
Cohesion: 0.06
Nodes (56): AdminScreen(), EditorError, emptyListing(), statusPillStyles, styles, StatCard(), adminAttentionThresholdDays, listing() (+48 more)

### Community 2 - "Opportunities domain: filters, service & date utils"
Cohesion: 0.08
Nodes (29): MetaItem(), OpportunityDetailScreen(), OpportunityCardProps, defaultFilters, filterOpportunities(), getOpportunities(), matchesClosingWindow(), matchesEducation() (+21 more)

### Community 3 - "Expo app config (app.json)"
Cohesion: 0.06
Nodes (32): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, web (+24 more)

### Community 4 - "Frontend service layer (auth, profile, saved, notifications)"
Cohesion: 0.12
Nodes (20): apiBaseUrl, apiRequest(), setAccessToken(), AuthResponse, authService, clearStoredToken(), getStoredToken(), register() (+12 more)

### Community 5 - "Backend tooling & dev dependencies"
Cohesion: 0.12
Nodes (21): devDependencies, tsx@^4.20.5, @types/better-sqlite3@^7.6.13, @types/cors@^2.8.19, @types/express@^5.0.3, @types/jsonwebtoken@^9.0.10, @types/node@^22.15.30, typescript@^5.9.2 (+13 more)

### Community 6 - "Backend Express app, routes & API types"
Cohesion: 0.12
Nodes (18): app, applicationSchema, authLimiter, configuredOrigins, listingSchema, loginSchema, parseJson(), profileSchema (+10 more)

### Community 7 - "Backend SQLite database & seed data"
Cohesion: 0.14
Nodes (11): createInitialNotifications(), createInitialProfile(), databasePath, db, insertOpportunity, seedDemoUser(), applySteps, closingOffsets (+3 more)

### Community 8 - "Backend runtime dependencies"
Cohesion: 0.13
Nodes (15): dependencies, bcryptjs@^3.0.2, better-sqlite3@^12.2.0, cors@^2.8.5, dotenv@^16.6.1, express-rate-limit@^8.1.0, helmet@^8.1.0, zod@^4.1.5 (+7 more)

### Community 9 - "Backend TypeScript config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noUncheckedIndexedAccess, outDir, rootDir (+4 more)

### Community 10 - "Frontend core runtime dependencies"
Cohesion: 0.17
Nodes (12): dependencies, expo-router@~58.0.30, expo-splash-screen@~58.0.13, @expo/vector-icons@^15.0.2, react@19.3.0, react-native@0.88.1, react-native-safe-area-context@~5.11.1, react-native-web@~0.21.4 (+4 more)

### Community 11 - "Backend auth (JWT) & Express"
Cohesion: 0.20
Nodes (10): express@^5.1.0, jsonwebtoken@^9.0.2, Express, Request, requireAdmin(), requireAuth(), signToken(), AuthenticatedUser (+2 more)

### Community 12 - "Frontend package manifest"
Cohesion: 0.20
Nodes (10): expo-system-ui@~58.0.7, devDependencies, @types/react@~19.3.0, typescript@~6.0.3, main, name, private, version (+2 more)

### Community 13 - "Shared UI component props & StatCard"
Cohesion: 0.25
Nodes (8): ButtonProps, ChipProps, EmptyStateProps, StatCardProps, StatTone, styles, toneMap, IconName

### Community 14 - "Frontend TypeScript config"
Cohesion: 0.25
Nodes (7): compilerOptions, paths, strict, extends, include, @/assets/*, expo/tsconfig.base

### Community 15 - "Frontend npm scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, lint, reset-project, start, web

### Community 16 - "Backend npm scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, start, typecheck

### Community 17 - "App root layout, provider & toast host"
Cohesion: 0.83
Nodes (3): RootLayout(), ToastHost(), AppProvider()

## Knowledge Gaps
- **1 isolated node(s):** `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `typescript` connect `Backend tooling & dev dependencies` to `Frontend package manifest`?**
  _High betweenness centrality (0.271) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Frontend UI: screens, components & theme` be split into smaller, more focused modules?**
  _Cohesion score 0.07553729456384324 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `Frontend UI: screens, components & theme` to `Admin, mock data, services & domain types`, `Frontend service layer (auth, profile, saved, notifications)`, `Frontend core runtime dependencies`, `Frontend package manifest`, `Shared UI component props & StatCard`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `Admin, mock data, services & domain types` be split into smaller, more focused modules?**
  _Cohesion score 0.05662862159789289 - nodes in this community are weakly interconnected._
- **Why does `@expo/vector-icons` connect `Frontend UI: screens, components & theme` to `Admin, mock data, services & domain types`, `Frontend core runtime dependencies`, `Frontend package manifest`, `Shared UI component props & StatCard`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `Opportunities domain: filters, service & date utils` be split into smaller, more focused modules?**
  _Cohesion score 0.08408408408408409 - nodes in this community are weakly interconnected._