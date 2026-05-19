# CLAUDE.md - ProfePlus

Context guide for coding agents working on ProfePlus.

## Description

ProfePlus is an offline-first PWA for teachers. It includes a gradebook, journal, task planning, attendance tracking, rubrics, checklists, reports, and local database tools.

AI features are provided by the external AI Proxy Bridge Chrome extension located at `D:\ProyectosIA\ia extension`. Do not modify that extension from this project.

## Stack

- React 19 + TypeScript 5.9
- Vite 7 + vite-plugin-pwa 1.3
- Redux Toolkit 2
- Dexie 4 with IndexedDB
- React Router DOM 7
- Vitest 4

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run test
```

## Source Layout

```txt
src/
  app/                  # Redux store and typed hooks
  modules/
    attendance/         # Journal and attendance workflows
    gradebook/          # Weighted gradebook
    rubrics/            # Rubrics and checklists
    reports/            # Reporting views
    management/         # Courses, students, subjects, units, tasks, schedules, backups
  shared/
    ai/                 # AI extension runtime client
    db/                 # Dexie schema and shared types
    ui/                 # Shared components
    hooks/              # Shared React hooks
    utils/              # Shared utilities
```

## Data

- There is no backend. Data persists in the user's browser through IndexedDB.
- Backup imports must validate app name, schema version, allowed table names, and row IDs before clearing data.
- Do not add automatic seed data on normal app startup.

## Deployment

- Root deployment: `VITE_BASE_PATH=/`
- Subdirectory deployment: `VITE_BASE_PATH=/profeplus/`
- Optional AI extension default: `VITE_AI_RUNTIME_EXTENSION_ID=<chrome-extension-id>`

## Conventions

- Documentation, variable names, function names, and comments are written in English.
- User-facing UI text can remain Spanish.
- Keep modules scoped under `src/modules/<module-name>/`.
- Keep AI calls behind `src/shared/ai/extensionRuntime.ts`; do not reintroduce direct WebLLM app imports.
