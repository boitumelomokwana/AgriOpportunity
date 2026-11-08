# MASTER PROMPT — SOUTH AFRICAN YOUTH OPPORTUNITIES APP

## ROLE

Act as a senior React Native engineer, mobile UI/UX developer, software architect and AI-assisted development engineer.

Your task is to build a professional, production-quality frontend for the South African Youth Opportunities App, based on the supplied Figma Make design.

You must work directly inside the existing Git repository.

## 1. PROJECT INFORMATION

**Application:** South African Youth Opportunities App

**Figma Make design (primary design reference):**
https://www.figma.com/make/TG6oWoU3hQjdHYK3VoSHR6/South-African-Youth-Opportunities-App?code-node-id=0-6&p=f&fullscreen=1

**Target platforms:**
- Android
- iOS

**Framework:** React Native with Expo

**Programming language:** TypeScript

**Build platform:** Expo Application Services (EAS)

**Development approach:** AI-assisted development

**Current scope:** FRONTEND ONLY.

The backend will be developed separately at a later stage.

## 2. CRITICAL DEVELOPMENT RULES

1. Inspect the existing Git repository before making changes.
2. Do not create a second project or duplicate the existing application.
3. Preserve existing working code and functionality.
4. Use the supplied Figma Make design as the primary visual source of truth.
5. Do not arbitrarily redesign screens or introduce a different visual identity.
6. Support both Android and iOS using one codebase.
7. Use TypeScript throughout the application.
8. Follow a modular and maintainable project structure.
9. Do not implement a backend during this phase.
10. Do not connect to Supabase, Firebase or other remote databases.
11. Do not introduce fake authentication or claim that real authentication is implemented.
12. Use realistic mock data for frontend demonstrations.
13. Make all visible interactive controls functional using local state where appropriate.
14. Do not leave unfinished buttons, broken navigation or placeholder screens.
15. Do not remove existing functionality without explaining why and obtaining approval.
16. Do not expose credentials, API keys or secrets.
17. Do not declare a feature complete without testing it.

If you cannot access the Figma design, stop and explain what access or design material is missing. Do not guess the design.

## 3. FIGMA DESIGN IMPLEMENTATION

Inspect the supplied Figma Make project carefully before implementation.

Study:
- All available application screens.
- Navigation structure.
- Colours and typography.
- Spacing and layout.
- Buttons and input fields.
- Cards and opportunity listings.
- Icons and illustrations.
- Bottom navigation.
- Dialogs, menus and overlays.
- Mobile responsiveness.
- Interactive states.
- Loading, empty and error states.

Reproduce the design as closely as possible.

Maintain consistent:
- Typography.
- Colour palette.
- Component dimensions.
- Border radii.
- Spacing.
- Shadows.
- Icon styles.
- Navigation behaviour.

Build reusable components instead of duplicating UI code.

Do not replace the supplied design with a generic mobile application template.

## 4. APPLICATION FUNCTIONALITY

The application is a South African youth opportunity marketplace.

It connects young people, learners, students and graduates with opportunities.

The application should support the following opportunity categories:

- Bursaries.
- Internships.
- Learnerships.
- Graduate programmes.
- Employment opportunities.
- Youth development programmes.

Implement the screens and functionality represented in the Figma design.

Expected functionality includes, where represented in the design:

### User interface
- Welcome and onboarding screens.
- Registration and login interfaces.
- Home dashboard.
- Opportunity discovery.
- Opportunity details.
- Search.
- Filters.
- User profile.
- Saved opportunities.
- Notifications.
- Application information.
- Settings.

### Opportunity discovery
Users should be able to:
- Browse available opportunities.
- Search by opportunity title or organisation.
- Filter by category.
- Filter by province.
- Filter by education level.
- View closing dates.
- View opportunity descriptions.
- View eligibility requirements.
- Save and unsave opportunities.
- View relevant opportunities.

### Profile interface
Provide the profile fields represented in the design, such as:
- Education level.
- Field of study.
- Province.
- Interests.
- Opportunity preferences.

### Saved opportunities
Implement local bookmarking functionality.

### Notifications
Display realistic example notifications and allow users to interact with them locally.

### Application functionality
Where the design includes application functionality, provide an appropriate frontend experience.

Do not claim that an application has been submitted to an organisation when no backend exists.

## 5. FRONTEND-ONLY IMPLEMENTATION

This is a deliberate architectural decision.

The backend will be implemented separately.

For now:

- Use local mock opportunity data.
- Use local state for interactions.
- Implement frontend navigation.
- Implement functional search and filters.
- Implement local bookmarking.
- Use sample user profile data.
- Use sample notifications.
- Simulate loading and empty states.
- Provide appropriate validation on forms.

