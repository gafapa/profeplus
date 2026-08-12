# Changelog

## [Unreleased]

### Added

- Added explicit root-domain build profiles for the test deployment at `test.profeplus.gallego.top` and production at `profeplus.gallego.top`.
- Added non-destructive onboarding, ad-hoc classes, one-occurrence rescheduling, justified absences, late minutes, and early-departure tracking.
- Added explicit graded, pending, not-submitted, and exempt grade states with a configurable not-submitted calculation policy.
- Added bulk grade actions, spreadsheet matrix paste, student filtering, and keyboard navigation in the gradebook.
- Added reusable units, tasks, rubrics, and checklists across teaching contexts.
- Added accessible `Move to…` alternatives for gradebook drag-and-drop workflows.
- Added an optional PBKDF2-based local app lock with inactivity timeout and manual locking.
- Added a mobile-first tutor workspace for accountable follow-ups, structured family contacts, and cross-class support groups.
- Added stable student person identities for cross-year rollover and selective AES-256-GCM handoff packages with conflict-blocking merge previews.
- Added AES-256-GCM backup encryption with PBKDF2-SHA-256 key derivation and encrypted safety backups for destructive database actions.
- Added CSV formula-injection protection and focused export tests.
- Added route-level code splitting, a recoverable not-found page, and application-level runtime error boundaries.
- Added ESLint with React hook checks, a full verification script, and GitHub Actions continuous integration.
- Added a native offline service worker, web app manifest, deployment security headers, and a production-aware Content Security Policy.
- Added local-calendar date utilities and tests for timezone boundary behavior.
- Added accessible skip navigation, page heading structure, status announcements, keyboard focus handling, reduced-motion support, and mobile overflow protection.
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
- Added a daily Today workspace that combines current class selection, attendance, planned work, and quick work diary notes.
- Added free daily class records so unplanned lessons can store general and per-student work without creating artificial tasks.
- Added subject, status, and student filters to attendance history.
- Added date-range controls to reports.
- Added immediate undo for Planner quick assignment, removal, and movement actions.
- Added date-and-time session rescheduling for touch, mouse, and keyboard workflows.
- Added focused validation tests for schedule drafts, disabled days, and Planner rescheduling targets.
- Added persisted, non-overlapping academic periods with explicit manual assessment dates and period assignment for manual and task-based gradebook definitions.
- Added immutable versioned gradebook snapshots for period closure, explicit reopen controls, and closed-period write protection.
- Added a guarded school-year rollover workflow that copies reusable course structure while preserving historical records and stable student identities.

### Changed

