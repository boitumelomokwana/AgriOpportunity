# Graph Report - graphify-out  (2026-11-14)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 796 nodes · 2302 edges · 51 communities (33 shown, 18 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 139 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4c52ba3a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- runner.js
- [id].tsx
- company.js
- admin.tsx
- normalize.js
- expo
- profile.tsx
- date.ts
- requireSupabase
- index.ts
- AuthProvider.tsx
- toAppError
- BACKEND/package.json
- opportunityService.ts
- DiscoveryAdmin.tsx
- useApp
- FakeQuery
- AppProvider.tsx
- organizationService.ts
- FRONTEND/src/lib/supabase.ts
- dependencies
- discoveryService.ts
- FRONTEND/package.json
- mapOpportunity
- profileService.ts
- applicationService.ts
- react
- errors.ts
- tsconfig.json
- scripts
- settings.tsx
- expo-router
- db-types.ts
- categories.ts
- expo@~58.0.23
- expo-font@~58.0.11
- expo-glass-effect@~58.0.5
- expo-image@~58.0.18
- expo-linking@~58.0.16
- expo-splash-screen@~58.0.13
- expo-status-bar
- expo-symbols@~58.0.4
- @expo/ui@~58.0.27
- react-dom@19.3.0
- @react-native-async-storage/async-storage
- react-native-gesture-handler@~3.3.0
- react-native-reanimated@4.7.1
- react-native-screens@~4.30.1
- react-native-web@~0.21.4

