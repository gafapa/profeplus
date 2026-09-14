# Edunoza full-app teacher workflow review

Method: dual-agent (A: `/root/novice_teacher` · B: `/root/power_teacher`) plus independent mobile persona `/root/mobile_tutor` and parent cross-screen verification. Assessment A finished before detector results entered the synthesis. This is simulated use with fictional data, not research with real teachers or evidence of adoption.

Target: `src/App.tsx` and its 27 canonical surfaces, in the corrected local worktree. Production was not the target: the preceding deployment remained blocked by a full server volume. No application code or production state was changed during this review.

## Overall verdict and design specificity

Edunoza is useful as an individual teacher's local classroom notebook. Planned tasks, classroom records, attendance, direct grades, gradebook results and reports form a real connected workflow. The interface is recognizably designed for teachers: familiar Spanish workflow names, timetable context, attendance exceptions and student records. Its calm blue identity should be preserved.

It is not yet ready to hold the only copy of important academic records. The recovery validation blocker and cross-editor loss of follow-up metadata are more important than visual polish. Phone operation is also uneven: Today works substantially better than unit editing and attendance history. More features are not the immediate priority; safer saves, recoverable exports and clearer task transitions are.

## Persona outcomes

| Persona | Scenario and successful evidence | Main friction |
|---|---|---|
| Novice primary tutor, 1366 x 768 | Created group, student, timetable, subject, unit, task and planned session through the UI; saved lateness and grade 8, which appeared as 8.00 in the gradebook | First planning attempt requires leaving to create a task; icon-only first actions; autosave/discard confusion |
| Experienced secondary/FP teacher, 1440 x 1000 | Three fictional 25-student groups seeded; actual class save, marks 7 and 9, verified mean 8.00 and attendance 96%; imported another group with two students through CSV | Backup verification fails with a grading configuration; misleading report risk; missing exported group identity |
| Itinerant substitute/tutor, 390 x 844 and tablet | Saved plan, attendance and grade 8; verified tutorial note in Tutoring; added resource; downloaded report and encrypted backup | Reminder blocks class-save hit target; Units and Attendance overflow; some controls are too small |

Each agent covered all 27 surfaces independently, rather than dividing modules. Coverage is not proof that every function or sub-tab was executed. Public pages were read; representative actions were exercised in workspace modules, with inspected-only, disabled and unverified outcomes recorded in each report.

Canonical inventory: landing; Today, Agenda, Classroom, Search; Planner, Units, Tasks; Evaluation, Gradebook, Periods; Attendance, Tutoring, Reports; Groups, Students, Subjects, Schedule; Preferences, Student Import, AI, Database; Legal overview, Legal notice, Privacy, Local storage, Terms.

The novice browser harness failed during a download attempt; remaining work used a second explicitly seeded context. Its successful backup verification contained no grading configuration and does not contradict the experienced persona's failed verification. The mobile persona downloaded a backup but did not restore it. No complete original-record restore round trip is claimed.

## Design health: 21 / 40

This is a qualitative heuristic judgment, not a measured success rate. The independent first-use design assessment scored 26/40; the synthesis lowers control, prevention and recovery after the other agents and parent confirmed data-related failures. All ten heuristics apply.

| Heuristic | Score / 4 | Main evidence |
|---|---:|---|
| Visibility of system status | 3 | Saved counts and results are clear; downloaded backup status does not establish recoverability |
| Match with real world | 3 | Classroom vocabulary fits; inconsistent Grupo/Curso/Diario and technical import terms remain |
| User control and freedom | 2 | Good cancellations, but tutorial drafts can vanish on ordinary navigation |
| Consistency and standards | 2 | Mixed explicit save/autosave; two follow-up editors preserve different fields |
| Error prevention | 1 | Cross-editor metadata loss and unsupported risk inference undermine safeguards |
| Recognition rather than recall | 2 | Labeled workflow navigation; first-use icon and task-prerequisite memory burden |
| Flexibility and efficiency | 3 | Default-present attendance, group assignment, CSV, search and reusable comments |
| Aesthetic and minimalist design | 2 | Coherent identity; crowded setup and broken containment on narrow screens |
| Error recovery | 1 | Valid grading configurations fail backup verification; unsaved tutorial work lacks recovery |
| Help and documentation | 2 | Useful storage/AI guidance, but first-lesson and generic CSV assistance are incomplete |
| **Total** | **21 / 40** | **Significant improvements required; recovery must be fixed before relying on sole-copy storage** |

