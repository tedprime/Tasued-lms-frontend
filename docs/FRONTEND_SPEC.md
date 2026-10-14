# TASUED LMS — frontend build spec

Teams-first LMS. Live classes run on Microsoft Teams in our own Microsoft 365 organisation. Each class recording stays in the organiser's OneDrive; the LMS links it to the unit(s) the class covered and streams it from OneDrive through short-lived links — nothing is copied or transcoded. The LMS is secondary to Teams: students can open any course, any time.

## Product decisions (do not change)
- **Assignments are single, strictly final submissions.** A student may save drafts, but once they press *Submit final* (with an explicit confirmation step) the submission can never be edited, replaced, withdrawn or reopened — not by the student, lecturer or admin. The API returns 409 `SUBMISSION_FINAL` on any later write. UI must make this very clear before submission and show a receipt code after.
- **Quizzes are separate from assignments.** Timed, randomly drawn from question banks, server-authoritative deadline, autosave per answer, auto-submit at deadline. (SLAN's "assessment" engine is a quiz engine — port it for quizzes.)
- **Course text (manual reading) is kept.** On a unit page: **recording(s) first, course text underneath.** If a unit has no recording, course text comes first.
- **No certificates.** No payments. No "tracks" (SLAN concept). The hierarchy is just **Course → Module → Unit**. There are no faculties/colleges, departments, academic sessions, semesters or offerings. A course holds its lecturers, TAs, enrolled students, Teams class code prefix and draft/published/archived status. For now the only course is AIIE 111; admins can add more with "New course".
- **Students** are supplied by TASUED (name, email, matric number). We invite each one twice: an LMS invitation to set a **platform password** (they sign in to the LMS with email + password), and a Microsoft Teams **guest** invitation to our organisation so they can join classes. No self sign-up. Forgot/reset password and forced change after an admin reset are supported.
- **Staff** (lecturers, TAs, admins) are members of our Microsoft 365 organisation and sign in with **Microsoft** (Entra ID).
- Either way the session is an httpOnly cookie set by the API; JS never sees tokens and tokens are never put in URLs.
- Transcripts/captions are not part of the product.
- Recording fallback is **lecturer upload** only; uploaded files are stored in the organiser's OneDrive and streamed the same way. Videos play at the quality Teams recorded them (no 360p option).
- Role-based admin portal with three staff roles:
  - `super_admin` — **management only**: courses (create, edit, assign staff, publish/archive, enrol students), people and invitations, roles, platform-wide announcements, reports, audit log, integration health and settings. Sees every course **read-only** (content, students, report) and does not edit content, schedule classes, mark attendance, set or grade assessments, moderate the forum or send course announcements.
  - `lecturer` and `teaching_assistant` — the **teaching** tools, only on the courses they are assigned to (`Session.teachingCourseIds`): content, classes, recordings, attendance, assignments, quizzes, gradebook, the course forum and course announcements, plus their course report.
  - A person can hold both (e.g. a super admin who also lectures a course) and then sees both.
  The UI hides what the session's `permissions` and `teachingCourseIds` don't allow; the API enforces it (teaching permissions on a course require being its lecturer/TA). Students keep `department` and `level` only as plain profile details from TASUED's list.

## Repo layout
```
apps/student      React 19 + Vite + TS + Tailwind 4 (port 5173)
apps/admin        same stack (port 5174)
packages/api-client  API contract: types.ts, endpoints.ts (`api.*`), client.ts, utils.ts (formatting, can())
packages/ui          SLAN design tokens + shared components (Button, Card, Badge, Field/Input/Select/Textarea,
                     Modal, ConfirmDialog, Drawer, Toast, Tabs, SegmentedControl, Menu, Table, Pagination,
                     EmptyState/ErrorState/PageLoader/Skeleton, Progress/ProgressRing, Avatar, PageHeader,
                     StatCard, KeyValue, RichContent, Logo, VideoPlayer (OneDrive MP4 with link refresh; HLS also supported), useDeadlineCountdown, useIsMobile)
packages/editor      RichTextEditor (Lexical, ported from SLAN admin). Props: value(html), onChange(html),
                     uploadImage?(file)=>Promise<url>, variant "full" | "simple", placeholder, minHeight
packages/mocks       MSW mock API + seeded TASUED data; `startMocks({ app })`
```

## Conventions
- Routing: `react-router-dom` v7 data router (`createBrowserRouter`), real URLs for every course, unit, recording, assignment, quiz and thread.
- Data: TanStack Query v5. Call `api.<area>.<fn>()` from `@tasued/api-client` (e.g. `api.content.unit(id)`). Query keys: `["area", ...args]`. Invalidate on mutation. Show toasts on success/failure (`useToast`). Use `errorMessage(e)` for messages.
- Every list/page handles loading (Skeleton/PageLoader), empty (EmptyState) and error (ErrorState with retry).
- Styling: Tailwind 4 utilities with TASUED tokens (see `docs/brand/`): `primary-*` (TASUED blue #192F59 — actions, navigation, links), `secondary-*` (TASUED gold #BF7C09 — sparing accents, dark text on gold), `tertiary-*` (TASUED black #171717 — text), `success` (institutional green #2F7D46 — completion and progress only), `neutral-*`, `danger`, `warning`, `info`; fonts `font-headline` (Manrope) and body Inter. Layout = SLAN dashboard structure: #F7F8FA page, white cards with light borders, white sidebar. Never hard-code hex values in components.
- Mobile first: everything must work at 360px wide (students mostly use phones). Sidebar becomes a drawer below 768px.
- Accessibility: labelled controls, focus states, keyboard reachable, aria for dialogs/tabs, colour is never the only signal.
- Dates shown in Africa/Lagos time using `fmtDate`, `fmtDateTime`, `fmtTime`, `fromNow` from `@tasued/api-client`.
- `import.meta.env.VITE_API_BASE_URL` is the API base; in mock mode it is `/api/v1`.
- Don't modify files under `packages/` (shared contract) — if something is missing, work around it locally and list it in your report. Exception: the mocks agent owns `packages/mocks`.
- TypeScript strict, no `any` unless unavoidable. `npm run typecheck -w @tasued/<app>` and `npm run build -w @tasued/<app>` must pass.

## Demo / mock mode
`VITE_USE_MOCKS=true` (default in `.env.development`). Student sign-in is an email + password form (`api.auth.passwordLogin`); admin sign-in is "Sign in with Microsoft" (`window.location.href = api.auth.microsoftLoginUrl(base, returnTo)`). In mock mode only, both pages also list "Demo accounts" from `api.auth.devAccounts()`; clicking one calls `api.auth.devLogin(id)`. Session from `api.auth.session()` (401 → signed out).
