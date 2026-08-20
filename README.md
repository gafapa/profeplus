# ProfePlus

ProfePlus is an offline-first teacher notebook packaged as a PWA. It is built for day-to-day classroom management: courses, students, subjects, schedules, attendance, work logs, task planning, gradebook, follow-up records, reports, and local backups.

All academic data is stored locally in the browser with IndexedDB. AI features are routed through the external AI Proxy Bridge Chrome extension; the app does not bundle a local model runtime.

## Current Scope

- A public landing page explains the local-first value proposition before opening the private teacher workspace. It uses a clearly labeled simulated day view and does not require account creation.
- Top-level teacher workspace organized around Today, an actionable Agenda, the weekly Planificador, advanced task evaluation, attendance history, gradebook, academic management, reports, and configuration.
- A local-first action agenda combines overdue and upcoming tutor follow-ups, family next steps, planned task sessions, dated assessments, and open academic-period endings. It supports course, type, status, and time-horizon filters plus standards-based ICS calendar export.
- A persistent classroom layout supports accessible seat reassignment and swapping, random seating, non-repeating student selection, balanced group generation, and optional exclusion of students marked absent today.
- Course and student management, including student photos, email contacts, educational measures, tutorial follow-up records, CSV import, and pasted spreadsheet import.
- Local resource attachments for student evidence and reusable task materials, supporting validated web links and common document, image, audio, and video formats.
- A guided, resumable onboarding flow that derives progress from saved course, student, schedule, and subject data without creating sample content.
- Mobile-first tutor coordination with due dates, ownership, priorities, structured family contacts, and cross-class support groups backed by stable person identities.
- Subject, unit, task, and schedule management, with exactly one course per subject, one-action course enrollment, optional task units, validated weekly time blocks, guarded autosave, and task evaluation setup.
- Monthly attendance history with course, subject, status, and student filters, incident summaries, detailed records, and contextual links back to the matching Today session.
- Ad-hoc and one-occurrence rescheduled classes, with justified absences, late minutes, early departures, and backup-safe exceptional occurrence identifiers.
- Advanced evaluation workspace for task sessions, rubrics, checklists, and direct grades, with free-form daily records handled in Today.
- Weekly planner with contextual links from Today, quick two-step task assignment, immediate undo, touch- and keyboard-friendly session rescheduling, multi-session progress, and advanced session fields for status, objectives, competencies, materials, homework, and teacher notes.
- Gradebook with persisted academic periods, manual assessments, weights, folders, competencies, per-student grades, observations, task scores, and immutable versioned closure snapshots.
- Bulk grade entry with visible-student filtering, shared status/value actions, spreadsheet matrix paste, and keyboard cell navigation. Missing, exempt, and not-submitted work remain semantically distinct.
- A categorized feedback bank inserts teacher-authored reusable comments into Today observations and manual gradebook evidence without applying or saving them automatically.
- Accent-insensitive global search finds students, tasks, assessments, follow-ups, family contacts, and local resources, then opens the owning workspace with its academic context restored.
- Reusable units, tasks, rubrics, and checklists, plus accessible `Move to…` controls wherever drag and drop is offered.
- Reports module with date-range filtering, printable HTML reports, CSV exports, AI-ready datasets, and AI report generation through the extension runtime.
- Local database operations for seeded test data, encrypted JSON backup export/import, integrity checks, and data reset. Destructive replacements create an encrypted safety backup and require explicit confirmation.
- Selective encrypted handoff packages for chosen students and support groups, with conflict preview and non-destructive merge semantics.
- Privacy-preserving product analytics record only fixed event names through same-origin, bodyless requests. No academic content, search text, record IDs, cookies, or persistent user identifiers are collected.
- An in-app feedback composer lets teachers review and share a suggestion, problem, or question through the browser share sheet or clipboard without sending academic data automatically.
- Backup freshness reminders, a visible recovery status, and non-destructive backup-file verification make the local-only storage model explicit and easier to recover.

## Teacher Workflow

Each academic record has one primary workspace. Cross-links preserve context and accelerate navigation without creating a second editor for the same data.

- **Today** owns class delivery: attendance, attendance observations, the actual class record, and quick per-student work comments.
- **Agenda** derives a read-only action list from existing academic records and links each item back to its owning workspace.
- **Classroom** owns the persistent seating plan and temporary participation/grouping tools for the selected course.
- **Search** provides cross-workflow discovery and deep links without duplicating record editors.
- **Planificador** owns future preparation: assigning tasks to schedule slots, rescheduling sessions, and editing planned objectives, materials, homework, and notes.
- **Evaluate** owns task evidence: rubric results, checklist results, and direct task grades.
- **Attendance** owns review: monthly history, incident summaries, filtering, and contextual links to correct the original class in Today.
- **Gradebook** owns grade consolidation: manual assessments, folders, weights, task-score inclusion, and final-grade calculations.
- **Management** owns reusable task resources and student evidence files. Attachments remain local and travel only inside full database backups.

