/**
 * Bundle-time stand-in for "@tasued/ui" (wired via the alias in vite.config.ts).
 * It re-exports the whole kit EXCEPT VideoPlayer so its streaming library (~400 KB) isn't pulled into
 * the startup chunk by the package barrel. VideoPlayer is imported from ./video-player
 * only by the unit page. Types still come from the real package.
 */
export * from "../../../../packages/ui/src/components/primitives";
export * from "../../../../packages/ui/src/components/overlays";
export * from "../../../../packages/ui/src/components/Brand";
export * from "../../../../packages/ui/src/components/ErrorRecovery";
export * from "../../../../packages/ui/src/hooks/useCountdown";
export * from "../../../../packages/ui/src/hooks/useMediaQuery";
export { cn } from "../../../../packages/ui/src/lib/cn";

export { DataRefresh, refreshDefaults } from "../../../../packages/ui/src/data-refresh";
export { RequestErrorPage } from "../../../../packages/ui/src/components/RequestErrorPage";

export { SessionDiagnostic } from "../../../../packages/ui/src/components/SessionDiagnostic";

export { createAccountRecheck } from "../../../../packages/ui/src/recheck-account";
