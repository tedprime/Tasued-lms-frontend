import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, RichContent } from "@tasued/ui";
import { savedCourses, removeCourse, type SavedCourse } from "./offline-store";
export default function OfflinePage() {
  const [courses, setCourses] = useState<SavedCourse[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const load = () => {
      const current = ++generation;
      void savedCourses()
        .then((v) => {
          if (active && current === generation) setCourses(v);
        })
        .catch(() => {
          if (active)
            setError("Offline storage is unavailable in this browser.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    load();
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("lms-account")
        : null;
    if (channel)
      channel.onmessage = () => {
        setCourses([]);
        load();
      };
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      channel?.close();
      clearInterval(timer);
    };
  }, []);
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-5 sm:p-8">
      <Link className="text-primary-500 underline" to="/">
        Back to the portal
      </Link>
      <h1 className="text-2xl font-bold">Saved course text</h1>
      <p>
        Read your downloaded course text without internet. Saved copies expire
        after 30 days and are removed when you sign out or change accounts. Only
        save on a device you trust.
      </p>
      <p className="text-sm">
        Videos, attachments, quizzes and progress tracking require a connection.
        Reconnect and save again to get updated material.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>Loading saved courses…</p>
      ) : (
        !courses.length && (
          <p>
            No courses saved. Open a course while online and choose “Save course
            text offline”.
          </p>
        )
      )}
      {courses.map((c) => (
        <section
          key={c.id}
          className="rounded-xl border border-neutral-200 bg-white p-5"
        >
          <h2 className="text-xl font-bold">
            {c.code} — {c.title}
          </h2>
          <p className="my-2 text-sm">
            Saved {new Date(c.savedAt).toLocaleDateString()} · Available until{" "}
            {new Date(c.expiresAt).toLocaleDateString()}
          </p>
          <Button
            onClick={() =>
              void removeCourse(c.id)
                .then(() =>
                  setCourses((items) => items.filter((i) => i.id !== c.id)),
                )
                .catch(() => setError("Could not remove the saved course."))
            }
          >
            Remove download
          </Button>
          {c.units.map((u) => (
            <details
              key={u.id}
              className="mt-4 border-t border-neutral-200 pt-4"
            >
              <summary className="cursor-pointer font-semibold">
                {u.moduleTitle}: {u.title}
              </summary>
              {u.objectives.length > 0 && (
                <ul className="my-3 list-disc pl-5">
                  {u.objectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              )}
              <RichContent html={u.text} />
            </details>
          ))}
        </section>
      ))}
    </main>
  );
}
