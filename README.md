# TASUED LMS — frontend

Teams-first learning management system for TASUED. Live classes run on Microsoft Teams; each class recording stays in the organiser's OneDrive and is streamed into the LMS under the units the class covered (nothing is copied). Students sign in to the LMS with email + password and join Teams classes as guests of our organisation. Students can open any course, any time.

This repository holds the two web apps and their shared packages. The NestJS API (`apps/api`) and worker (`apps/worker`) are added in the backend build.

| Path | What it is |
|---|---|
| `apps/student` | Student app — dashboard, courses, unit page (recording first, course text underneath), classes, assignments (single final submission), quizzes, grades, attendance, forum, announcements, notifications, settings. Installable PWA with offline course text. Port 5173. |
| `apps/admin` | Admin portal with role-based access — academic structure, courses, offerings, content editor, Teams class scheduling with unit coverage, recordings pipeline, attendance, assignments & grading, quizzes & question banks, gradebook, forum moderation, announcements, people & CSV import (creates Microsoft 365 accounts), roles, reports, audit log, integration health, settings. Port 5174. |
| `packages/api-client` | The API contract: types, every REST endpoint (`api.*`), formatting helpers. |
| `packages/ui` | TASUED brand tokens (`src/styles/tokens.css`, from `docs/brand/`), the crest, components carried over from SLAN, and the video player (streams OneDrive links, renews them when they expire). |
| `packages/editor` | Rich text editor ported from SLAN admin (Lexical). Image uploads go through the LMS API. |
| `packages/mocks` | Mock API (MSW) with seeded TASUED data, so both apps run without a backend. |
| `docs/FRONTEND_SPEC.md` | Product decisions and conventions. |
| `docs/brand/` | TASUED brand colour document and original crest. Colours are working values — verify against approved logo artwork, then update `tokens.css` only. |

## Run it

Requires Node 20+.

```bash
npm install
npm run dev:student    # http://localhost:5173
npm run dev:admin      # http://localhost:5174
```

In development the mock API is on (`VITE_USE_MOCKS=true` in each app's `.env.development`).

- **Student app:** sign in with `adaeze.okonkwo@student.tasued.edu.ng`, `tunde.bakare@student.tasued.edu.ng` or `chiamaka.eze@student.tasued.edu.ng`, password `Tasued2026!` (Chiamaka is asked to change her password first), or click a demo account. Try the invitation flow at `/set-password?token=demo-invite-token`. Password-reset links are printed in the browser console.
- **Admin portal:** click a demo account — Dr. Kehinde Ogundipe (super admin — management only), Dr. Adebayo Ogunleye (AIIE 111 lecturer), Mr. Emeka Nwosu (AIIE 111 teaching assistant). Staff sign in with Microsoft in production.

Demo data is stored in the browser and reseeds each day so dates stay current. To reset it now, run `__tasuedMockReset()` in the browser console.

## Connect the real API

Set in `apps/<app>/.env.local`:

```
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://<api-host>/api/v1
```

Students sign in with email + password; staff are redirected to the API's Microsoft Entra ID flow. Either way the API sets an httpOnly session cookie (no tokens in JavaScript or URLs).

## Checks

```bash
npm run typecheck
npm run smoke -w @tasued/mocks   # exercises every mock endpoint
npm run build
```

The same checks run on GitHub Actions (`.github/workflows/ci.yml`).