## Five priority issues

### P0 — A valid grading configuration blocks backup verification and recovery

Export an encrypted backup with a task configured for direct grades; upload it to Check backup and decrypt. Verification reports an incompatible rubric rather than confirming the file. The exported file exists, but the current validation path rejects it. This does not demonstrate corruption or loss of its encrypted contents: keep existing backups.

Independent parent check: the same minimal valid payload passes without `taskGradebookConfigs`; adding one valid direct-grade configuration fails. `ManagementDatabasePage.tsx:939` checks an optional rubric's class without first checking that the rubric exists; line 942 does the same for checklist. The selected methods are mutually exclusive.

Fix: validate ownership only for present instruments, then test export/encrypt/decrypt/validate/restore for direct grade, rubric and checklist. Distinguish downloaded from successfully verified backups. Suggested command: `$impeccable harden`.

Evidence: `artifacts/persona-review/power/final-backup.png`, `artifacts/persona-review/backup-validator-check.mjs`.

### P1 — Follow-up editing and navigation can lose teacher work

Create a follow-up in Tutoring with a responsible person and due date. Edit its notes in Students > Tutorial follow-up and return to Tutoring: responsible person becomes `Sin asignar`, due date `Sin fecha`. The persisted row also loses priority, status and audit timestamps. `ManagementStudentsPage.tsx:263` replaces the row with the simplified editor's fields.

A separate ordinary-navigation test entered a new tutorial title and notes, clicked Today, then returned. No native or application warning appeared; both fields were empty. The guard at `ManagementStudentsPage.tsx:52` watches student details, not the follow-up draft.

Fix: one shared follow-up model, patch only edited fields, reconcile resolved/status, and protect or persist all editable subforms. Suggested command: `$impeccable harden`.

Evidence: `artifacts/persona-review/cross-flow-findings.md`, `cross-flow.mjs`, `cross-flow-tutor.png`.

### P1 — Mobile containment is broken in ordinary teaching screens

Units reaches 607px document width on a 390px phone. Attendance history reaches 1259px with the saved twelve-student roster at a 768px tablet viewport and 384px reflow viewport. These are document-wide overflows, not merely an intentionally scrollable local table. Classroom also reaches 453px on phone.

Fix: shrinkable grid tracks, one-column mobile unit forms, locally constrained attendance tables or readable record cards. Keep date/student/action together. Suggested command: `$impeccable adapt`.

Evidence: `artifacts/persona-review/mobile/management-units.png`, `768--journal-attendance.png`, `384--journal-attendance.png`; `src/styles.css:4580` retains the unit form's three-column minimum.

### P1 — The dismissible backup notice overlaps the work it is meant to protect

At 390 x 844, the class-save button occupies y715.98–759.98 while the reminder occupies y638.48–786. A hit test at the button center returns the reminder; dismissing the notice permits normal save. The novice also hit the reminder while selecting a grading instrument on a laptop.

Fix: preserve the requested dismissible notification design, but coordinate its position with sticky save controls, avoid modal/control overlap and reduce or defer the reminder while editing. Do not revert to an obstructing permanent bar. Suggested command: `$impeccable layout`.

Evidence: `artifacts/persona-review/mobile/reminder-overlap-viewport.png`, `confirm.json`, `novice/16-task-overlay-block.png`; `src/styles.css:2282` defines the fixed notification layer.

### P1 — Reports need evidence-aware warnings and document identity