- Migrated the AI integration to the extension's current versioned `postMessage` bridge and added protocol-envelope tests.
- Hardened student handoff imports with exact scope, real-date, enum, class relationship, and logical-duplicate validation.
- Prevented stale attendance loads from overwriting the active selection or reusing an attendance ID from another session.
- Hardened the local app lock against manipulated work factors and repeated unlock attempts.
- Updated compatible development dependencies, restored full-source coverage reporting, and added reusable Nginx security-header configuration.
- Standardized the first-run experience on the single term "initial setup" across global prompts, onboarding cards, dialogs, and actions.
- Unified initial-setup prompts under the primary blue visual treatment while keeping amber reserved for actionable context warnings.
- Separated the missing-group blocker from the onboarding progress coach, removing duplicated setup messaging and the redundant compact step badge.
- Reorganized the fifteen-item top navigation into five workflow areas with route-aware secondary navigation and a non-scrolling mobile layout.
- Redesigned the teacher setup prompt as a compact, responsive task card with clearer progress, next-step guidance, and accessible primary and secondary actions.
- Reports now apply date ranges to manual assessments through their explicit assessment date and exclude undated legacy rows instead of silently mixing periods.
- Attendance and reports now distinguish a measured zero percent from a course with no attendance observations.
- ACS and reinforcement measures remain visible support context but no longer increase the automatic academic risk label.
- Exceptional session IDs are accepted by backup import only when a matching scoped daily record exists.
- Updated React, React DOM, Redux Toolkit, Dexie, Vite, Vitest, TypeScript, and supporting type packages.
- Replaced the Workbox-based PWA plugin with a small native service worker, removing its vulnerable transitive dependency chain.
- Changed database exports and automatic safety copies from plaintext JSON to password-protected encrypted envelopes while retaining validated import support for existing plaintext backups.
- Made database snapshots and demo seeding transactional so exports and seeded datasets cannot be internally inconsistent.
- Changed production routing to lazy-load feature modules instead of shipping the entire application in the initial route bundle.
- Added a reviewed dependency-audit policy for the React Router RSC/server-action advisory that does not apply to this client-only SPA.
- Fixed local-date selection around UTC day boundaries.
- Fixed subject/student unlink protection so existing attendance records are counted as dependencies.
- Fixed CSV parsing for quoted fields containing embedded line breaks.
- Fixed unknown URLs rendering a blank application shell.
- Fixed management and configuration heading levels and accessible file-input labels.
- Fixed Reports and management layouts that could overflow on narrow viewports.
- Renamed the user-facing Planner module to Planificador across navigation, class shortcuts, dialogs, notices, and printable report titles.
- Clarified ownership across Today, Planner, Evaluate, Attendance, and Gradebook, and made contextual shortcut labels state their destination and purpose.
- Replaced ambiguous single-lesson wording with consistent class-focused save and warning messages.
- Restricted each subject to exactly one course across management, student enrollment, demo data, and backup validation.
- Added additive IndexedDB migrations through schema v3, preserving v1 academic data while introducing academic-period snapshots, stable person identities, and tutor-coordination tables.
- Removed backward-compatible backup imports; imports now require the exact current schema and every current table.
- Made course, subject, date, schedule slot, session status, and attendance timestamps mandatory where required by the academic record model.
- Added integrity validation for schedule weekday alignment, break blocks, timestamp chronology, scoped task records, and complete backup structure.
- Blocked schedule, subject-hour, and subject-course changes that would orphan existing attendance, planning, evaluation, or daily record data.
- Guarded management drafts against navigation, kept rejected saves dirty, and surfaced IndexedDB save failures without discarding the draft.
- Changed management update actions to report success explicitly before clearing local edits.
- Prevented schedule blocks with invalid ranges or overlaps from being saved.
- Prevented disabling an active schedule day when its class blocks still have dependent records.
- Changed quick-create actions to start from valid named records instead of persisting empty entities.
- Added one-action enrollment of every student in a course into its subject.
- Made task units optional so teachers can create quick tasks directly under a subject.
- Changed the subject course control from multi-select checkboxes to a single accessible course selector.
- Improved Today date navigation and aligned its class selector with the shared sidebar tab pattern.
- Reorganized the teacher workflow around Today, Planner, Evaluation, and attendance history.
- Replaced the duplicated attendance editor with monthly metrics, student incident summaries, and contextual history records.
- Renamed Work to Evaluation and removed duplicated free-form student comment controls from its advanced assessment tables.
- Added contextual navigation between Today, attendance history, Evaluation, and Planner sessions.
- Changed Today to close a class with one atomic action that stores attendance, observations, and work, including all-present classes.
- Added unsaved-change protection when changing Today date/class or leaving Today and when closing edited Planner sessions.
- Planner links from Today now preserve course, subject, date, and schedule slot and open the matching cell.
- Moved sessions now receive the `moved` status, while cancelled sessions no longer appear as active work in Today.
- Destructive database imports, resets, and demo-data replacement now require confirmation and create a safety backup first.
- Improved modal focus trapping, navigation semantics, touch target sizes, and the single-column mobile Planner layout.
- Simplified Planner scheduling to a two-step flow: select a pending task and choose a compatible empty time slot.
- Kept multi-session tasks selected until their required session count is complete and highlighted compatible targets for keyboard and touch use.
- Fixed pending-session detection so cancelled, disabled, orphaned, or weekday-incompatible sessions no longer count as planned.
- Changed Planner pending metrics from task counts to the actual number of sessions still requiring a date.
- Limited Planner's `Open in Today` action to saved sessions and removed it from the new-session modal state.
- Replaced direct in-app WebLLM usage with the external AI Proxy Bridge Chrome extension runtime.
- Removed the in-app AI assistant/settings route and enabled the extension-provided compact overlay.
- Removed `@mlc-ai/web-llm` from the app bundle.
- Updated dependencies within the supported ranges and removed all applicable npm audit vulnerabilities.
- Hardened AI extension identity checks and made AI report generation ask for explicit confirmation before sending academic data.
- AI reports now anonymize student names by default, with an opt-in control to include names when needed.
- Changed PWA updates to prompt before reloading instead of taking over open sessions silently.
- Fixed gradebook and report scoping for task sessions/comments shared across subjects.
- Fixed task score calculations so stale rubric or checklist rows from inactive templates do not affect grades.
- Fixed task score calculations so duplicate rubric criteria or checklist item rows cannot inflate grades.
- Fixed task diary saves and planner session data counts for strictly scoped task evaluation records.
- Fixed the weekly planner so it only renders days enabled in the schedule.
- Replaced the schedule block class/break checkbox with an explicit segmented control.
- Normalized attendance notes so clearing or whitespace-only observations is persisted correctly.
- Aligned the Dexie schema version with the exported backup schema version.
- Split production vendor and feature chunks and reduced the initial route payload.
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