## Academic Periods And School-Year Rollover

Academic periods are managed from `Management > Periods`. Each period belongs to one course, has an explicit date range, and cannot overlap another period in that course. Manual assessments store a local ISO `assessmentDate`; manual assessments and task gradebook configurations can be assigned to a period. A closed period rejects grade and task-evaluation changes until it is explicitly reopened.

Closing a period creates a new immutable, versioned snapshot of the course structure and the period-scoped gradebook evidence. Reopening does not delete or rewrite earlier snapshots; a later closure appends another version. These snapshots are included in encrypted database backups and are validated during import.

The school-year rollover action can create a new course or populate a selected empty course. It copies structural data such as student enrolments, subjects, units, tasks, instruments, gradebook definitions, and shifted academic periods. It deliberately does not copy grades, attendance, session evidence, evaluations, follow-up records, or closure snapshots. New enrolment rows retain the student's stable `personId`, which keeps longitudinal identity separate from the year-specific enrolment ID.

The v1-to-v2 migration preserves existing manual assessments. Legacy text period labels become non-overlapping academic periods distributed across the September-to-June school year, and their deterministic default `assessmentDate` is the end of the generated period. Teachers should review these generated dates before closing migrated periods.

## Stack

- React 19 + TypeScript 5.9
- Vite 8 with a native service worker and web app manifest
- Redux Toolkit 2
- Dexie 4 with IndexedDB
- React Router 7
- Vitest 4

## Requirements

- Node.js 22.13+ (`.node-version` currently selects Node.js 24.18)
- npm 10+
- Chrome or Chromium for AI features and browser QA
- AI Proxy Bridge extension loaded from `D:\ProyectosIA\ia extension\dist\extension` when AI workflows are needed

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server prints the local URL. By default it uses the configured base path from the environment.

## Scripts

```bash
npm run dev        # Start Vite in development mode
npm run build      # Type-check and build production assets into dist/
npm run build:test # Build the test deployment profile
npm run build:production # Build the production deployment profile
npm run preview    # Preview the production build
npm run clean      # Remove generated builds, coverage, logs, and TypeScript caches
npm run test       # Run Vitest
npm run test:coverage # Run Vitest and write the full source coverage report
npm run lint       # Run ESLint, including React hook checks
npm run typecheck  # Run TypeScript project checks
npm run audit      # Audit dependencies against the reviewed advisory policy
npm run verify     # Run lint, typecheck, tests, build, and dependency audit
```

Use `npm run verify` before publishing or handing off a larger change.

## Data Model And Backups

ProfePlus has no backend. Data persists in IndexedDB through Dexie.

Database tools are available under `Configuración > Base de datos`:

- Load seeded demo data for local testing.
- Export an AES-256-GCM encrypted JSON backup with app metadata, schema version, export timestamp, and table data. Keys are derived from a password of at least 12 characters using PBKDF2-SHA-256 with 210,000 iterations.
- Import an encrypted backup, or a legacy plaintext JSON backup, after validating the exact current schema, export timestamp, complete table set, row IDs, references, duplicates, dates, schedule-day alignment, schedule overlaps, task scopes, and assessment shapes.
- Verify the current database integrity or validate an existing backup file without replacing local data.
- Delete all local app data.

Backups include `schemaVersion` and `exportedAt`. Unsupported or malformed backups are rejected before existing local tables are cleared. Imports and destructive demo/reset operations show a confirmation summary and require a separate password before downloading an encrypted safety backup.

The IndexedDB database uses additive Dexie migrations under `profeplus-db`; schema v2 added academic periods and closure snapshots without deleting v1 data, schema v3 added stable person identities and tutor-coordination tables, schema v4 added resource attachments, schema v5 added classroom layouts, and schema v6 added reusable feedback comments. Student enrolment rows carry a stable `personId` so year rollover can create a new enrolment without losing longitudinal identity. Cross-class support groups reference those student enrolments without duplicating student profiles. Each subject belongs to exactly one course. Attendance and task evaluation rows always include their course, subject, date, schedule slot, and required scope fields. Attendance also stores creation and update timestamps. Free daily class records allow Today to document unplanned lessons without creating artificial tasks.

