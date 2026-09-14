# Read-only Moodle connection

Edunoza can associate existing local work with a Moodle course and bring selected information into its local database. The connector is strictly read-only in Moodle. It does not publish grades, upload files, create courses or activities, change enrolments, or delete remote data.

## Requirements

- A reachable HTTPS Moodle base URL, including its installation path.
- An account with access to the selected courses and a web-service token for an enabled service.
- The Proxy browser extension, with Edunoza authorized and HTTPS POST requests to the Moodle host permitted. POST carries read-only REST queries; it does not imply a write to Moodle.

The school administrator controls which web-service functions and course permissions are available. A normal browser login alone does not establish that REST access is enabled. Edunoza discovers the token's permitted functions and shows unavailable information explicitly. It cannot grant permissions or enable a service on the school's behalf.

The user-designated test URL is `https://centros.edu.xunta.gal/iesmontevila/aulavirtual/`. Its public page was reachable during implementation; authenticated access still requires a token supplied through Edunoza.

## Workflow

The Moodle screen has two URL-addressable subsections: **Configuración** (`/config/moodle?section=config`) for authentication, saved connections and token management, and **Conexión entre datos** (`/config/moodle?section=data`) for scopes, associations, reviewed updates, grades and operation history. Switching subsections (including browser Back/Forward) does not unmount the integration or discard the active session, selections or mapping previews. The data subsection explains how to connect when there is no active session. Leaving Moodle still disconnects the live client.

1. Open **Configuración > Moodle**, enter the base URL and choose manual token or username/password authentication. There is no preselected school. The base URL, service shortname and access mode are remembered. Existing saved connection records remain available; the latest server is recovered when migrating an existing installation without a remembered URL.
2. Select a Moodle course and, if relevant, a Moodle subgroup. Choose the matching existing Edunoza group and subject, or explicitly create a local scope.
3. Associate Moodle participants and activities with existing local students and tasks. Choose creation only for genuinely new records. Leave unrelated participants or activities ignored.
4. Review and apply the association preview. Linking records preserves their local IDs and academic content.
5. Review basic information updates separately. Each proposed field can retain Edunoza's value or accept Moodle's value. Concurrent local edits invalidate an older preview.
6. Review submission status, activity links, deadlines and available numerical assignment grades. Importing a compatible grade is a local operation with an explicit 0–10 conversion. Unsupported grade representations are not silently converted.
7. Refresh when new Moodle information is needed. There is no background synchronization.

## Reassignment and preservation

Associations are stored separately from students, tasks and grades. Changing or removing a link leaves the old academic record intact. Names are labels, not identities; matching two similar names never constitutes authorization to merge pupils. A remote deletion or loss of permission does not delete a local student or task.

The connector only updates reviewed basic names/titles and supported direct task grades. It does not overwrite tutorial notes, family contacts, attendance, private comments, attachments or other evaluation methods. Moodle deadlines are displayed as deadlines and are not automatically converted into scheduled lesson sessions.

## Disconnect, reconnect and forget

**Disconnect** cancels local processing of outstanding requests and discards the live client. The saved token, academic records and associations remain. Leaving the Moodle settings screen also ends the live connection. Use **Borrar token guardado** to delete the device token and disconnect without removing academic data or associations.

**Reconnect** loads the last saved token for the normalized server when its account ID matches the selected connection. Otherwise enter another token or request one with username/password. Associations are recovered only for the same normalized server and authenticated account. A newer login to the same server replaces its saved token, but does not delete other accounts' associations.

**Forget** removes the selected connection's saved metadata, associations, operation summaries and its saved token if present. It does not remove students, tasks, grades, or any other academic data. Future connections require making the associations again.

## Storage and transport

