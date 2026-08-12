# Competitive Capability Review

Reviewed on 2026-08-12 against the current public product documentation for:

- [Additio for Teachers](https://additioapp.com/en/teachers/)
- [Additio features](https://additioapp.com/en/features/)
- [iDoceo](https://www.idoceo.net/index.php/en/)
- [iDoceo seating plans](https://idoceo.net/index.php/en/instructions/seating-plan/the-seating-plan-main-features)
- [Google Classroom](https://edu.google.com/workspace-for-education/products/classroom/)
- [Google Classroom editions](https://edu.google.com/intl/en_in/workspace-for-education/products/classroom/editions/)

## Product Position

ProfePlus is a private, offline-first teacher workspace. Its closest comparison is the individual-teacher workflow in iDoceo or Additio Teachers, not a cloud LMS or school information system. Google Classroom is useful as a reference for assignment, feedback, and analytics workflows, but its account, guardian, collaboration, and submission features require a server-side identity and sharing model that ProfePlus intentionally does not have.

## Capability Matrix

| Capability | ProfePlus | Market pattern | Decision |
| --- | --- | --- | --- |
| Attendance and daily class record | Strong | Core in Additio, iDoceo, and TeacherKit-style tools | Maintain |
| Weekly planning and lesson details | Strong | Core in Additio and iDoceo | Maintain |
| Gradebook, periods, rubrics, checklists | Strong | Core in all reviewed products | Maintain |
| Academic-period closure history | Differentiator | Often handled by school systems | Maintain immutable snapshots |
| Tutor follow-up and family contacts | Strong local workflow | Additio includes tutoring and family notifications | Maintain local records; avoid outbound messaging without consent architecture |
| Action agenda and calendar export | Implemented | Automated reminders and to-do views are common | Maintain; consider optional device notifications later |
| Student and task resource attachments | Implemented | Additio and iDoceo attach files and links broadly | Maintain strict local limits and encrypted-backup validation |
| Seating plan, random selection, and grouping | Implemented | Prominent in Additio and iDoceo | Maintain as the primary classroom-tool gap closure |
| Reusable feedback comment bank | Implemented | Google Classroom and iDoceo emphasize reusable feedback | Maintain teacher-controlled insertion and editing |
| Competency mastery analytics | Partial | Additio emphasizes weighted competency progress | High-priority future enhancement after competency identifiers replace free text |
| Global search | Implemented | iDoceo exposes cross-record search | Maintain cross-workflow deep links and local-only indexing |
| LMS/SIS synchronization | Missing | Common in cloud products | Defer until an explicit integration and consent model exists |
| Student submissions and guardian portal | Missing | Central to Google Classroom and school editions of Additio | Out of current offline-first scope |
| Multi-teacher real-time collaboration | Missing | Common in school platforms | Out of current architecture; requires backend, accounts, roles, audit logs, and retention controls |
| Originality checking | Missing | Google Classroom offers repository and web comparison | Do not reproduce locally; only consider a privacy-reviewed external integration |

## Completed Priorities

1. Action agenda with contextual navigation and standards-based ICS export.
2. Local student evidence and task resources with encrypted-backup inclusion.
3. Persistent classroom layout with keyboard-accessible reassignment, random seating, non-repeating student selection, balanced groups, and same-day absence exclusion.
4. Reusable, categorized feedback bank with explicit insertion into Today observations and manual gradebook comments.
5. Accent-insensitive global search across academic records, with type filtering and context-preserving navigation.

## Next Product Decisions

The next local-only product increment should formalize competencies as stable records and link assessments, tasks, and rubric criteria to them. That data model must precede mastery dashboards; aggregating arbitrary free-text labels would create misleading results.

Cloud communication, student work submission, SIS synchronization, and collaborative editing must not be added as incidental features. Each requires a deliberate backend architecture, authentication and authorization, encryption in transit and at rest, auditability, retention and deletion rules, institutional ownership, and explicit handling of minors' data.