Resource files are stored as backup-safe base64 data with a 5 MB per-file limit and a 20 MB application-wide limit. Active web formats such as HTML and SVG are rejected; links must use HTTP or HTTPS. Deleting an otherwise unreferenced student or task also removes its attachments. Full encrypted backups include resources, while school-year rollover and selective student handoff packages deliberately exclude them to avoid silently duplicating or disclosing files.

Classroom layouts are course-scoped and included in full encrypted backups. Deleting an otherwise empty course removes its layout, and deleting an otherwise unreferenced student removes that student's seat assignment. Temporary random-picker rounds and generated groups are intentionally not persisted.

Selective handoff packages contain only the selected students, their course references, tutorial follow-ups, structured family contacts, and relevant support-group memberships. They never include attendance, gradebook data, or resource attachments. Import first validates references and IDs, then shows creates, unchanged rows, and conflicts. Any conflicting ID blocks the complete merge; accepted merges use insert-only operations and never overwrite local rows.

Database payloads are intentionally not backward compatible. Only payloads produced by the current schema are accepted, and every current table must be present. This keeps import behavior deterministic and prevents inferred or partially scoped academic records.

## Security Model

- Academic records remain local to the browser profile in IndexedDB; ProfePlus has no application backend.
- Downloaded backups and automatic pre-operation safety backups are encrypted. ProfePlus never stores their passwords.
- An optional local app lock uses a salted PBKDF2-SHA-256 verifier, validates its stored work factor, pauses retries after repeated failures, and automatically locks after the configured inactivity period. It protects the visible application from casual access but is not a substitute for operating-system disk and profile encryption.
- CSV exports neutralize spreadsheet formula prefixes before escaping cell values.
- Backup imports enforce a size limit and validate metadata, structure, types, relationships, scopes, uniqueness, dates, and numeric ranges before changing the database.
- Resource imports additionally validate ownership, web protocols, MIME allowlists, exact base64 byte lengths, and per-file and total storage limits.
- The application includes a restrictive Content Security Policy, referrer policy, permission policy, cross-origin isolation headers, clickjacking protection, and MIME-sniffing protection. `public/_headers` applies the full header set on compatible static hosts. Nginx deployments can include `deploy/nginx-security-headers.conf` from the HTTPS server or location block.
- Anyone with access to an unlocked browser profile can still inspect its IndexedDB data. Use an encrypted operating-system account and do not share the browser profile when handling real student data.

## Anonymous Product Analytics

Production builds can emit a deliberately small set of anonymous product events to the same origin. Events are encoded only in an allowlisted URL path and sent as `POST` requests with no request body, query string, cookies, referrer, student data, free text, record IDs, or generated user ID. Browser Do Not Track and Global Privacy Control are respected. Test and local builds leave analytics disabled by default.

The supported events cover application and coarse workspace opens, initial setup completion, class saves, calendar exports, search use, backup export/verification/import, and feedback opening/sharing. They measure whether major workflows are reached; they do not reconstruct teacher behavior or individual sessions.

For Nginx, include `deploy/nginx-analytics-log-format.conf` once inside the global `http` block and `deploy/nginx-analytics-endpoint.conf` inside the production HTTPS `server` block before publishing. The endpoint returns `204` and writes a dedicated-format line to the container log containing only an ISO timestamp and the fixed event path; IP addresses, user agents, referrers, cookies, request bodies, and query strings are excluded from that line. Set `VITE_ANALYTICS_ENDPOINT` to an empty value to disable collection.

## AI Extension

ProfePlus does not include an in-app AI settings page and does not import WebLLM directly.

AI features use the AI Proxy Bridge Chrome extension through its versioned same-origin page bridge:

- The extension injects its compact overlay into trusted pages.
- Feature-level AI requests go through `src/shared/ai/extensionRuntime.ts`.
- Report generation asks for explicit confirmation before academic data is sent to AI.
- AI reports anonymize student names by default, with an opt-in control to include names when needed.

Configuration options:

- `VITE_AI_RUNTIME_EXTENSION_ID`: optional extension-ID pin. Use it when the deployed extension has a stable ID.
- Without a pin, the app discovers the installed bridge through a versioned `postMessage` availability exchange and keeps the discovered ID fixed for each request.
- The extension must authorize the current hostname, such as `localhost`, `127.0.0.1`, or the deployed domain.

The extension project is external to this app and should be managed separately.

## Project Layout

