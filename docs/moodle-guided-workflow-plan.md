# Moodle guided workflow implementation plan

## Objective and constraints

Help an individual teacher connect a Moodle account, associate existing Edunoza work and periodically review incoming changes without confronting every control at once. This is an Operate-mode refinement of the existing navy configuration workspace, not a visual rebrand.

Preserve the two existing subsections, read-only academic transport, user-authorized token persistence, no login-credential persistence, empty institution defaults, explicit local review, stale-preview protection, cancellation and backup compatibility. Do not deploy or test real school credentials as part of implementation.

## Interaction plan

1. Configuration: guide an unconnected teacher through server address, access method and account verification. Existing stored tokens offer a short reconnect path; advanced service help is disclosed on demand. A connected-account summary leads to the data workflow. Keep token deletion, forget and Proxy help available without dominating the main action.
2. Data step 1 — Course and destination: choose/load a Moodle course and local class/subject. Show remote-to-local context and recover valid saved scopes. Multiple saved scopes require explicit selection. Invalid or changed scopes reset downstream progress.
3. Data step 2 — Associations: separate participant and activity review, expose counts of linked/unlinked items, preserve mapping drafts on Back, show a confirmation preview and apply only explicit decisions. Never infer identity or merge records from names. Returning users can keep saved associations and continue without remapping.
4. Data step 3 — Changes: fetch or reuse an explicitly refreshed snapshot, review metadata differences and conflicts, keep local values by default. After applying metadata, prepare grades from fresh local state; do not reuse a now-stale grade preview.
5. Data step 4 — Grades and result: display scale conversions and explicit per-row decisions, allow skipping, and finish with a truthful result. Skipping is not applying, and zero supported grades is not proof every Moodle grade is synchronized. Keep submission details and recent operations secondary.
6. Returning-user shortcut: an explicit Search for changes action reads Moodle again, reuses the chosen valid scope and associations, and goes to metadata review. New unlinked remote records remain visible as pending associations rather than being silently imported. No polling or automatic remote writes.

## Engineering boundaries

- A reusable accessible numbered stepper uses native buttons, active-step semantics, reachable-step guards and responsive wrapping. It must not depend on color alone.
- Keep the client and database services as integrity authorities. Frontend progress is not authorization to bypass review.
- Each asynchronous result must belong to the current connection/scope/request. A failed refresh must not enable applying an older snapshot as fresh.
- Changing subsections preserves in-session state. Leaving Moodle disposes the client. Back/Next must not write local records.
- Actions and acknowledgements describe what really happened. Show errors with a next safe action and avoid large help blocks in the primary path.

## Ownership

- /root/terra_moodle_review (Terra, high): MoodleSettingsPage orchestration and scoped page CSS, after independently reviewing the data integrity contract.
- Terra component agent (medium): reusable Moodle workflow stepper and stepper CSS.
- Terra component agent: a follow-up independent review of step progression and safety guards.
- Root: plan, integration, browser regression updates, final verification and documentation.

## Acceptance tests

- First use with manual token and password-based token acquisition; reconnect with saved token; cancel; expired/unavailable service.
- First association without altering existing private data; participant/activity choices survive step navigation.
- Returning update reuses saved mappings, shows actual changes, applies metadata before obtaining a fresh grade preview, and does not create duplicates.
- New remote records, missing permissions, conflicting edits, scope changes, missing groups and no-change results.
- Disconnect/unmount prevents late results, token deletion preserves academics, account changes stay isolated.
- Keyboard-accessible steps and controls, visible active/completed/blocked states, no horizontal overflow at 390 and 1440 pixels.
- Focused tests, lint, TypeScript and production build. One batched mobile/desktop visual inspection, one correction round if necessary.

## Status

Implemented with two Terra agents and integrated by the root agent. The user confirmed the quick returning-update path with explicit review. Applying mappings or metadata invalidates other preview types without changing database-service contracts. The visual review caught a global display rule overriding hidden workflow sections; a scoped CSS fix and browser assertions now ensure only the active step is shown.

Validation: 370 unit tests and two audit-script tests passed; full lint, TypeScript, dependency audit and production build passed. Focused browser coverage checks authentication, reconnect, cancellation, existing-data preservation, subsection continuity, quick review and failed refresh. Mobile (390px) and desktop (1440px) layouts were inspected. The build retains the existing large fontkit chunk warning. Tests use synthetic data; no real school login was attempted.

## Production release — 2026-09-13

The validated production build was published to `https://edunoza.com`. Post-deployment verification confirmed 68 byte-identical build files, the configured security headers, and 14 production routes—including Moodle password login and Proxy settings—without uncaught JavaScript errors. The live Moodle server and credentials were not exercised.
