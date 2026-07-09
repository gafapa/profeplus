# Changelog

## [Unreleased]

### Added

- Added a weekly planner screen for assigning task sessions to class schedule slots.
- Added manual gradebook assessments with editable weights, folders, periods, competencies, and per-student grades.
- Added per-student observations for manual gradebook assessment grades.
- Added CSV student import from the students management screen.
- Added pasted spreadsheet table import for students.
- Added broader student import support for common school roster headers and `Last name, First name` formats.
- Added printable HTML group reports for browser printing or PDF export.
- Added printable individual student report packs with one page per student.
- Added printable weekly planner exports with session objectives, materials, homework, and teacher notes.
- Added student follow-up records for tutorial tracking, family contacts, incidents, agreements, adaptations, and wellbeing notes.
- Added editable student email contact data and included it in non-AI report exports.
- Added extended session planning fields in the weekly planner, including status, objectives, competencies, materials, homework, and teacher notes.
- Added seven-day schedule support so Saturday and Sunday can be enabled when needed.

### Changed

- Replaced direct in-app WebLLM usage with the external AI Proxy Bridge Chrome extension runtime.
- Removed the in-app AI assistant/settings route and enabled the extension-provided compact overlay.
- Removed `@mlc-ai/web-llm` from the app bundle.
- Updated dependencies within the current non-major ranges and fixed all reported npm audit vulnerabilities.
- Hardened AI extension identity checks and made AI report generation ask for explicit confirmation before sending academic data.
- AI reports now anonymize student names by default, with an opt-in control to include names when needed.
- Changed PWA updates to prompt before reloading instead of taking over open sessions silently.
- Fixed gradebook and report scoping for task sessions/comments shared across subjects.
- Fixed task score calculations so stale rubric or checklist rows from inactive templates do not affect grades.
- Fixed task score calculations so duplicate rubric criteria or checklist item rows cannot inflate grades.
- Fixed task diary saves and planner session data counts after the scoped task evaluation schema migration.
- Fixed the weekly planner so it only renders days enabled in the schedule.
- Replaced the schedule block class/break checkbox with an explicit segmented control.
- Normalized attendance notes so clearing or whitespace-only observations is persisted correctly.
- Aligned the Dexie schema version with the exported backup schema version.
- Split production vendor chunks and reduced the PWA precache payload from roughly 6.4 MB to roughly 526 KB.
- Added schema validation to database backup imports.
- Hardened backup validation for attendance rows, student photo data URLs, rubrics, and checklist templates.
- Hardened backup validation against duplicate logical rows in attendance, gradebook, task sessions, and task assessment tables.
- Hardened backup validation against planner sessions that collide in the same class schedule slot.
- Hardened backup validation for invalid numeric ranges in session counts, positions, and gradebook weights.
- Hardened backup validation for negative rubric assessment scores.
- Hardened backup validation for task diary student and general comments.
- Hardened backup metadata validation for invalid export timestamps.
- Hardened backup validation for impossible dates, duplicated weekdays, and overlapping schedule blocks.
- Added image type and size validation before storing student photos.
- Added cleanup for task sessions that reference a deleted course.
- Added a small Vitest suite so the test command verifies real code.
- Added `typecheck`, `audit`, and `verify` project scripts, with `verify` now covering production builds.

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