```txt
src/
  app/                  Redux store and typed hooks
  modules/
    agenda/             Cross-workflow action agenda and calendar export
    classroom/          Persistent seating plan and temporary classroom tools
    attendance/         Attendance journal and work diary
    gradebook/          Weighted gradebook and manual assessment entry
    management/         Courses, students, subjects, units, tasks, schedules, backups
    planner/            Weekly task-session planner
    reports/            Printable, CSV, and AI-assisted reports
    search/             Cross-record search and contextual navigation
    today/              Daily classroom workspace
  shared/
    agenda/             Agenda derivation and ICS serialization
    ai/                 AI extension runtime client
    attendance/         Attendance normalization helpers
    backup/             Password-based backup encryption
    classroom/          Seating, random selection, and balanced grouping logic
    db/                 Dexie schema and shared types
    export/             Safe CSV serialization
    feedback/           Reusable teaching feedback and product feedback controls
    gradebook/          Gradebook and scoring calculations
    handoff/            Selective student handoff validation and merge previews
    hooks/              Shared React hooks
    import/             Student import parsing
    planner/            Planner/session helpers and printable exports
    resources/          Secure local resource validation and shared attachment UI
    reports/            Printable report generation
    search/             Accent-insensitive cross-record search logic
    students/           Student follow-up helpers
    ui/                 Shared UI components
    utils/              General utilities
```

Rubrics and checklists are managed inside task management.

## Testing And QA

Automated coverage includes focused Vitest suites for:

- Agenda action derivation, filtering boundaries, contextual routes, and ICS calendar serialization.
- Classroom dimensions, assignment cleanup, seat swapping, random layouts, balanced groups, and non-repeating picks.
- Backup payload validation.
- Anonymous analytics event allowlisting and route mapping.
- Backup freshness classification and status copy.
- Resource URL, file-type, size, base64-integrity, and backup-reference validation.
- Feedback normalization, duplicate prevention, explicit insertion, and backup validation.
- Global search matching, accent normalization, result typing, and contextual routes.
- Student import parsing.
- Attendance note normalization.
- Attendance historical subject context and free daily class record validation.
- Gradebook calculations and manual assessment behavior.
- Explicit grade statuses, bulk spreadsheet parsing, report date filtering, and no-data risk behavior.
- Academic-period overlap rules, immutable closure versions, and isolated school-year rollover mapping.
- Planner session planning and printable planner exports.
- Schedule draft validation, disabled-day dependency detection, and Planner rescheduling targets.
- Printable reports.
- Student follow-up helpers.
- AI-generated instrument parsing and validation.
- Versioned AI extension bridge envelopes.
- Student handoff scope, reference, date, and enum validation.

Run `npm run test:coverage` to generate the complete text and HTML coverage report for `src/`.

Run the full verification with:

```bash
npm run verify
```

The expected result is:

- TypeScript project checks pass.
- ESLint passes without errors or warnings.
- Every Vitest suite passes.
- Production build succeeds.
- The dependency audit passes with one reviewed React Router advisory exception. The affected RSC/server-action path is not enabled in this client-only SPA.

The latest production browser QA covered:

- Production loading from the domain root and route-level lazy loading.
- Accessible navigation landmarks, skip link, page headings, configuration navigation, and modal labeling.
- Encrypted backup password requirements and disabled export behavior until both passwords match.
- A visible, recoverable page for unknown routes.
- Reports at a mobile viewport without horizontal document overflow.
- Console health without relevant errors or warnings.
- Tutor workflows at 390 × 844 without document overflow, with accessible tab/tabpanel semantics.

GitHub Actions runs the same `npm run verify` pipeline on pushes to `main` and on pull requests.

## Deployment Environments

Both deployments serve the SPA from the domain root:

| Environment | Public URL | Build command | Environment file |
| --- | --- | --- | --- |
| Test | `https://test.profeplus.gallego.top` | `npm run build:test` | `.env.test` |
| Production | `https://profeplus.gallego.top` | `npm run build:production` | `.env.production` |

Each build writes the deployable static application to `dist/`. The hosting
provider must:

- Serve `dist/` over HTTPS.
- Rewrite unknown application routes to `index.html`.
- Apply the security headers in `public/_headers`, or equivalent platform
  configuration. For Nginx, include `deploy/nginx-security-headers.conf` and
  reload Nginx after validating the configuration.
- For production analytics, include `deploy/nginx-analytics-log-format.conf`
  in the global `http` block and `deploy/nginx-analytics-endpoint.conf` in the
  HTTPS server block. Test analytics remain disabled unless explicitly enabled.
- Avoid sharing browser storage or service-worker state between the two
  domains. Their separate origins provide this isolation automatically.

The AI Proxy Bridge extension must authorize both deployment hostnames when AI
features are enabled.

## Development Conventions

- Documentation, variable names, function names, and code comments are written in English.
- User-facing UI text can remain Spanish.
- Keep data operations local-first and avoid introducing backend dependencies unless the architecture is intentionally changed.
- Keep AI calls behind the extension runtime; do not reintroduce direct WebLLM imports in the app bundle.
