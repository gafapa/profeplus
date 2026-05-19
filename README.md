# ProfePlus

Teacher notebook web app packaged as a PWA. Data is stored locally in IndexedDB and AI features are routed through the companion Chrome extension.

## Current Scope

- Main workspace with journal, gradebook, evaluation tools, reports, and academic management.
- Academic management for courses, students, subjects, units, tasks, schedules, preferences, and database operations.
- Rubric and checklist generation through the AI Proxy Bridge Chrome extension.
- Local-first persistence with Dexie and IndexedDB.
- Backup export/import with schema checks.

## Stack

- React 19 + TypeScript 5.9
- Vite 7
- Redux Toolkit 2
- Dexie 4
- React Router 7
- Vitest 4
- vite-plugin-pwa 1.3

## Requirements

- Node.js 22+
- npm 10+
- Chrome or Chromium for AI features
- AI Proxy Bridge extension loaded from `D:\ProyectosIA\ia extension\dist\extension`

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Tests

```bash
npm run test
```

## AI Extension

ProfePlus does not include its own AI settings page. The AI Proxy Bridge Chrome extension injects its compact overlay in the page, and feature-level AI requests connect to that same extension runtime.

Configuration options:

- `VITE_AI_RUNTIME_EXTENSION_ID`: optional default extension ID.
- The app can also detect the extension through the content-script ready event on trusted origins.
- The extension must authorize the current hostname, such as `localhost`, `127.0.0.1`, or the deployed domain.

The extension project is external to this app and should be managed separately.

## Deploying Under a Subdirectory

The app supports root and subdirectory deployments.

Environment variables:

- `VITE_BASE_PATH=/` for local development or domain root.
- `VITE_BASE_PATH=/profeplus/` for a subdirectory deployment.

Relevant files:

- `.env.example`
- `.env.production`

## Data Management

Database tools are available under `Configuracion > Base de datos`:

- Export a JSON backup.
- Import a JSON backup after app/schema/table validation.
- Delete all local app data.

Backups include a `schemaVersion` field so future migrations can reject unsupported files.
