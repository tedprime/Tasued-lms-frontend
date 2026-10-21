import { Crest, DeveloperCredit } from "./Brand";

const messages: Record<string, { title: string; message: string }> = {
  sign_in_required: { title: "Please sign in again", message: "Your session has ended or could not be found. Sign in, then open the file or page again." },
  access_denied: { title: "You don't have access", message: "This account cannot open this resource. Contact your lecturer or LMS administrator if you believe you should have access." },
  not_found: { title: "This resource isn't available", message: "The file or page may have been removed. Return to the portal to find the latest version." },
  rate_limited: { title: "Please wait a moment", message: "There have been too many requests. Wait a minute before trying again from the portal." },
  unavailable: { title: "We couldn't open this resource", message: "The request could not be completed. Return to the portal and try again. If this continues, contact LMS support." },
};

/** Public recovery screen: it must also work when a session has expired. */
export function RequestErrorPage() {
  const code = new URLSearchParams(window.location.search).get("error") || "unavailable";
  const { title, message } = Object.hasOwn(messages, code) ? messages[code] : messages.unavailable;
  return <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
    <section className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 shadow-card">
      <div className="mb-6 flex items-center gap-3"><Crest size={44} /><span className="font-bold">TASFUED LMS</span></div>
      <div role="alert"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 text-neutral-600">{message}</p></div>
      <div className="mt-6 flex flex-wrap gap-4">
        <a href={code === "sign_in_required" ? "/sign-in" : "/"} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white">{code === "sign_in_required" ? "Sign in" : "Return to portal"}</a>
      </div>
      <DeveloperCredit className="mt-8 border-t border-neutral-100 pt-5" />
    </section>
  </main>;
}
