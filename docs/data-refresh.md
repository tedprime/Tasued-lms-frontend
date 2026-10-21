# Data refresh

Student and staff (admin, lecturer and teaching assistant) use the existing TanStack Query caches and API client. The shared header provides Refresh without changing the route, filters, pagination or component state. It disables during fetches and reports manual refresh success/failure.

Successful writes emit feature-family invalidations. Active affected queries refetch after a 250 ms batch window; inactive queries become stale without being downloaded. Existing feature mutation callbacks are retained and a completed callback refetch is not repeated. Failed writes and reads do not emit invalidations. Each portal keeps its own authenticated cache and normal backend authorization applies; no user data is broadcast between portals.

Active queries poll every 60 seconds while visible, unless a feature specifies its own interval. Navigation refetches, and focus/reconnect refresh stale data. This is bounded polling, not real-time push: other users normally see changes on their next foreground poll or navigation. Existing faster attendance, recording and invitation checks remain. Hidden tabs do not poll.

In-progress quiz attempts, video playback URLs and playback positions are protected from generic refresh. Completed quiz results can refresh. Answer, assignment-draft, reading-progress and video-position autosaves retain their existing local reconciliation using server responses; completion/submission writes invalidate dependent views. Settings drafts no longer remount when server data changes. Transient background errors retain cached page content; authorization and not-found errors still replace it.

Integration Health is temporarily hidden through `apps/admin/src/app/features.ts`. Set `INTEGRATION_HEALTH_ENABLED` to true to restore its sidebar, dashboard links, permission display and page. The disabled route redirects to the dashboard. Backend implementation and stored data are untouched.

Validation: `npx tsx --test test/data-refresh.test.ts`, `npm run typecheck`, `npm run build`. Production multi-user/browser verification still requires deployed services and authenticated accounts. Check a write in one session and the affected list/report in another after a minute, filter preservation during Refresh, unsaved settings, active quiz answers, and student offline course text.