The Proxy extension can read the Moodle access token and the data returned by Moodle. Requests go through the extension to the selected Moodle, not through an Edunoza application server. The token is carried in the POST body rather than URLs. At the user's explicit request, a successfully validated token is kept in localStorage for reuse, outside academic backups, operation summaries and analytics. This is not encrypted credential storage: another person or script with access to this browser profile can use it. Deleting it locally does not revoke it in Moodle. Storage failures are reported and leave the connection session-only. Login usernames and passwords are not persisted; Moodle's display name and numeric account ID remain connection metadata.

Username/password authentication uses an HTTPS POST to the installation's `login/token.php`, carrying `username`, `password` and the service shortname in the encoded body. Proxy can read these credentials. Edunoza clears the password field on submission and cancellation and does not persist it. The default service is `moodle_mobile_app`; an administrator can supply another enabled shortname. Service availability, token-generation permissions, SSO and MFA policies may prevent this flow; manual tokens remain available. The returned `privatetoken` is discarded. There are no automatic login retries or redirects accepted as successful responses.

Authentication can generate/reuse a server-side token and log the login attempt; disconnecting does not revoke it on Moodle. The read-only guarantee applies to academic operations, not Moodle's own authentication bookkeeping. The token's server-side permissions depend on its service; Edunoza still invokes only its read-only academic allowlist. Prefer a restricted service where available. See the [official token endpoint source](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/login/token.php).

Non-secret connection metadata and associations are included in encrypted Edunoza backups. Older backups remain importable without Moodle metadata. Restoring a backup does not restore an authenticated Moodle session.

## Function families

The adapter uses an explicit read-only allowlist. Site identity and accessible courses come from `core_webservice_get_site_info` and `core_enrol_get_users_courses`. Course information comes from enrolled-user, group and course-content functions. Assignment metadata, grades and submissions use `mod_assign_get_*` functions where permitted. Optional grading-definition metadata may be used to distinguish representations. No `save`, `update`, `create`, `delete`, or upload operation is exposed by the adapter.

## Guided connection and returning updates

Configuration now progresses through HTTPS address, access method and connected-account confirmation. The data subsection has four steps: course/destination, associations, metadata changes and grades. Only the active step is visible; navigating backwards preserves mapping drafts but does not apply them.

For subsequent updates, load a course and choose **Buscar cambios**. Edunoza fetches a fresh snapshot, recovers the valid current or uniquely saved destination and prepares metadata review directly. Multiple saved destinations require choosing the intended scope. New remote records remain pending associations. The shortcut never imports automatically: each metadata or grade decision is explicit, and skipping metadata changes is available before reviewing grades.

Refreshing, changing scope or applying associations invalidates older previews. Applying metadata also invalidates grade previews so that incoming grades are reviewed against fresh local state. A failed refresh leaves no old snapshot actionable.

See [the guided workflow plan](moodle-guided-workflow-plan.md). This refinement was published to `https://edunoza.com` on 2026-09-13. Production verification confirmed 68 byte-identical build files, the configured security headers, and 14 routes—including Moodle password login and Proxy settings—without uncaught JavaScript errors. No live Moodle login was attempted.

## Verification scope

Automated tests use synthetic Moodle protocol responses and isolated browser databases. They cover association preservation, stale plans, disconnect/reconnect, account separation, read-only transport and backup validation. A public-page HTTP check is not an authenticated integration test. A live test must use the authorized Moodle token in the app and confirm the capabilities reported by that server.

See [the implementation plan](moodle-integration-plan.md) for ownership and acceptance criteria.

## Deployment verification — 2026-09-13

Published the dedicated Proxy tab, optional username/password token acquisition, device token persistence and institution-neutral connection preferences. Thirty focused unit tests and twenty browser tests passed, including cancellation, token deletion, non-persistence of login credentials and recovery of previously saved Moodle connections. TypeScript, scoped lint and production build passed. Production verification confirmed 68 byte-identical build files, security headers and 14 routes without uncaught JavaScript errors, including initially empty Moodle/Nextcloud server fields in a fresh browser. No live school login was attempted.
