import type { ReactNode } from "react";
import { CalendarClock, PlayCircle, BookOpenText, ShieldCheck } from "lucide-react";
import { Logo, Crest } from "@tasued/ui";

/** Brand panel modelled on SLAN's AuthLeftPanel, re-themed for TASUED. */
export function BrandPanel() {
  const points = [
    { icon: CalendarClock, text: "Join your live classes on Microsoft Teams" },
    { icon: PlayCircle, text: "Re-watch every class recording, unit by unit" },
    { icon: BookOpenText, text: "Read course text, submit work and take quizzes" },
  ];
  return (
    <div className="relative hidden flex-col justify-center overflow-hidden bg-[linear-gradient(135deg,#192f59_0%,#0f1d36_60%,#091222_100%)] p-14 text-white select-none lg:flex lg:w-1/2">
      <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen" aria-hidden>
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[60%] rounded-full bg-primary-300 blur-[100px]" />
        <div className="absolute right-[-5%] bottom-[-5%] h-[50%] w-[50%] rounded-full bg-secondary-400 blur-[120px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-md">
        <span className="inline-flex rounded-2xl bg-white p-3 shadow-pop"><Crest size={96} /></span>
        <p className="mt-5 text-xs font-semibold tracking-wide text-secondary-300 uppercase">Tai Solarin University of Education</p>
        <h1 className="mt-3 font-headline text-4xl leading-tight font-bold tracking-tight">Learning that follows your classes.</h1>
        <p className="mt-4 text-sm leading-relaxed text-primary-100">
          TASUED LMS brings your Teams classes, recordings, course text, assignments, quizzes and course forums into one place — on any device.
        </p>
        <ul className="mt-10 space-y-4">
          {points.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-secondary-300"><p.icon className="size-4.5" /></span>
              {p.text}
            </li>
          ))}
        </ul>
      </div>
      <ShieldCheck className="pointer-events-none absolute right-12 bottom-6 size-32 text-secondary-500 opacity-10" aria-hidden />
    </div>
  );
}

/** Public auth pages: brand panel on large screens, a single centred column on phones. */
export function AuthLayout({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <BrandPanel />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <Logo subtitle="Tai Solarin University of Education" />
          <h1 className="mt-10 font-headline text-[28px] font-extrabold tracking-tight text-tertiary-500">{title}</h1>
          {description && <div className="mt-1.5 text-sm text-neutral-500">{description}</div>}
          {children}
        </div>
      </main>
    </div>
  );
}

/** Only allow same-app relative paths as a return target (never back into the auth pages). */
export function safeReturnTo(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (/^\/(sign-in|set-password|forgot-password|reset-password|change-password)\b/.test(raw)) return "/";
  return raw;
}