After correcting two students out of 25, the report labels the other 23 `Riesgo Alto` because their task is ungraded, even with full attendance. This conflates unfinished teacher marking with student difficulty. The printable group report also omits the actual group and school year, making detached exports ambiguous.

Fix: distinguish not yet graded, explicitly not submitted and overdue work; show insufficient-evidence states and reasons for warnings. Include group, school year, scope and generation date in the report and filename. Suggested command: `$impeccable clarify`.

Evidence: `artifacts/persona-review/power/report.html`, `final-reports.png`; `ReportsPage.tsx:162` and `:1359`.

## What to preserve

1. Present-by-default attendance and clear exceptions, with one class-save operation.
2. Cross-screen reuse of the planned task and its grade: both independent graded examples reached the expected results.
3. Reports organized by teacher intent, explicit local ownership and separation of local export from optional AI.

## Practical improvements after the blockers

- Complete onboarding with the first usable lesson, not just academic structure. In an empty planner, offer Create task for this session while retaining its group/time.
- Label first-use actions visibly: Add student, Add subject, Direct grade, Rubric and Checklist. Accessible names alone do not help a sighted novice identify an unfamiliar icon.
- Standardize Saving / Saved / Could not save feedback. Flush valid pending autosaves before navigating; do not leave a stale discard-only dialog after a successful autosave.
- Offer a minimal downloadable CSV template. Column mapping for other spreadsheets is a possible later expansion, not necessary to retain the existing XADE workflow.
- Bring Gradebook's measured 33px tabs and small timetable targets to the existing 44px touch target standard.
- Make exported calendar events retain the scheduled time: the inspected ICS represents timed classes as all-day events.
- Reduce all-student selection effort in Tutoring through class filtering/search; investigate bulk grade entry before adding more feature categories.
- Add recoverable local drafts for interrupted mobile use. The automated Today reload did not instrument a native beforeunload warning, so it is not evidence that the existing guard fails.

## Cognitive and emotional journey

The independent novice assessment found four of eight cognitive-load checks failing at first-use peaks: competing guide/reminder/editor focus, premature fields before task selection, too many simultaneous decisions and remembering the planner slot while creating a task elsewhere. The navigation itself remains understandable once learned; this is not a reason to redesign the entire product.

The useful peak is seeing the same class and grade in Today, the gradebook and reports. The low points are the first-planning dead end and a warning physically preventing save. A backup download feels reassuring, but the recovery blocker means that reassurance is currently premature for graded data.

## Deterministic scan and uncertainty

Assessment B ran the Impeccable CLI once against 45 scannable markup files: zero findings, no rule locations or false positives. It missed the workflow, data and runtime-layout problems above. It is not a usability or security certificate.

External overlay injection was blocked by the app's `script-src 'self'` CSP. The security policy was not bypassed. Independent browser screenshots, DOM geometry, actual actions, exported contents and source checks supplied the evidence instead.

All reviewers used isolated headless Chrome. Mobile measurements are emulation/reflow, not a physical device or native zoom test. Keyboard navigation was sampled; no full screen-reader or contrast certification occurred. No real AI request, email, production mutation or real pupil data was used. Offline service-worker recovery, concurrent editing, every grading method, period closure/promotion and exhaustive sub-tabs remain outside the exercised coverage.

## Source reports and suggested next decision

- `artifacts/persona-review/novice/report.md`: complete novice route matrix and independent scores.
- `artifacts/persona-review/power/report.md`: experienced-teacher route matrix, exports and detector provenance.
- `artifacts/persona-review/mobile/report.md`: phone/tablet matrix, hit tests and measurement limits.
- `artifacts/persona-review/cross-flow-findings.md`: independent parent reproductions.

Recommended order: recovery validation, cross-editor data preservation and draft protection, unobstructed save controls, mobile containment, report semantics, then first-use/efficiency refinements. Before broader interface changes, decide whether phone classroom operation or laptop setup/grading is the next primary optimization target. Validate the revised workflow with real teachers before drawing adoption conclusions.
