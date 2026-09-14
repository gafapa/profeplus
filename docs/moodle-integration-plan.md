# Moodle integration implementation plan

## Product outcome

Teachers can connect Moodle after already using Edunoza, explicitly associate existing records, review inbound updates and grades, and disconnect without losing academic work. Moodle access is strictly read-only, as explicitly requested by the user during implementation. Connections never imply a bulk replacement of local data. This is an on-demand integration; it has no background polling or remote writes.

## Architecture and ownership

- Root: shared contracts, integration review, cross-layer tests, documentation and privacy copy.
- Sol / high effort: read-only REST transport, protocol validation, capability discovery, course/roster/activity/grade/submission reads and a strict read-function allowlist.
- Sol / high effort: additive Dexie migration, connection and binding repository, preview/apply engine, optimistic concurrency, grade plans, backup compatibility and data preservation tests.
- Sol / medium effort: configuration page, connection lifecycle, scope and mapping controls, conflict review, inbound grade review, responsive and accessible states.

## Milestone 1: local identity and lifecycle

1. Add connections, bindings and operation summaries through an additive database version. Existing academic IDs remain unchanged.
2. Identify a connection by normalized HTTPS Moodle base URL and authenticated Moodle user ID. Different accounts/sites must not reuse links silently.
3. Updated at the user's explicit request: persist the validated access token in device-local credential storage, scoped by normalized server with an account-ID check. Never persist the login username or password. Tokens stay excluded from academic backups, logs, URLs and analytics. Leaving the screen or disconnecting ends the live session but retains the token. Forgetting the account or deleting the saved token removes it locally, without remote revocation.
4. Disconnect cancels in-flight local processing and clears credentials, preserving mappings and academic records. Forget additionally removes that connection's integration metadata, never academic records.
5. Include non-secret metadata in encrypted backups with strict validation. Older backups restore with empty integration metadata; stale links are reported, never used to overwrite unrelated records.

## Milestone 2: Moodle adapter

1. Use the existing Proxy extension protocol with POST form bodies to the Moodle REST endpoint. Reject invalid URLs, unexpected redirects, invalid JSON, Moodle exceptions and incomplete/warning-bearing results for mutation planning.
2. Discover account identity and available functions using core_webservice_get_site_info. Gate optional features by actual functions rather than Moodle version guesses.
3. Read accessible courses, groups/members, enrolled users, course contents and assignments. Distinguish course-module IDs from assignment instance IDs.
4. Read assignment grades and submissions where permitted. Preserve due dates and activity links as remote metadata; do not invent lesson sessions from a deadline.
5. Allow only named read-only Moodle functions. Do not implement grade publication, file upload, course/activity creation or any other remote mutation. POST is only the REST transport format for reads, keeping the token out of URLs.

## Milestone 3: explicit associations

1. Select a Moodle course and optionally a Moodle group, then choose an existing Edunoza group and subject or create them explicitly.
2. For each participant/activity choose an existing compatible local record, create a new record, ignore it, or remove its association.
3. Match suggestions are optional and never auto-applied. Names are not identities. Prevent incompatible scopes and duplicate associations.
4. Saving or changing an association by itself preserves local names, notes, grades, enrolments and IDs. Review content updates as a separate operation.
5. Removed/inaccessible remote items produce a missing-link state. They do not delete local records.

## Milestone 4: preview and apply

1. Compare explicitly linked fields against stored local/remote baselines. Show source, destination, old/new values and conflicts.
2. Let the teacher accept Moodle's value or preserve Edunoza's value. Keeping both source versions means leaving the field unsynchronized; do not fabricate merged text or duplicate identities automatically.
3. Apply local changes atomically after checking that the connection, mappings and relevant local values still match the preview. Refuse stale previews.
4. Synchronize only basic identity/title fields explicitly reviewed. No local academic data is sent to Moodle. Tutorial notes, family contacts, attendance, private comments, photos and resources remain untouched.
5. Imported numerical assignment grades use an explicit scale conversion to Edunoza's 0–10 direct task grade and require compatible local grading configuration. Preserve all unrelated assessments and grading methods.

