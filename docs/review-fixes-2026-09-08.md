# September 2026 reliability and privacy fixes

- Management group validation waits for metadata readiness. Explicit student and classroom links initialize context once; subsequent manual choices take precedence.
- Subject selection waits for the matching group's subject query, preserving context across page mounts.
- Evaluation and gradebook context changes stop when pending values cannot be saved. Evaluation also protects navigation and page unload; unfinished folder names block context changes.
- Protected AI reports exclude free-text notes, follow-ups, activity titles and comments, and replace subject names. Student names use generated labels. This is data minimization, not a guarantee of anonymity: academic values and support indicators remain sensitive.
- AI requests require a review of the actual data snapshot before transmission. Cancellation performs no request. API keys remembered on a device are still browser storage, not encrypted by the local application lock. The settings explain this limitation.
- Dependency audits fail on transport errors, timeouts, missing metadata and malformed reports instead of reporting a false clean result.
- The prepared deployment configuration uses the domain-specific `edunoza-security` Traefik middleware. It applies CSP, HSTS, framing and MIME protections, no-referrer, permissions restrictions, COOP and CORP. Other domains keep their existing middleware. The deployment configuration lives in the server management workspace's `static-sites/traefik-dynamic/static-sites.yml`.
- Compatible dependency updates were applied, including React Router 7.18.3. TypeScript 7 and Vitest 5 remain separate major migrations; this patch retains the existing compiler and test runner major versions.

## Verification

Run `npm run verify` for lint, types, unit tests, audit regression tests, build and the live dependency audit. Run `npm run test:e2e` for isolated Chrome browser regressions covering group continuity, editable deep links, rejected saves and AI preview/transmission. Install Chrome first (`npx playwright install chrome` on a clean CI worker). Test data is confined to fresh browser contexts on localhost; AI responses are intercepted.

The application lock remains a screen lock; it does not encrypt IndexedDB. Backups use authenticated encryption. Encrypting the live database would require a separate storage and recovery migration.

## Deployment status

Local validation passed: 261 unit tests, 2 audit tests, 3 browser tests, lint, type checking, build and dependency audit. Publication stopped during the pre-deployment backup because the `/opt/docker` volume is full (147 GB, zero available space). The public site still serves the previous build and headers. Server cleanup or additional capacity requires owner approval before retrying deployment; no existing backups or user data were deleted.
