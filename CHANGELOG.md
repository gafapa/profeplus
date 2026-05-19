# Changelog

## [Unreleased]

### Changed

- Replaced direct in-app WebLLM usage with the external AI Proxy Bridge Chrome extension runtime.
- Removed the in-app AI assistant/settings route and enabled the extension-provided compact overlay.
- Removed `@mlc-ai/web-llm` from the app bundle.
- Updated dependencies within the current non-major ranges and fixed all reported npm audit vulnerabilities.
- Split production vendor chunks and reduced the PWA precache payload from roughly 6.4 MB to roughly 526 KB.
- Added schema validation to database backup imports.
- Added image type and size validation before storing student photos.
- Added cleanup for task sessions that reference a deleted course.
- Added a small Vitest suite so the test command verifies real code.

## [0.1.0] - 2026-03-19

### Added

- Windows development server fix for Claude Preview.

## [0.1.0-rc4] - 2026-03-18

### Added

- Task search in the planner.
- Attendance statistics tab.
- AI assistant test chat.

## [0.1.0-rc3] - 2026-03-18

### Added

- Academic management module for courses, students with photos, subjects, units, schedules, and backups.
- Basic reports module.
- Rubric and checklist score support in the gradebook.

## [0.1.0-rc2] - 2026-03-18

### Changed

- Reset the database schema to a single current version.
- Improved AI response parsing robustness.

## [0.1.0-rc1] - 2026-03-02

### Added

- Subject-scoped gradebook.
- End-to-end task workflow linked to the gradebook.
- Time-slot attendance journal.
- Weighted tasks and rubric/checklist templates.

## [0.0.1] - 2026-02-19

### Added

- Initial Vite + React + Dexie + Redux PWA structure.
- Base attendance, gradebook, task, rubric, and AI modules.
