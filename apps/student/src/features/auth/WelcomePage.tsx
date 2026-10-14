import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, CheckCircle2, Mail, MonitorPlay } from "lucide-react";
import { Card, Logo, buttonClasses } from "@tasued/ui";
import { TeamsInviteBadge } from "../../components/bits";
import { useSession } from "../../app/session";

/** First-time onboarding after setting a password. */
export default function WelcomePage() {
  const { user } = useSession();
  const firstName = user.fullName.split(/\s+/)[0];
  const teams = user.teamsGuest?.status;

  const steps = [
    {
      icon: CheckCircle2,
      title: "You're in TASUED LMS",
      body: <>Sign in here any time with <span className="font-semibold break-all text-tertiary-500">{user.email}</span> and the password you just set. Your courses, recordings, course text, assignments and quizzes are all here.</>,
    },
    {
      icon: Mail,
      title: "Join your classes on Teams",
      body: (
        <>
          <p>
            Check your email for the <span className="font-semibold text-tertiary-500">Microsoft Teams invitation from our organisation</span> and accept it.
            When you join a class, sign in to Teams with this same email — the first time, Microsoft will ask you to create a Microsoft account password for it.
          </p>
          {teams && (
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500">Your Teams invitation:</span>
              <TeamsInviteBadge status={teams} />
            </p>
          )}
        </>
      ),
    },
    {
      icon: CalendarClock,
      title: "Join classes from the Classes page",
      body: <>Use the <span className="font-semibold text-tertiary-500">Join on Teams</span> button on the Classes page so your attendance is recorded. Missed a class? The recording appears on the unit page afterwards.</>,
    },
  ];

  return (
    <div className="min-h-dvh bg-neutral-50 px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        <Logo compact />
        <Card className="mt-6 overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#091222_0%,#142647_55%,#192f59_100%)] px-5 py-7 text-white sm:px-7">
            <MonitorPlay className="size-7 text-secondary-400" aria-hidden />
            <h1 className="mt-3 font-headline text-2xl font-extrabold tracking-tight">Welcome, {firstName}!</h1>
            <p className="mt-1 text-sm text-white/75">Three things to know before your first class.</p>
          </div>
          <ol className="divide-y divide-neutral-100">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 px-5 py-5 sm:px-7">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 font-headline text-sm font-extrabold text-primary-600" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0 text-sm text-neutral-600">
                  <h2 className="flex items-center gap-2 font-headline text-base font-bold text-tertiary-500">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h2>
                  <div className="mt-1 leading-relaxed">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Link to="/classes" className={buttonClasses("outline", "md")}>See my classes</Link>
            <Link to="/" className={buttonClasses("primary", "md")}>Go to my dashboard <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