Organise the code so that a real backend can be integrated later without rewriting the entire frontend.

Create a clear data-access/service layer.

For example:

`services/opportunityService.ts`

`services/profileService.ts`

`services/notificationService.ts`

These services should return mock data for now.

Keep data models and interfaces separate from UI components.

Do not build a fake backend or introduce unnecessary networking.

## 6. TECHNICAL ARCHITECTURE

Use:

- React Native.
- Expo.
- TypeScript.
- Expo Router, if supported by the existing project.
- React Native core components.
- Existing installed Expo-compatible libraries.

Use a modular architecture.

Suggested structure:

```text
OpportunityApp/
│
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── onboarding/
│   ├── auth/
│   ├── home/
│   ├── opportunities/
│   ├── saved/
│   ├── notifications/
│   ├── profile/
│   └── settings/
│
├── components/
│   ├── common/
│   ├── navigation/
│   ├── opportunities/
│   └── forms/
│
├── services/
│   ├── opportunityService.ts
│   ├── profileService.ts
│   └── notificationService.ts
│
├── data/
│   ├── mockOpportunities.ts
│   ├── mockNotifications.ts
│   └── mockProfile.ts
│
├── hooks/
│
├── types/
│
├── constants/
│
├── assets/
│   ├── images/
│   └── icons/
│
├── app.json
├── eas.json
└── package.json
```

Adapt this structure to the existing repository rather than blindly duplicating files.

## 7. MOBILE EXPERIENCE

The application must:

- Work on Android and iOS.
- Support different screen sizes.
- Respect device safe areas.
- Provide scrollable screens where necessary.
- Avoid content overflowing the screen.
- Have consistent navigation.
- Provide appropriate keyboard handling.
- Support Android back navigation.
- Provide accessible touch targets.
- Maintain good performance.
- Avoid unnecessary animations.

Test the interface on different screen dimensions.

## 8. DEVELOPMENT AND QUALITY CONTROL

Work in stages.

### Stage 1 — Repository inspection
Inspect:
- Existing files.
- Existing Expo configuration.
- Dependencies.
- Existing navigation.
- Git status.
- Current application functionality.

Report your findings before making significant changes.

### Stage 2 — Design inspection
Study the complete Figma design and prepare a screen inventory.

Identify:
- Every screen.
- Navigation relationships.
- Shared components.
- Interactive elements.
- Required assets.

### Stage 3 — Implementation planning
Create an implementation plan.

Identify the files that need to be created or modified.

### Stage 4 — Frontend implementation
Build the application in manageable stages.

Preserve existing functionality.

### Stage 5 — Functional testing
Verify:
- Navigation.
- Buttons.
- Search.
- Filtering.
- Bookmarks.
- Forms.
- Local state.
- Screen responsiveness.
- Empty states.
- Error states.

### Stage 6 — Final review
Confirm that:
- The application starts successfully.
- The main screens render correctly.
- There are no broken navigation paths.
- There are no obvious runtime errors.
- The frontend works without a backend.
- The implementation matches the supplied Figma design.

Do not claim successful testing without actually running the relevant tests.

Do not run a linter unless explicitly requested.

Do not install unnecessary packages. If a dependency is essential and is not already available, explain why and request approval before installing it.

## 9. BACKEND INTEGRATION READINESS

Although no backend is being developed now, prepare the frontend for future integration.

Use:
- Typed data models.
- Reusable services.
- Clear component boundaries.
- Centralised data handling.
- Consistent error handling.

Avoid placing mock data directly inside individual screen components.

Future backend integration should allow the mock services to be replaced with real API implementations.

Do not implement backend functionality in this phase.

---

# PHASE 2 — EXPO APPLICATION SERVICES BUILD AND INTERNAL DISTRIBUTION

IMPORTANT: Begin this phase only after the frontend has been implemented and reviewed.

The objective is to generate installable Android and iOS internal testing builds through Expo Application Services.

I want one EAS build command for both platforms when eligible.

## 10. SOURCE OF TRUTH — EXPO DOCUMENTATION

Read the actual raw Markdown documentation using curl.

Do not rely on summaries or remembered documentation.

Run:

```bash
curl -sL https://docs.expo.dev/build/setup.md
```

Then:

```bash
curl -sL https://docs.expo.dev/build/internal-distribution.md
```

Use these documents as the source of truth for the EAS configuration and distribution process.

## 11. STRICT EAS EXECUTION RULES

### Rule 1 — Verify Expo authentication

Run:

```bash
eas whoami
```

If the user is not logged in:

- Stop.
- Tell the user to run:

```bash
eas login
```

Wait for confirmation before continuing.

### Rule 2 — Verify the EAS project ID

Inspect the active Expo configuration.

Check whether it contains:

```json
{
  "extra": {
    "eas": {
      "projectId": "PROJECT_ID"
    }
  }
}
```

If `extra.eas.projectId` is missing:

- Stop.
- Tell the user to run:

```bash
eas init
```

Wait for confirmation.

### Rule 3 — Configure EAS

Check whether `eas.json` exists.

If it does not exist:

- Check whether the repository contains committed `android/` or `ios/` directories.

If there are no committed native directories, run:

```bash
eas build:configure --platform all
```

If committed native directories exist:

- Do not run the command.
- Give the user the exact command to run in their terminal.
- Explain the potential native project changes.
- Wait for confirmation.

Inspect `eas.json`.

Ensure the `preview` profile includes:

```json
{
  "build": {
    "preview": {
      "distribution": "internal"
    }
  }
}
```

Preserve other valid existing configuration.

### Rule 4 — Verify Apple Developer membership

Ask:

"Do you have a paid Apple Developer Program account?"

If yes, continue with iOS device registration.

If no, ask:

"Would you like to build for Android only?"

Do not attempt an iOS internal device build without the required Apple Developer membership.

### Rule 5 — Register iOS testing devices

For iOS builds, run:

```bash
eas device:list --json
```

If the command fails and lists available Apple teams, repeat it with:

```bash
eas device:list --json --apple-team-id <ID>
```

If no Apple teams are found, or the device list is empty:

- Stop.
- Tell the user to run:

```bash
eas device:create
```

Wait for device registration before continuing.

### Rule 6 — Protect existing Google Play signing credentials

Determine whether the application has previously been published on Google Play.

If it has already been published and Expo does not have its existing Android keystore:

- Stop.
- Do not generate a new keystore.
- Ask the user to consult the application's release owner.
- Do not proceed until signing credentials are clarified.

If the application has never been published, clarify the signing situation before generating credentials if necessary.

Never overwrite or replace existing production signing credentials without explicit permission.

### Rule 7 — Generate the build command, but do not execute it

IMPORTANT:

Do not execute the actual build command yourself.

For Android and iOS:

```bash
eas build --platform all --profile preview
```

For Android only:

```bash
eas build --platform android --profile preview
```

Give the applicable command to the user to execute in their own terminal.

The user must perform the build because iOS signing may require access to their Apple account.

### Rule 8 — Retrieve the build links

Wait until the user confirms that the build has finished.

Then run:

```bash
eas build:list --limit 2 --non-interactive
```

Report:
- Android build status.
- iOS build status, if applicable.
- Build page links.
- Install links.
- Any build failures.
- Any remaining device registration requirements.

Do not invent build links or claim a successful build without verifying the results.

---

## 12. STRICT FILE MODIFICATION RULES FOR PHASE 2

During the EAS configuration and build-preparation phase:

- Do not add or change files other than `app.json` and `eas.json`.
- If `app.config.js` or `app.config.ts` exists, use that instead of `app.json`.
- Do not create another Expo configuration file.
- Do not modify source code.
- Do not modify `package.json`.
- Do not install other packages.
- Do not run a linter.
- Do not modify committed native `android/` or `ios/` files.
- If a command wants to modify native files, identify the exact file and ask the user first.

This restriction applies to EAS preparation, not the earlier frontend implementation phase.

## 13. COMMAND INTERACTION RULE

If any command requests:
- Login.
- Credentials.
- Apple account information.
- Team selection.
- Device registration.
- Project selection.
- Any other interactive choice.

STOP.

Do not guess.

Do not automatically submit information.

Give the user the exact command or action required in their terminal and wait for confirmation.

Do not bypass authentication or signing prompts.

## 14. FINAL REPORT

At the end of the work, provide a report containing:

1. Frontend implementation summary.
2. Screens implemented.
3. Features implemented.
4. Mock data functionality.
5. Project structure.
6. Files created and modified.
7. Tests actually performed.
8. EAS configuration status.
9. Commands executed.
10. Commands the user executed.
11. Android build link.
12. iOS build link, if applicable.
13. Outstanding issues.

Keep the frontend/backend separation intact.

The final application must be a working frontend prototype that can be installed on physical testing devices, with backend integration reserved for a future development phase.

**START BY INSPECTING THE EXISTING GIT REPOSITORY AND THE FIGMA DESIGN. DO NOT START CODING UNTIL YOU UNDERSTAND THE EXISTING PROJECT AND DESIGN.**