## God Nodes (most connected - your core abstractions)
1. `toAppError()` - 86 edges
2. `requireSupabase()` - 86 edges
3. `useApp()` - 37 edges
4. `react-native` - 35 edges
5. `colors` - 33 edges
6. `Chip()` - 32 edges
7. `spacing` - 30 edges
8. `AppHeader()` - 29 edges
9. `@expo/vector-icons` - 28 edges
10. `Button()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `recordOpportunityView()` --calls--> `requireSupabase()`  [EXTRACTED]
  FRONTEND/src/services/opportunityService.ts → FRONTEND/src/lib/supabase.ts
- `@supabase/supabase-js@^2.119.0` --declares--> `@supabase/supabase-js`  [EXTRACTED]
  FRONTEND/package.json → BACKEND/package.json
- `ButtonProps` --references--> `IconName`  [EXTRACTED]
  FRONTEND/src/components/Button.tsx → FRONTEND/src/types/index.ts
- `ChipProps` --references--> `IconName`  [EXTRACTED]
  FRONTEND/src/components/Chip.tsx → FRONTEND/src/types/index.ts
- `EmptyStateProps` --references--> `IconName`  [EXTRACTED]
  FRONTEND/src/components/EmptyState.tsx → FRONTEND/src/types/index.ts

## Import Cycles
- None detected.

## Communities (51 total, 18 thin omitted)

### Community 0 - "runner.js"
Cohesion: 0.06
Nodes (57): ADAPTERS, getAdapter(), parseSourceResponse(), assertPublicUrl(), assertRobotsAllowed(), credentialHeaders(), discoveryError(), isPrivateIp() (+49 more)

### Community 1 - "[id].tsx"
Cohesion: 0.11
Nodes (41): statusHints, styles, points, styles, styles, REPORT_REASONS, styles, groups (+33 more)

### Community 2 - "company.js"
Cohesion: 0.08
Nodes (42): express@^5.3.0, app, server, extractAccessToken(), requireAdmin(), requireAdminRole(), configuredOrigins(), cors (+34 more)

### Community 3 - "admin.tsx"
Cohesion: 0.11
Nodes (44): AdminScreen(), dateOrDash(), listingTone(), MetricRow(), ORG_TONE, OrganizationsTab(), OverviewTab(), QueueTab() (+36 more)

### Community 4 - "normalize.js"
Cohesion: 0.10
Nodes (41): adapterError(), cheerio, DEFAULT_SELECTORS, parse(), parseSelector(), readValue(), adapterError(), parse() (+33 more)

### Community 5 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, web (+24 more)

### Community 6 - "profile.tsx"
Cohesion: 0.11
Nodes (24): AuthScreen(), FormErrors, FormState, Mode, styles, FilterSection(), FiltersScreen(), styles (+16 more)

### Community 7 - "date.ts"
Cohesion: 0.11
Nodes (23): adminAttentionThresholdDays, listing(), mockAdminListings, mockAdminSummary, RAW_STATUS, mockApplications, defaultDocuments, defaultSteps (+15 more)

### Community 8 - "requireSupabase"
Cohesion: 0.13
Nodes (26): mapReport(), requireSupabase(), assignAdminRole(), fetchAnalytics(), fetchDashboardStats(), fetchQualityReport(), generateApiKey(), listAllOpportunities() (+18 more)

### Community 9 - "index.ts"
Cohesion: 0.10
Nodes (25): buildEligibility(), defaultNotificationPreferences, defaultPreferences, LEGACY_CATEGORY_MAP, NOTIFICATION_META, PROVINCE_LOOKUP, splitCriteria(), STATUS_MAP (+17 more)

### Community 10 - "AuthProvider.tsx"
Cohesion: 0.12
Nodes (19): supabase, supabaseAdmin, RootLayout(), ToastHost(), SignUpDetails, withMatches(), AppProvider(), applyLocalPatch() (+11 more)

### Community 11 - "toAppError"
Cohesion: 0.14
Nodes (23): AppError, toAppError(), apiBaseUrl(), createDiscoverySource(), DiscoveredCompanyPatch, DiscoveredOpportunityPatch, DiscoveryRunStatus, fetchDiscoveryStats() (+15 more)

### Community 12 - "BACKEND/package.json"
Cohesion: 0.10
Nodes (23): dependencies, cheerio@^1.2.0, cors@^2.8.6, dotenv@^18.0.10, @supabase/supabase-js@^2.119.0, description, engines, node (+15 more)

### Community 13 - "opportunityService.ts"
Cohesion: 0.12
Nodes (18): MetaItem(), OpportunityDetailScreen(), removeReminder(), computeMatch(), filterOpportunities(), matchesClosingWindow(), matchesEducation(), matchesSearch() (+10 more)

### Community 14 - "DiscoveryAdmin.tsx"
Cohesion: 0.10
Nodes (19): COMPANY_STATUSES, COMPANY_TONE, OPPORTUNITY_STATUSES, OPPORTUNITY_TONE, RUN_TONE, Section, SECTIONS, styles (+11 more)

### Community 15 - "useApp"
Cohesion: 0.29
Nodes (17): ApplicationsScreen(), MatchesScreen(), SearchScreen(), styles, AlertsScreen(), ExploreScreen(), styles, HomeScreen() (+9 more)

### Community 17 - "AppProvider.tsx"
Cohesion: 0.17
Nodes (13): mockNotifications, mockProfile, discoveryService, opportunityService, AppContext, AppContextValue, ToastState, ApplicationRecord (+5 more)

### Community 18 - "organizationService.ts"
Cohesion: 0.18
Nodes (14): mapApiKey(), mapOrganization(), getOrganization(), listApiKeys(), listMyOrganizations(), listOrganizationOpportunities(), listSubmissions(), OrganizationDraft (+6 more)

### Community 19 - "FRONTEND/src/lib/supabase.ts"
Cohesion: 0.14
Nodes (13): mapNotification(), notificationGroup(), anonKey, isSupabaseConfigured, supabase, supabaseConfigError, supabaseUrl, url (+5 more)

### Community 20 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, expo-constants@~58.0.15, expo-device@~58.0.5, expo-router@~58.0.30, expo-system-ui@~58.0.7, @expo/vector-icons@^15.0.2, react@19.3.0, react-native@0.88.1 (+6 more)

### Community 21 - "discoveryService.ts"
Cohesion: 0.20
Nodes (13): OpportunityCardProps, mapReminder(), mapSavedSearch(), createSavedSearch(), deleteSavedSearch(), listReminders(), listSavedSearches(), reportOpportunity() (+5 more)

### Community 23 - "FRONTEND/package.json"
Cohesion: 0.20
Nodes (11): expo-web-browser@~58.0.7, devDependencies, @types/react@~19.3.0, typescript@~6.0.3, main, name, private, version (+3 more)

### Community 24 - "mapOpportunity"
Cohesion: 0.20
Nodes (11): buildHowToApply(), mapAdminListing(), mapOpportunity(), normalizeCategory(), normalizeMode(), normalizeProvince(), listRecentlyViewed(), listUpcomingDeadlines() (+3 more)

### Community 25 - "profileService.ts"
Cohesion: 0.27
Nodes (9): computeProfileCompletion(), mapProfile(), Row, fetchAdminRole(), fetchInterests(), fetchProfile(), ProfilePatch, profileService (+1 more)

### Community 26 - "applicationService.ts"
Cohesion: 0.29
Nodes (9): mapApplication(), toDbApplicationStatus(), toUiApplicationStatus(), applicationService, createApplication(), deleteApplication(), listApplicationHistory(), listApplications() (+1 more)

### Community 27 - "react"
Cohesion: 0.22
Nodes (6): FormFieldProps, styles, ScreenProps, styles, layout, react

### Community 28 - "errors.ts"
Cohesion: 0.25
Nodes (6): FRIENDLY, SupabaseLikeError, addBookmark(), bookmarkService, listBookmarkIds(), removeBookmark()

### Community 29 - "tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, paths, strict, extends, include, @/assets/*, expo/tsconfig.base

### Community 30 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, android, ios, lint, reset-project, start, web

### Community 31 - "settings.tsx"
Cohesion: 0.48
Nodes (6): WelcomeScreen(), SettingRow(), SettingsScreen(), styles, Brand(), useAuth()

### Community 32 - "expo-router"
Cohesion: 0.43
Nodes (5): TabLayout(), BottomNav(), styles, tabs, expo-router

### Community 33 - "db-types.ts"
Cohesion: 0.40
Nodes (4): OpportunityRow, ProfileRow, SourceType, VerificationStatus

### Community 34 - "categories.ts"
Cohesion: 0.50
Nodes (4): CategoryChip, categoryChips, recentSearchSuggestions, OpportunityCategory

## Knowledge Gaps
- **1 isolated node(s):** `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 231 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `BACKEND/package.json` to `FRONTEND/package.json`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `runner.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Why does `requireSupabase()` connect `requireSupabase` to `toAppError`, `opportunityService.ts`, `organizationService.ts`, `FRONTEND/src/lib/supabase.ts`, `discoveryService.ts`, `mapOpportunity`, `profileService.ts`, `applicationService.ts`, `errors.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `[id].tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11252268602540835 - nodes in this community are weakly interconnected._
- **Why does `@expo/vector-icons` connect `[id].tsx` to `expo-router`, `admin.tsx`, `profile.tsx`, `index.ts`, `DiscoveryAdmin.tsx`, `useApp`, `dependencies`, `FRONTEND/package.json`, `react`, `settings.tsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `company.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07542087542087542 - nodes in this community are weakly interconnected._