## Milestone 5: interface

1. Add Configuración > Moodle using existing compact forms and visual conventions.
2. Provide connection status, installation help, course/scope selection, mapping review, update review, grades/submissions and recent operation summaries.
3. Use labelled native selects, 44px targets, keyboard-accessible controls, loading/error/empty states, and no password field outside a form.
4. Refresh after every mutation. Changing scope or connection invalidates pending previews. Disconnect remains available during remote requests and prevents their later results from applying locally.

## Milestone 6: verification and handoff

- Unit tests: URL/token protection, real REST envelopes, capabilities, warnings, pagination, ID namespaces, grade limits and rejection of mutating Moodle functions.
- Data tests: linking existing records retains IDs/private data, repeat operations do not duplicate, remapping preserves prior records, stale plans/rollback, missing remote records, disconnect/reconnect/account isolation, forget and backup round trips.
- Browser tests using synthetic Moodle responses: full connect-link-preview-apply-grade-disconnect-reconnect lifecycle and mobile/desktop usability. Never send real pupil records during development.
- Run lint, typecheck, relevant/full unit suite, production build and dependency audit; run focused browser regressions for integration and backups.
- Report unsupported Moodle capabilities explicitly. No claim of live Moodle compatibility until a real authorized server/token is supplied through the app and exercised. Do not publish or contact a real Moodle as part of this local implementation.

## Capability boundaries

The integrated workflow covers existing Moodle courses and activities, inbound basic metadata/assignment grades and submission status. All changes happen locally in Edunoza. Remote publication of grades/files, Moodle activity creation, quiz grade overrides, LTI, and background two-way synchronization are outside the user's read-only scope. Moodle activity links and deadlines remain available without forcing them into Edunoza's lesson schedule.

## Sources

- https://moodledev.io/docs/5.0/apis/subsystems/external
- https://moodledev.io/docs/5.0/apis/subsystems/external/files
- https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/mod/assign/externallib.php

## User-designated test server

Base URL: https://centros.edu.xunta.gal/iesmontevila/aulavirtual/

Public access returned HTTP 200 with the title `Inicio | AV` and Moodle markup. Authentication and read-only web-service permissions have not been verified. The token must be entered in Edunoza; development uses synthetic protocol responses, not pupil records from this server. No remote write operations are supported or needed.

## Acceptance status

Implemented locally using three Sol agents: transport and data integrity at high reasoning effort, and interface integration at medium effort. The adapter exposes only read operations. Existing-record association, reassignment, reviewed local updates, numerical assignment grade imports, disconnect, reconnect and forget are implemented.

The focused browser suite passed 18 tests covering Moodle's local data lifecycle, mobile/desktop UI and Nextcloud backup regressions. Desktop and mobile screenshots were reviewed for wrapping, control placement and overflow. `npm run verify` passed lint, TypeScript, 355 unit tests, two audit-script tests, the production build and the dependency audit (no known vulnerabilities). The build retains a size warning for an existing fontkit chunk, not the lazy-loaded Moodle feature.

An additional real-Dexie browser safety test passed: cancellation during connection persistence, repeated creation without duplicates, cross-scope duplicate-creation rejection, full backup restoration of Moodle metadata, and stale association pruning with an operation report. Total focused browser coverage: 19 passing tests.

Published to https://edunoza.com on 2026-09-13. Production verification confirmed 68 byte-identical build files, the configured security headers, and 14 routes including Moodle password login and Proxy settings without uncaught JavaScript errors. Live authenticated Moodle verification remains pending. Creating a local scope in the Moodle screen currently creates both a new group and a new subject; to add a subject to an existing group, use Organization first. Advanced grading, group submissions and unsupported numeric scales are deliberately excluded from grade import.
