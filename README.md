# ProfePlus

ProfePlus is an offline-first teacher notebook packaged as a PWA. It is built for day-to-day classroom management: courses, students, subjects, schedules, attendance, work logs, task planning, gradebook, follow-up records, reports, and local backups.

All academic data is stored locally in the browser with IndexedDB. AI features are routed through the external AI Proxy Bridge Chrome extension; the app does not bundle a local model runtime.

## Current Scope

- Top-level teacher workspace with separate tabs for attendance, work diary, weekly planner, gradebook, academic management, reports, and configuration.
- Course and student management, including student photos, email contacts, educational measures, tutorial follow-up records, CSV import, and pasted spreadsheet import.
- Subject, unit, task, and schedule management, including subject-course links, subject-student links, weekly time blocks, and task evaluation setup.
- Attendance journal with per-slot attendance status and notes.
- Work diary with per-task session comments, rubric/checklist/direct-grade evaluation data, and persistence per class, subject, date, and schedule slot.
- Weekly planner for assigning task sessions to schedule slots, tracking session status, objectives, competencies, materials, homework, and teacher notes.
- Gradebook with manual assessments, weights, folders, periods, competencies, per-student grades, observations, and task scores.
- Reports module with printable HTML reports, CSV exports, AI-ready datasets, and AI report generation through the extension runtime.
- Local database operations for seeded test data, JSON backup export/import, integrity checks, and data reset.

## Stack

- React 19 + TypeScript 5.9
- Vite 7 + vite-plugin-pwa 1.3
- Redux Toolkit 2
- Dexie 4 with IndexedDB
- React Router 7
- Vitest 4

## Requirements

- Node.js 22+
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
npm run preview    # Preview the production build
npm run test       # Run Vitest
npm run typecheck  # Run TypeScript project checks
npm run audit      # Run npm audit
npm run verify     # Run typecheck, tests, production build, and audit
```

Use `npm run verify` before publishing or handing off a larger change.

## Data Model And Backups

ProfePlus has no backend. Data persists in IndexedDB through Dexie.

Database tools are available under `Configuración > Base de datos`:

- Load seeded demo data for local testing.
- Export a JSON backup with app metadata, schema version, export timestamp, and table data.
- Import a JSON backup after validating app name, schema version, export timestamp, allowed tables, row IDs, references, duplicates, dates, schedule overlaps, task assessment shapes, and supported legacy tables.
- Verify database integrity.
- Delete all local app data.

Backups include `schemaVersion` and `exportedAt`. Unsupported or malformed backups are rejected before existing local tables are cleared.

## AI Extension

ProfePlus does not include an in-app AI settings page and does not import WebLLM directly.

AI features use the AI Proxy Bridge Chrome extension:

- The extension injects its compact overlay into trusted pages.
- Feature-level AI requests go through `src/shared/ai/extensionRuntime.ts`.
- Report generation asks for explicit confirmation before academic data is sent to AI.
- AI reports anonymize student names by default, with an opt-in control to include names when needed.

Configuration options:

- `VITE_AI_RUNTIME_EXTENSION_ID`: optional default extension ID.
- The app can also detect the extension through the content-script ready event on trusted origins.
- The extension must authorize the current hostname, such as `localhost`, `127.0.0.1`, or the deployed domain.

The extension project is external to this app and should be managed separately.

## Project Layout

```txt
src/
  app/                  Redux store and typed hooks
  modules/
    attendance/         Attendance journal and work diary
    gradebook/          Weighted gradebook and manual assessment entry
    management/         Courses, students, subjects, units, tasks, schedules, backups
    planner/            Weekly task-session planner
    reports/            Printable, CSV, and AI-assisted reports
  shared/
    ai/                 AI extension runtime client
    attendance/         Attendance normalization helpers
    db/                 Dexie schema and shared types
    gradebook/          Gradebook and scoring calculations
    hooks/              Shared React hooks
    import/             Student import parsing
    planner/            Planner/session helpers and printable exports
    reports/            Printable report generation
    students/           Student follow-up helpers
    ui/                 Shared UI components
    utils/              General utilities
```

Rubrics and checklists are managed inside task management. The legacy `/rubrics` route redirects to `/management/tasks`.

## Testing And QA

Automated coverage includes focused Vitest suites for:

- Backup payload validation.
- Student import parsing.
- Attendance note normalization.
- Gradebook calculations and manual assessment behavior.
- Planner session planning and printable planner exports.
- Printable reports.
- Student follow-up helpers.
- AI-generated instrument parsing and validation.

The latest full verification passed with:

```bash
npm run verify
```

Expected result at the time of this documentation update:

- TypeScript project checks pass.
- Vitest reports 12 passing test files and 94 passing tests.
- Production build succeeds.
- `npm audit` reports 0 vulnerabilities.

Recent browser QA also covered:

- App load, page identity, non-blank render, and no framework overlay.
- Seeded data and database integrity check.
- Management pages for courses, students, subjects, tasks, and schedule.
- Student follow-up persistence after reload.
- Attendance status and note persistence.
- Work diary student comment persistence after the scoped task evaluation schema migration.
- Planner scheduling UI for a newly created multi-session task.
- Manual gradebook assessment and grade persistence.
- CSV academic report download.
- Mobile planner rendering at 390x844.
- Console health without relevant errors, warnings, page errors, or unhandled rejections.

## Deploying Under A Subdirectory

The app supports root and subdirectory deployments.

Environment variables:

- `VITE_BASE_PATH=/` for local development or domain root.
- `VITE_BASE_PATH=/profeplus/` for a subdirectory deployment.

Relevant files:

- `.env.example`
- `.env.production`

## Development Conventions

- Documentation, variable names, function names, and code comments are written in English.
- User-facing UI text can remain Spanish.
- Keep data operations local-first and avoid introducing backend dependencies unless the architecture is intentionally changed.
- Keep AI calls behind the extension runtime; do not reintroduce direct WebLLM imports in the app bundle.
