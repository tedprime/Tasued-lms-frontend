/**
 * Node smoke test: runs the real MSW handlers under msw/node and walks the main student and staff flows.
 *   npx tsx scripts/smoke.ts
 */
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};

const { setupServer } = await import("msw/node");
const { createHandlers, resetDb } = await import("../src/index");
const { getDb } = await import("../src/db/store");
const { tick } = await import("../src/db/tick");

const BASE = "http://localhost/api/v1";
let passed = 0;
let failed = 0;

function check(cond: unknown, label: string, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`, extra ?? "");
  }
}

async function call<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T; res: Response }> {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const ct = res.headers.get("content-type") ?? "";
  const data = res.status === 204 ? null : ct.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data: data as T, res };
}

resetDb();
const db = getDb();
const { classStatus } = await import("../src/db/ops/classes");
const handout = (await import("../src/db/seed/aiie111-content.json")).default as { course: { title: string; description: string }; modules: { number: number; title: string; intro: string; units: { code: string; title: string; objective: string; html: string; words: number }[] }[] };
const lagos = (iso: string) => new Date(new Date(iso).getTime() + 3600e3);

console.log(`Seeded: ${db.users.length} users, ${db.courses.length} courses, ${db.units.length} units, ${db.classes.length} classes, ${db.recordings.length} recordings, ${db.questions.length} questions, ${db.threads.length} threads, ${db.audit.length} audit entries; ~${Math.round(JSON.stringify(db).length / 1024)} KB`);

/* ───────────── seed: AIIE 111 only ───────────── */
console.log("\nSeed");
check(db.courses.length === 1 && db.courses[0]!.code === "AIIE 111" && db.courses[0]!.id === "crs-aiie111" && db.courses[0]!.status === "published" && db.courses[0]!.classCodePrefix === "AIIE111", "one published course: AIIE 111 (crs-aiie111)");
check(!("offerings" in db) && !("faculties" in db) && !("departments" in db) && !("semesters" in db) && !("sessions" in db), "no academic structure in the DB");
check(db.users.every((u) => !("departmentId" in u) && u.roles.every((x) => ["global", "course"].includes(x.scopeType) && ["super_admin", "lecturer", "teaching_assistant", "student"].includes(x.role))), "roles: 4 keys, scopes global/course; no departmentId");
check(db.users.find((u) => u.id === "stu-adaeze")?.department === "Computer Science", "student department is plain text");
check(!db.users.some((u) => u.id === "stf-facadmin" || u.id === "stf-deptadmin"), "faculty/department admin accounts removed");
check(db.courses[0]!.description === handout.course.description && db.courses[0]!.description.startsWith("Artificial intelligence has moved"), "course description = handout “About this course”");
check(db.modules.length === 15 && db.units.length === 73 && db.units.every((u) => u.state === "published" && u.courseTextHtml.length > 200), `${db.modules.length} modules, ${db.units.length} published units with course text`);
check(db.modules.every((m) => m.title === `Module ${m.order}: ${handout.modules[m.order - 1]!.title}` && m.summary === handout.modules[m.order - 1]!.intro), "module titles “Module N: …”, summary = module introduction");
{
  const hu = handout.modules.flatMap((m) => m.units);
  const ok = hu.every((h) => {
    const u = db.units.find((x) => x.id === `unt-aiie111-${h.code.replace(".", "-")}`);
    return !!u && u.title === `${h.code} ${h.title}` && u.objectives[0] === h.objective && u.courseTextHtml === h.html && u.estimatedReadMinutes === Math.ceil(h.words / 200);
  });
  check(ok, "units: “m.u Title”, objective, handout HTML, read minutes = ceil(words/200)");
}
check(new Set(db.enrolments.map((e) => e.userId)).size === db.users.filter((u) => u.id.startsWith("stu-")).length && db.enrolments.some((e) => e.userId === "stu-ifeoluwa"), `all ${db.enrolments.length} students enrolled (incl. invited Ifeoluwa)`);
{
  const cls = [...db.classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const slotOk = cls.every((c) => { const d = lagos(c.startsAt); return [1, 3, 5].includes(d.getUTCDay()) && [10, 14].includes(d.getUTCHours()) && new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime() === 2 * 3600e3; });
  check(cls.length === 78 && slotOk, `${cls.length} classes, Mon/Wed/Fri 10:00 & 14:00 Lagos, 2 h each`);
  const order = db.units.map((u) => u.id);
  const idx = cls.map((c) => c.unitIds.map((id) => order.indexOf(id)));
  const walk = idx.every((ix, i) => ix.length >= 1 && ix.length <= 2 && (ix.length === 1 || ix[1] === ix[0]! + 1) && (i === 0 || ix[0]! >= idx[i - 1]![idx[i - 1]!.length - 1]!));
  check(walk && new Set(idx.flat()).size === 73, "classes walk the 73 units in order, 1–2 consecutive units each, all covered");
  check(cls.every((c) => /^Week (\d|1[0-3]) · \d+\.\d+ /.test(c.title)), `class titles, e.g. “${cls[8]!.title}”`);
  const ended = cls.filter((c) => classStatus(c, Date.now()) === "ended");
  const recs = db.recordings;
  check(recs.length === ended.length && recs.filter((r) => r.status === "pending").length === 1 && recs.filter((r) => r.status === "failed").length === 1 && recs.find((r) => r.status === "pending")!.classSessionId === ended[ended.length - 1]!.id, `${recs.length} recordings for ${ended.length} ended classes (1 pending = latest, 1 failed)`);
  const sheetStates = db.sheets.map((x) => x.status);
  check(sheetStates.filter((x) => x === "in_review").length === 1 && sheetStates.filter((x) => x === "pending_import").length === 1 && sheetStates.filter((x) => x === "finalised").length === ended.length - 2, "attendance: finalised + 1 in review + 1 pending import");
}
check(db.assignments.length === 3 && db.quizzes.length === 3 && db.banks.length === 5 && db.questions.length >= 40, `${db.assignments.length} assignments, ${db.quizzes.length} quizzes, ${db.banks.length} banks / ${db.questions.length} questions`);
check(db.categories.map((c) => c.name).sort().join(",") === "AIIE 111,General" && db.threads.length >= 15 && db.threads.some((t) => t.isPinned && t.courseId) && db.reports.some((r) => r.status === "open"), `forum: ${db.threads.length} threads in AIIE 111 + General`);
check([...db.announcements, ...db.threads].every((x) => !x.courseId || x.courseId === "crs-aiie111") && db.announcements.every((a) => a.courseId === "crs-aiie111"), "announcements/threads only for AIIE 111");
{
  const studentLink = /^\/(courses\/crs-aiie111(\/(units\/unt-aiie111-\d+-\d+|classes|announcements))?|quizzes\/quiz-aiie-\d|assignments\/asg-aiie-[a-z-]+|forum\/thr-\d\d|announcements)$/;
  const staffLink = /^\/(courses\/crs-aiie111\/[a-z]+|forum\/threads\/thr-\d\d)$/;
  const bad = db.notifications.filter((n) => !(n.userId.startsWith("stu-") ? studentLink : staffLink).test(n.link));
  check(!bad.length, `notification links valid (${db.notifications.length})`, bad.map((n) => n.link));
  const ids = new Set([...db.units.map((u) => u.id), ...db.threads.map((t) => t.id), ...db.quizzes.map((q) => q.id), ...db.assignments.map((a) => a.id)]);
  const dangling = db.notifications.map((n) => n.link.split("/").pop()!).filter((x) => /^(unt|thr|quiz|asg)-/.test(x) && !ids.has(x));
  check(!dangling.length, "notification links point at existing items", dangling);
}

/* ───────────── student app ───────────── */
console.log("\nStudent app");
let server = setupServer(...createHandlers({ app: "student", latency: false }));
server.listen({ onUnhandledRequest: "error" });

let r = await call("GET", "/auth/session");
check(r.status === 401 && r.data.code === "UNAUTHENTICATED", "session → 401 when signed out");
r = await call("GET", "/auth/dev-accounts");
check(r.status === 200 && r.data.length === 3, `dev accounts: ${r.data.map((u: any) => u.fullName).join(", ")}`);

// Student password sign-in
const PW = "Tasued2026!";
const lastAudit = () => getDb().audit[0]!;
r = await call("POST", "/auth/login", { email: "Adaeze.Okonkwo@student.tasued.edu.ng", password: PW });
check(r.status === 200 && r.data.user.id === "stu-adaeze" && r.data.mustChangePassword === false && r.data.user.authMethod === "password", "password login (good) → session");
check(r.data.user.lmsInvite?.status === "accepted" && r.data.user.teamsGuest?.status === "accepted" && !("m365Provisioned" in r.data.user), "user has lmsInvite/teamsGuest, no m365Provisioned");
check(!JSON.stringify(r.data).includes("sha256"), "no password hash leaked");
r = await call("POST", "/auth/login", { email: "adaeze.okonkwo@student.tasued.edu.ng", password: "wrong-password" });
check(r.status === 401 && r.data.code === "INVALID_CREDENTIALS" && r.data.message === "Email or password is incorrect.", "password login (bad password) → 401");
r = await call("POST", "/auth/login", { email: "nobody@example.com", password: PW });
check(r.status === 401 && r.data.code === "INVALID_CREDENTIALS", "password login (unknown email) → 401");
r = await call("POST", "/auth/login", { email: "ifeoluwa.adeyemi@student.tasued.edu.ng", password: PW });
check(r.status === 423 && r.data.code === "ACCOUNT_NOT_ACTIVATED", "password login (invite not accepted) → 423");
r = await call("POST", "/auth/login", { email: "adebayo.ogunleye@tasued.edu.ng", password: PW });
check(r.status === 403 && r.data.code === "USE_MICROSOFT", "staff email in student app → 403 USE_MICROSOFT");

// Invitation: info + accept
r = await call("GET", "/auth/invites/demo-invite-token");
check(r.status === 200 && r.data.fullName === "Ifeoluwa Adeyemi" && new Date(r.data.expiresAt).getTime() > Date.now() + 6 * 864e5, `invite info: ${r.data.email}`);
r = await call("GET", "/auth/invites/expired-invite-token");
check(r.status === 410 && r.data.code === "INVITE_EXPIRED", "expired invite → 410");
r = await call("GET", "/auth/invites/not-a-token");
check(r.status === 404, "unknown invite → 404");
r = await call("POST", "/auth/invites/accept", { token: "demo-invite-token", password: "short" });
check(r.status === 422 && r.data.code === "WEAK_PASSWORD" && r.data.message === "Use at least 8 characters.", "accept with weak password → 422 WEAK_PASSWORD");
r = await call("POST", "/auth/invites/accept", { token: "demo-invite-token", password: "Ifeoluwa#2026" });
check(r.status === 200 && r.data.user.id === "stu-ifeoluwa" && r.data.user.lmsInvite.status === "accepted" && r.data.user.status === "active", "accept invite → signed in, lmsInvite accepted");
r = await call("GET", "/auth/session");
check(r.status === 200 && r.data.user.id === "stu-ifeoluwa", "session after accept");
r = await call("GET", "/auth/invites/demo-invite-token");
check(r.status === 410, "used invite → 410");
r = await call("POST", "/auth/login", { email: "ifeoluwa.adeyemi@student.tasued.edu.ng", password: "Ifeoluwa#2026" });
check(r.status === 200, "login with the new password");

// Forced change (admin reset) → change password
r = await call("POST", "/auth/login", { email: "chiamaka.eze@student.tasued.edu.ng", password: PW });
check(r.status === 200 && r.data.mustChangePassword === true, "Chiamaka → mustChangePassword true");
r = await call("POST", "/auth/password/change", { currentPassword: "nope", newPassword: "Chiamaka!2026" });
check(r.status === 400 && r.data.code === "WRONG_PASSWORD", "change with wrong current → 400 WRONG_PASSWORD");
r = await call("POST", "/auth/password/change", { currentPassword: PW, newPassword: "1234" });
check(r.status === 422 && r.data.code === "WEAK_PASSWORD", "change to weak → 422");
r = await call("POST", "/auth/password/change", { currentPassword: PW, newPassword: "Chiamaka!2026" });
check(r.status === 200 && r.data.mustChangePassword === false, "change password → mustChangePassword false");
r = await call("GET", "/auth/session");
check(r.data.mustChangePassword === false, "session keeps mustChangePassword false");
r = await call("POST", "/auth/login", { email: "chiamaka.eze@student.tasued.edu.ng", password: PW });
check(r.status === 401, "old password no longer works");

// Forgot / reset
const infoLogs: string[] = [];
const origInfo = console.info;
console.info = (...a: unknown[]) => void infoLogs.push(a.join(" "));
r = await call("POST", "/auth/password/forgot", { email: "tunde.bakare@student.tasued.edu.ng" });
const r2 = await call("POST", "/auth/password/forgot", { email: "nobody@example.com" });
console.info = origInfo;
check(r.status === 204 && r2.status === 204, "forgot → 204 (known and unknown email)");
const resetToken = infoLogs.join("\n").match(/\/reset-password\?token=([\w-]+)/)?.[1];
check(!!resetToken && infoLogs.length === 1, `reset link logged once: /reset-password?token=${resetToken?.slice(0, 8)}…`);
r = await call("POST", "/auth/password/reset", { token: resetToken, password: "x" });
check(r.status === 422 && r.data.code === "WEAK_PASSWORD", "reset with weak password → 422");
r = await call("POST", "/auth/password/reset", { token: resetToken, password: "Tunde-New-2026" });
check(r.status === 204, "reset → 204");
r = await call("POST", "/auth/password/reset", { token: resetToken, password: "Tunde-New-2026" });
check(r.status === 410, "reused reset token → 410");
r = await call("POST", "/auth/login", { email: "tunde.bakare@student.tasued.edu.ng", password: "Tunde-New-2026" });
check(r.status === 200 && r.data.user.id === "stu-tunde", "login with reset password");
check(lastAudit().action === "auth.signed_in", "sign-in audited");

r = await call("POST", "/auth/dev-login", { userId: "stu-adaeze" });
check(r.status === 200 && r.data.user.fullName === "Adaeze Okonkwo" && r.data.permissions.length === 0, "dev-login as Adaeze");
r = await call("GET", "/auth/session");
check(r.status === 200 && r.data.user.id === "stu-adaeze", "session returns student");

r = await call("GET", "/me/dashboard");
check(r.status === 200, "dashboard 200");
check(r.data.upcomingClasses.length > 0, `upcoming classes: ${r.data.upcomingClasses.length} (first ${r.data.upcomingClasses[0]?.classCode} ${r.data.upcomingClasses[0]?.status})`);
{
  const liveNow = getDb().classes.some((c) => classStatus(c, Date.now()) === "live");
  check(liveNow ? r.data.upcomingClasses.some((c: any) => c.status === "live") : r.data.upcomingClasses[0]?.status === "scheduled", liveNow ? "a class is live now (in a Mon/Wed/Fri slot)" : `no class in session; next: ${r.data.upcomingClasses[0]?.title}`);
}
check(r.data.openQuizzes.some((q: any) => q.id === "quiz-aiie-2"), "AIIE Quiz 2 open");
check(r.data.dueSoon.length > 0 && r.data.latestRecordings.length > 0, `dueSoon=${r.data.dueSoon.length}, recordings=${r.data.latestRecordings.length}, attendance=${r.data.attendancePercent}%`);

r = await call("GET", "/courses");
check(r.status === 200 && r.data.total === 1 && r.data.items[0].code === "AIIE 111" && r.data.items[0].id === "crs-aiie111", `my courses: ${r.data.items.map((o: any) => o.code).join(", ")}`);
r = await call("GET", "/courses/catalogue?pageSize=50");
check(r.status === 200 && r.data.total === 1 && r.data.items.every((o: any) => o.status === "published"), `catalogue (all published): ${r.data.total}`);
r = await call("GET", "/courses/catalogue?search=artificial");
check(r.data.total === 1, "catalogue search");
r = await call("GET", "/courses/crs-csc111");
check(r.status === 404, "unknown course → 404");
for (const p of ["/faculties", "/departments", "/academic-sessions", "/semesters", "/offerings", "/offerings/off-aiie111"]) {
  r = await call("GET", p);
  check(r.status === 404, `${p} → 404 (removed)`);
}
r = await call("GET", "/courses/crs-aiie111");
check(r.status === 200 && r.data.moduleCount === 15 && r.data.unitCount === 73 && r.data.description.startsWith("Artificial intelligence has moved") && r.data.lecturers.length === 1 && r.data.lecturers[0].id === "stf-ogunleye" && r.data.assistants.length === 1 && r.data.enrolledCount > 50 && !("course" in r.data) && !("semesterId" in r.data), `course: ${r.data.moduleCount} modules, ${r.data.unitCount} units, ${r.data.enrolledCount} enrolled`);
r = await call("GET", "/courses/crs-aiie111/progress");
check(r.status === 200 && Array.isArray(r.data), `course progress: ${r.data.length} units`);
r = await call("POST", "/courses", { code: "XYZ 101", title: "x", description: "", classCodePrefix: "XYZ101", lecturerIds: [], assistantIds: [] });
check(r.status === 403, "student → create course 403");

r = await call("GET", "/courses/crs-aiie111/modules");
const units = r.data.flatMap((m: any) => m.units);
check(r.data.length === 15 && units.length === 73, `AIIE modules=${r.data.length}, published units=${units.length}`);
check(r.data[0].title === "Module 1: Introduction to AI" && units[0].title === "1.1 What Is Artificial Intelligence?", `first unit: ${units[0].title}`);
r = await call("GET", `/units/${units[0].id}`);
const words = r.data.courseTextHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
check(r.status === 200 && r.data.recordings.length > 0 && words >= 400, `unit 1: ${r.data.recordings.length} recording(s), ${words} words, ${r.data.attachments.length} attachment(s)`);
check(r.data.courseTextHtml.includes("<table>") && r.data.courseTextHtml.includes("<h3>Defining AI</h3>") && r.data.objectives[0].startsWith("Define AI in everyday"), "unit 1.1: headings, table, objective");
r = await call("GET", "/units/unt-aiie111-1-3");
check(r.status === 200 && r.data.courseTextHtml.includes("<table>") && r.data.courseTextHtml.includes("<blockquote>"), "unit 1.3: myths table + key idea box");
r = await call("GET", "/units/unt-aiie111-15-4");
check(r.status === 200 && (r.data.courseTextHtml.match(/<li>/g) ?? []).length >= 10 && r.data.courseTextHtml.includes("Answer key"), "unit 15.4: practice questions + answer key");
r = await call("GET", "/units/unt-aiie111-16-1");
check(r.status === 404 && r.data.code === "NOT_FOUND", "unknown unit → 404");
r = await call("PUT", `/units/${units[40].id}/progress`, { readPercent: 40 });
check(r.status === 200 && r.data.readPercent === 40 && !r.data.completed, "save progress");

// Assignment: draft → upload → final → 409
r = await call("GET", "/assignments/asg-aiie-prompt-journal/submission");
check(r.data.state === "draft", "existing draft loaded");
r = await call("PUT", "/assignments/asg-aiie-prompt-journal/submission/draft", { textHtml: "<p>Task 1: summarising my GNS notes…</p>" });
check(r.status === 200 && r.data.state === "draft", "save draft");
const fd = new FormData();
fd.append("file", new File([new Uint8Array([37, 80, 68, 70])], "prompt-journal.pdf", { type: "application/pdf" }));
r = await call("POST", "/assignments/asg-aiie-prompt-journal/submission/files", fd);
check(r.status === 200 && r.data.scanStatus === "clean", `upload file → ${r.data.name}`);
const fd2 = new FormData();
fd2.append("file", new File(["x"], "virus.exe"));
r = await call("POST", "/assignments/asg-aiie-prompt-journal/submission/files", fd2);
check(r.status === 422 && r.data.code === "FILE_TYPE_NOT_ALLOWED", "wrong file type → 422");
r = await call("POST", "/assignments/asg-aiie-prompt-journal/submission/final", {});
check(r.status === 422 && r.data.code === "CONFIRMATION_REQUIRED", "final without confirm → 422");
r = await call("POST", "/assignments/asg-aiie-prompt-journal/submission/final", { confirm: true });
check(r.status === 200 && r.data.state === "submitted" && /^TAS-AIIE111-[A-Z0-9]{5}$/.test(r.data.receiptCode), `final submit → receipt ${r.data.receiptCode}`);
const adaezeSubmissionId = r.data.id;
r = await call("POST", "/assignments/asg-aiie-prompt-journal/submission/final", { confirm: true });
check(r.status === 409 && r.data.code === "SUBMISSION_FINAL", "second final → 409 SUBMISSION_FINAL");
r = await call("PUT", "/assignments/asg-aiie-prompt-journal/submission/draft", { textHtml: "<p>edit</p>" });
check(r.status === 409 && r.data.message === "This submission is final and can't be changed.", "draft after final → 409");
r = await call("PUT", "/assignments/asg-aiie-needs-brief/submission/draft", { textHtml: "<p>early</p>" });
check(r.status === 422 && r.data.code === "NOT_OPEN", "upcoming assignment → 422 NOT_OPEN");
r = await call("GET", "/assignments/asg-aiie-myths/submission");
check(r.data.grade?.released === true, `released grade visible: ${r.data.grade?.score}/${r.data.grade?.maxScore}`);
r = await call("GET", "/assignments");
check(r.status === 200 && r.data.length === 3, `assignments: ${r.data.map((a: any) => a.title.split(":")[0]).join(", ")}`);

// Quiz
r = await call("POST", "/quizzes/quiz-aiie-2/attempts");
check(r.status === 200 && r.data.questions.length === 10 && r.data.state === "in_progress", `start quiz: ${r.data.questions.length} questions, deadline ${r.data.deadlineAt}`);
check(!JSON.stringify(r.data).includes("isCorrect") && !JSON.stringify(r.data).includes("acceptedAnswers"), "no answer keys leaked");
const attempt = r.data;
const mins = (new Date(attempt.deadlineAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000;
check(Math.round(mins) === 20, `deadline = 20 min (${mins.toFixed(1)})`);
for (const q of attempt.questions) {
  const body = q.options.length ? { optionIds: [q.options[0].id] } : { text: "hallucination" };
  const a = await call("PUT", `/quiz-attempts/${attempt.id}/answers/${q.questionId}`, body);
  if (a.status !== 204) check(false, "answer save", a.data);
}
check(true, "answers autosaved (204)");
r = await call("POST", "/quizzes/quiz-aiie-2/attempts");
check(r.data.id === attempt.id, "starting again resumes in-progress attempt");
r = await call("POST", `/quiz-attempts/${attempt.id}/submit`);
check(r.status === 200 && r.data.state === "submitted" && typeof r.data.score === "number", `submit quiz → ${r.data.score}/${r.data.maxScore}, pending manual ${r.data.pendingManualMarks}`);
r = await call("PUT", `/quiz-attempts/${attempt.id}/answers/${attempt.questions[0].questionId}`, { optionIds: [] });
check(r.status === 409, "answer after submit → 409");
await call("POST", "/quizzes/quiz-aiie-2/attempts");
r = await call("POST", "/quizzes/quiz-aiie-2/attempts");
check(r.status === 200, "second attempt allowed (2 attempts)");
await call("POST", `/quiz-attempts/${r.data.id}/submit`);
r = await call("POST", "/quizzes/quiz-aiie-2/attempts");
check(r.status === 409 && r.data.code === "ATTEMPTS_EXHAUSTED", "third attempt → 409");
r = await call("GET", "/quizzes/quiz-aiie-1/attempts/mine");
check(r.data[0]?.score !== undefined && r.data[0]?.questions[0]?.result, "closed quiz results visible after close");

r = await call("GET", "/me/grades");
check(r.status === 200 && r.data.length === 1, `my grades: ${r.data.map((g: any) => `${g.courseCode}=${g.runningTotalPercent}`).join(", ")}`);
r = await call("GET", "/me/attendance");
check(r.status === 200 && r.data.some((s: any) => s.totalClasses > 0), `attendance: ${r.data.map((s: any) => `${s.courseCode} ${s.percent}%`).join(", ")}`);
r = await call("GET", "/me/notifications");
check(r.data.some((n: any) => n.kind === "submission_receipt" && !n.read), `notifications: ${r.data.length} (${r.data.filter((n: any) => !n.read).length} unread)`);
r = await call("GET", "/search?q=prompt");
check(r.data.length > 0, `search "prompt": ${r.data.map((h: any) => h.type).join(",")}`);
r = await call("GET", "/forum/threads?courseId=crs-aiie111");
check(r.data.total >= 5 && r.data.items[0].isPinned, `forum threads: ${r.data.total}, pinned first`);
r = await call("POST", "/forum/threads", { categoryId: "cat-aiie111", title: "Does Copilot work offline?", bodyHtml: "<p>Asking for the hostel</p>", unitId: units[6].id });
check(r.status === 200, "create thread");
const tid = r.data.id;
r = await call("POST", `/forum/threads/${tid}/posts`, { bodyHtml: "<p>Bump</p>" });
check(r.status === 200, "reply");
{
  const before = (await call("GET", "/forum/threads/thr-02")).data.thread.viewerHasUpvoted === true;
  r = await call("POST", "/forum/threads/thr-02/upvote");
  check(r.data.viewerHasUpvoted === !before, "upvote toggle");
}
r = await call("GET", "/recordings?courseId=crs-aiie111");
const rec = r.data[0];
check(r.data.every((x: any) => x.status === "ready"), `student sees only ready recordings (${r.data.length})`);
r = await call("PUT", `/recordings/${rec.id}/position`, { positionSeconds: 321 });
r = await call("GET", `/recordings/${rec.id}/position`);
check(r.data.positionSeconds === 321, "playback position saved");
check(rec.oneDrive?.fileName?.endsWith(".mp4") && rec.oneDrive.ownerEmail === "classes@lms.tasued-online.ng" && rec.oneDrive.driveId.startsWith("b!") && !("hlsUrl" in rec), `ready recording has oneDrive ref: ${rec.oneDrive?.fileName}`);
r = await call("GET", `/recordings/${rec.id}/playback`);
const expMin = (new Date(r.data.expiresAt).getTime() - Date.now()) / 60000;
check(r.status === 200 && r.data.mimeType === "video/mp4" && r.data.url.startsWith("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?sig=") && expMin > 9 && expMin <= 10, `playback link (expires in ${expMin.toFixed(1)} min)`);
const firstUrl = r.data.url;
r = await call("GET", `/recordings/${rec.id}/playback`);
check(r.data.url !== firstUrl, "each playback link differs");
{
  const pendingRec = getDb().recordings.find((x) => x.status === "pending")!;
  r = await call("GET", `/recordings/${pendingRec.id}/playback`);
  check(r.status === 409 && r.data.code === "RECORDING_NOT_READY", "playback for pending recording → 409 RECORDING_NOT_READY");
  check(!getDb().recordings.some((x) => (x.status as string) === "processing"), "no processing recordings in seed");
}

// Forbidden staff endpoints
r = await call("GET", "/courses/crs-aiie111/gradebook");
check(r.status === 403 && r.data.code === "FORBIDDEN", "student → gradebook 403");
r = await call("POST", "/classes", { courseId: "crs-aiie111" });
check(r.status === 403, "student → create class 403");
r = await call("GET", "/admin/dashboard");
check(r.status === 403, "student → admin dashboard 403");
await call("POST", "/auth/logout");
r = await call("GET", "/auth/session");
check(r.status === 401, "logout clears session");
server.close();

/* ───────────── admin app ───────────── */
console.log("\nAdmin app");
server = setupServer(...createHandlers({ app: "admin", latency: false }));
server.listen({ onUnhandledRequest: "error" });
r = await call("GET", "/auth/dev-accounts");
check(r.data.length === 3 && r.data.map((u: any) => u.id).join() === "stf-super,stf-ogunleye,stf-nwosu", `staff dev accounts: ${r.data.map((u: any) => `${u.fullName} (${u.roles[0].role})`).join(", ")}`);
r = await call("POST", "/auth/dev-login", { userId: "stu-tunde" });
check(r.status === 403, "student can't sign in to admin app");
r = await call("POST", "/auth/login", { email: "adaeze.okonkwo@student.tasued.edu.ng", password: "Tasued2026!" });
check(r.status === 403 && r.data.code === "USE_MICROSOFT", "admin app /auth/login → 403 USE_MICROSOFT");
r = await call("POST", "/auth/dev-login", { userId: "stf-ogunleye" });
check(r.status === 200 && r.data.permissions.length === 14 && r.data.permissions.includes("classes.schedule") && !r.data.permissions.includes("audit.view") && !r.data.permissions.includes("courses.manage") && !r.data.permissions.includes("people.manage"), `lecturer session: ${r.data.permissions.length} perms, courses ${r.data.staffCourseIds.join(",")}`);
check(r.data.staffCourseIds.join() === "crs-aiie111" && r.data.user.roles.some((x: any) => x.role === "lecturer" && x.scopeType === "course" && x.scopeId === "crs-aiie111" && x.scopeName?.startsWith("AIIE 111")), "lecturer scoped to AIIE 111");
r = await call("GET", "/admin/dashboard");
check(r.status === 200, `admin dashboard: classesThisWeek=${r.data.counts.classesThisWeek}, today=${r.data.todayClasses.length}, toReview=${r.data.attendanceToReview.length}, toGrade=${r.data.submissionsToGrade.length}`);
r = await call("GET", "/courses");
check(r.data.total === 1 && r.data.items[0].id === "crs-aiie111", `lecturer courses in scope: ${r.data.items.map((o: any) => o.code + "/" + o.status).join(", ")}`);
r = await call("POST", "/courses", { code: "LEC 101", title: "Lecturer course", description: "", classCodePrefix: "LEC101", lecturerIds: ["stf-ogunleye"], assistantIds: [] });
check(r.status === 403, "lecturer → POST /courses 403");
r = await call("PATCH", "/courses/crs-aiie111", { title: "Renamed" });
check(r.status === 403, "lecturer → edit course details 403");
r = await call("PATCH", "/courses/crs-aiie111", { status: "published" });
check(r.status === 200 && r.data.status === "published", "lecturer can set own course status");
r = await call("GET", "/users");
check(r.status === 403, "lecturer → people list 403");
r = await call("GET", "/courses/crs-aiie111/modules");
check(r.data.flatMap((m: any) => m.units).length === 73, "staff see all 73 units");

const future = new Date(Date.now() + 2 * 864e5);
future.setUTCHours(9, 0, 0, 0);
r = await call("POST", "/classes/series", { courseId: "crs-aiie111", title: "Revision", firstStartsAt: future.toISOString(), durationMinutes: 120, weekdays: [1, 3], occurrences: 4, unitIds: [units[0].id], lecturerId: "stf-ogunleye", autoRecord: true });
check(r.status === 200 && r.data.length === 4 && r.data[0].teamsJoinUrl.startsWith("https://teams.microsoft.com/l/meetup-join/19%3ameeting_"), `series created: ${r.data.map((c: any) => c.classCode).join(", ")}`);
r = await call("POST", `/classes/${r.data[3].id}/cancel`, { reason: "Public holiday" });
check(r.data.status === "cancelled", "cancel class");
r = await call("POST", "/classes", { courseId: "crs-aiie111", title: "Past", startsAt: new Date(Date.now() - 3600e3).toISOString(), endsAt: new Date().toISOString(), unitIds: [], lecturerId: "stf-ogunleye", autoRecord: true });
check(r.status === 422 && r.data.code === "START_IN_PAST", "class in the past → 422");
r = await call("POST", "/classes", { courseId: "crs-eco101", title: "x", startsAt: future.toISOString(), endsAt: new Date(future.getTime() + 3600e3).toISOString(), unitIds: [], lecturerId: "stf-ogunleye", autoRecord: true });
check(r.status === 404, `unknown course → ${r.status}`);

r = await call("GET", "/classes?courseId=crs-aiie111&status=ended");
const ended = r.data;
const review = ended.find((c: any) => c.attendanceStatus === "in_review");
check(!!review, `in-review class: ${review?.classCode}`);
r = await call("GET", `/classes/${review.id}/attendance`);
check(r.data.status === "in_review" && r.data.unmatched.length === 2, `sheet: ${r.data.records.length} records, unmatched: ${r.data.unmatched.map((u: any) => u.displayName).join(" | ")}`);
const absentee = r.data.records.find((x: any) => x.mark === "absent") ?? r.data.records[0];
r = await call("POST", `/classes/${review.id}/attendance/match`, { displayName: r.data.unmatched[0].displayName, userId: absentee.userId });
check(r.status === 200 && r.data.unmatched.length === 1, "match unmatched participant");
r = await call("POST", `/classes/${review.id}/attendance/import`);
check(r.status === 200 && ["imported", "in_review"].includes(r.data.status), `re-import from Teams → ${r.data.status}`);
r = await call("PUT", `/classes/${review.id}/attendance/${absentee.userId}`, { mark: "excused", note: "Medical" });
check(r.status === 200 && r.data.mark === "excused", "manual mark");
r = await call("POST", `/classes/${review.id}/attendance/finalise`);
check(r.status === 200 && r.data.status === "finalised" && r.data.finalisedBy === "Dr. Adebayo Ogunleye", "finalise");
r = await call("PUT", `/classes/${review.id}/attendance/${absentee.userId}`, { mark: "present" });
check(r.status === 409 && r.data.code === "ATTENDANCE_FINALISED", "mark after finalise → 409");
r = await call("GET", `/classes/${review.id}/attendance.csv`);
check(r.status === 200 && r.res.headers.get("content-disposition")?.includes("attachment") && String(r.data).includes("Matric number"), "attendance CSV download");

r = await call("GET", "/courses/crs-aiie111/gradebook");
check(r.status === 200 && r.data.items.length >= 5, `gradebook: ${r.data.items.length} items × ${r.data.students.length} students`);
const manual = r.data.items.find((i: any) => i.kind === "manual");
r = await call("PUT", "/courses/crs-aiie111/gradebook/cells", { itemId: manual.id, userId: "stu-adaeze", score: 9, reason: "" });
check(r.status === 422 && r.data.code === "REASON_REQUIRED", "setCell without reason → 422");
r = await call("PUT", "/courses/crs-aiie111/gradebook/cells", { itemId: manual.id, userId: "stu-adaeze", score: 9, reason: "Led the group presentation" });
check(r.status === 200 && r.data.score === 9, "setCell with reason");
r = await call("GET", "/courses/crs-aiie111/gradebook/history");
check(r.data[0]?.reason === "Led the group presentation", `grade history: ${r.data.length} entries`);
r = await call("POST", `/courses/crs-aiie111/gradebook/items/${manual.id}/release`, { released: true });
check(r.data.released === true, "release manual item");
r = await call("GET", "/courses/crs-aiie111/gradebook.xlsx");
check(r.status === 200 && r.res.headers.get("content-type")?.startsWith("text/csv"), "gradebook export");

r = await call("GET", "/assignments/asg-aiie-prompt-journal/submissions");
check(r.data.length === getDb().enrolments.length, `submissions roster (${r.data.length}): ${r.data.filter((s: any) => s.state === "submitted").length} submitted`);
r = await call("PUT", `/assignments/asg-aiie-prompt-journal/submissions/${adaezeSubmissionId}/grade`, { score: 18, feedbackHtml: "<p>Excellent journal.</p>" });
check(r.status === 200 && r.data.grade.score === 18, "grade Adaeze's submission");
r = await call("POST", "/assignments/asg-aiie-prompt-journal/release");
check(r.status === 200 && r.data.released >= 1, `release grades: ${r.data.released}`);

r = await call("GET", "/quizzes/quiz-aiie-1/marking-queue");
check(r.data.length >= 1, `marking queue: ${r.data.length}`);
const qa = r.data[0];
const essay = qa.questions.find((q: any) => (q.type === "essay" || q.type === "short_answer") && !q.result);
r = await call("PUT", `/quiz-attempts/${qa.id}/marks/${essay.questionId}`, { awarded: Math.min(3, essay.points) });
check(r.status === 200 && r.data.pendingManualMarks === 0 && r.data.state === "marked", "manual mark → attempt marked");
r = await call("GET", "/question-banks/bank-aiie-part-b/questions");
check(r.data.some((q: any) => q.options.some((o: any) => o.isCorrect)), `staff questions include answer keys (${r.data.length})`);

const up = new FormData();
up.append("courseId", "crs-aiie111");
up.append("title", "Make-up recording: Week 3");
up.append("unitIds", units[2].id);
up.append("file", new File([new Uint8Array(2048)], "week3.mp4", { type: "video/mp4" }));
r = await call("POST", "/recordings/upload", up);
check(r.status === 200 && r.data.status === "ready" && r.data.source === "lecturer_upload" && r.data.published, "lecturer upload → ready immediately");
check(r.data.oneDrive?.fileName === "week3.mp4" && r.data.oneDrive.ownerEmail === "classes@lms.tasued-online.ng", `upload stored in organiser's OneDrive: ${r.data.oneDrive?.webUrl}`);
const upId = r.data.id;
const failedRecId = getDb().recordings.find((x) => x.status === "failed")!.id;
r = await call("GET", `/recordings/${upId}/playback`);
check(r.status === 200 && r.data.url.includes("BigBuckBunny.mp4"), "staff playback for uploaded recording");
{
  const pendingRec = getDb().recordings.find((x) => x.status === "pending" && x.courseId === "crs-aiie111")!;
  r = await call("GET", `/recordings/${pendingRec.id}/playback`);
  check(r.status === 409 && r.data.code === "RECORDING_NOT_READY", "staff playback for pending → 409");
  r = await call("POST", `/recordings/${pendingRec.id}/relink`);
  check(r.status === 200 && (r.data.status === "ready" ? !!r.data.oneDrive && r.data.published : r.data.status === "failed" && !!r.data.failureReason), `relink pending → ${r.data.status}`);
  r = await call("POST", `/recordings/${upId}/relink`);
  check(r.status === 409, "relink a ready recording → 409");
}

r = await call("GET", "/forum/reports");
check(r.status === 200 && r.data.length >= 2, `reports queue: ${r.data.length}`);
r = await call("PATCH", `/forum/reports/${r.data[0].id}`, { status: "actioned" });
check(r.data.status === "actioned", "resolve report");
r = await call("POST", "/forum/threads/thr-05/moderate", { isPinned: true });
check(r.data.isPinned, "pin thread");
r = await call("GET", "/reports/courses/crs-aiie111");
check(r.status === 200 && r.data.weekly.length === 6, `report: attendance ${r.data.averageAttendancePercent}%, at-risk ${r.data.atRiskStudents.length}`);
r = await call("GET", "/reports/courses/crs-aiie111.csv");
check(r.status === 200 && r.res.headers.get("content-disposition")?.includes(".csv"), "report CSV");
r = await call("GET", "/audit");
check(r.status === 403, "lecturer → audit 403");

// TA
await call("POST", "/auth/dev-login", { userId: "stf-nwosu" });
r = await call("POST", "/classes", { courseId: "crs-aiie111", title: "x", startsAt: future.toISOString(), endsAt: new Date(future.getTime() + 3600e3).toISOString(), unitIds: [], lecturerId: "stf-ogunleye", autoRecord: true });
check(r.status === 403, "TA → schedule class 403");
r = await call("GET", "/courses/crs-aiie111/gradebook");
check(r.status === 200, "TA → gradebook 200");
r = await call("GET", "/auth/session");
check(r.data.permissions.join() === "content.edit,attendance.manage,assignments.grade,quizzes.grade,forum.moderate" && r.data.staffCourseIds.join() === "crs-aiie111", `TA permissions: ${r.data.permissions.join(", ")}`);
r = await call("PATCH", "/courses/crs-aiie111", { status: "draft" });
check(r.status === 403, "TA can't publish/unpublish the course");
r = await call("PATCH", `/units/${units[0].id}`, { state: "draft" });
check(r.status === 403, "TA can't unpublish a unit");
r = await call("PATCH", `/units/${units[0].id}`, { objectives: ["Define AI in everyday terms."] });
check(r.status === 200, "TA can edit content");
r = await call("POST", "/courses", { code: "TA 101", title: "x", description: "", classCodePrefix: "TA101", lecturerIds: [], assistantIds: [] });
check(r.status === 403, "TA → POST /courses 403");

// Super admin
await call("POST", "/auth/dev-login", { userId: "stf-super" });
r = await call("GET", "/users?role=student&pageSize=5");
check(r.status === 200 && r.data.items.length === 5 && r.data.total >= 60, `users: ${r.data.total} students`);
r = await call("GET", "/roles/permissions");
check(r.data.super_admin.length === 9 && r.data.super_admin.includes("courses.manage") && !r.data.super_admin.some((p: string) => /^(content|classes|recordings|attendance|assignments|quizzes|grades|forum)\./.test(p)) && r.data.lecturer.length === 14 && r.data.teaching_assistant.length === 5 && r.data.student.length === 0 && Object.keys(r.data).sort().join() === "lecturer,student,super_admin,teaching_assistant", "role permission map");
r = await call("GET", "/auth/session");
check(r.data.staffCourseIds.includes("crs-aiie111") && r.data.teachingCourseIds.length === 0 && r.data.permissions.includes("courses.manage") && !r.data.permissions.includes("content.edit"), "super admin: sees all courses, teaches none, no teaching permissions");

// Super admin oversees but doesn't teach
r = await call("GET", "/units/unt-aiie111-1-1");
check(r.status === 200, "super admin can read unit content");
r = await call("PATCH", "/units/unt-aiie111-1-1", { title: "Edited by admin" });
check(r.status === 403, "super admin can't edit course content → 403");
r = await call("POST", "/announcements", { courseId: "crs-aiie111", title: "Course notice", bodyHtml: "<p>x</p>" });
check(r.status === 403, "super admin can't send a course announcement → 403");
r = await call("POST", "/announcements", { courseId: null, title: "Platform maintenance", bodyHtml: "<p>Saturday 10pm.</p>" });
check(r.status === 200 && r.data.courseId === null, "super admin sends an all-students announcement");
r = await call("GET", "/reports/courses/crs-aiie111");
check(r.status === 200, "super admin can view the course report");
r = await call("GET", "/admin/dashboard");
check(r.status === 200 && r.data.submissionsToGrade.length === 0 && r.data.attendanceToReview.length === 0 && r.data.todayClasses.length === 0 && r.data.counts.courses >= 1, "super admin dashboard has no teaching queues");

// Super admin manages courses
r = await call("POST", "/courses", { code: "aiie  111", title: "Dup", description: "", classCodePrefix: "AIIE111X", lecturerIds: [], assistantIds: [] });
check(r.status === 409 && r.data.code === "COURSE_CODE_TAKEN", "duplicate course code → 409 COURSE_CODE_TAKEN");
r = await call("POST", "/courses", { code: "EDU 112", title: "Digital Tools for Teaching", description: "x", lecturerIds: [], assistantIds: [] });
check(r.status === 422, "missing classCodePrefix → 422");
r = await call("POST", "/courses", { code: "EDU 112", title: "Digital Tools for Teaching", description: "x", classCodePrefix: "EDU-112", lecturerIds: [], assistantIds: [] });
check(r.status === 422, "classCodePrefix with symbols → 422");
r = await call("POST", "/courses", { code: "EDU 112", title: "Digital Tools for Teaching", description: "x", classCodePrefix: "EDU112", lecturerIds: ["stf-nope"], assistantIds: [] });
check(r.status === 422, "unknown lecturer → 422");
r = await call("POST", "/courses", { code: "EDU 112", title: "Digital Tools for Teaching", description: "Using digital tools in the classroom.", creditUnits: 2, level: 100, classCodePrefix: "edu112", lecturerIds: ["stf-ogunleye"], assistantIds: ["stf-nwosu"], status: "published" });
const newCourse = r.data;
check(r.status === 200 && newCourse.id.startsWith("crs-") && newCourse.status === "draft" && newCourse.moduleCount === 0 && newCourse.classCodePrefix === "EDU112" && newCourse.lecturers[0]?.id === "stf-ogunleye" && newCourse.assistants[0]?.id === "stf-nwosu", `super admin creates course ${newCourse.code} (draft, 0 modules)`);
check(getDb().users.find((u) => u.id === "stf-ogunleye")!.roles.some((x) => x.role === "lecturer" && x.scopeType === "course" && x.scopeId === newCourse.id) && getDb().users.find((u) => u.id === "stf-nwosu")!.roles.some((x) => x.role === "teaching_assistant" && x.scopeId === newCourse.id), "creating grants course-scoped lecturer/TA roles");
check(lastAudit().action === "course.created", "course creation audited");
r = await call("PATCH", `/courses/${newCourse.id}`, { lecturerIds: [], assistantIds: ["stf-nwosu"] });
check(r.status === 200 && r.data.lecturers.length === 0 && r.data.assistants.map((x: any) => x.id).join() === "stf-nwosu", "PATCH course staff");
check(!getDb().users.find((u) => u.id === "stf-ogunleye")!.roles.some((x) => x.scopeId === newCourse.id) && getDb().users.find((u) => u.id === "stf-nwosu")!.roles.some((x) => x.role === "teaching_assistant" && x.scopeId === newCourse.id), "PATCH re-syncs course-scoped roles");
r = await call("PATCH", `/courses/${newCourse.id}`, { lecturerIds: ["stf-ogunleye"], assistantIds: [] });
r = await call("GET", "/courses?pageSize=50");
check(r.data.total === 2, `super admin sees all courses: ${r.data.items.map((o: any) => o.code).join(", ")}`);
r = await call("GET", "/courses?status=draft");
check(r.data.total === 1 && r.data.items[0].id === newCourse.id, "status filter");
r = await call("POST", `/courses/${newCourse.id}/modules`, { title: "Module 1: Getting started" });
check(r.status === 403, "super admin can't add modules (content is the lecturer's) → 403");
r = await call("GET", "/search?q=EDU 112");
check(r.data.some((h: any) => h.type === "course" && h.id === newCourse.id), "search finds course (type course)");
r = await call("DELETE", "/courses/crs-aiie111");
check(r.status === 409 && r.data.code === "COURSE_IN_USE", "delete AIIE 111 (enrolments/classes) → 409 COURSE_IN_USE");
r = await call("DELETE", `/courses/${newCourse.id}`);
check(r.status === 204 && !getDb().courses.some((o) => o.id === newCourse.id) && !getDb().modules.some((m) => m.courseId === newCourse.id) && !getDb().users.some((u) => u.roles.some((x) => x.scopeId === newCourse.id)), "delete empty course → 204 (roles + modules removed)");
r = await call("GET", "/users?role=lecturer");
check(r.data.items.map((u: any) => u.id).sort().join() === "stf-ogunleye", "lecturers: Ogunleye");
const csv = "fullName,email,matricNumber,level,department\nKunle Adeyemi,kunle.adeyemi@student.tasued.edu.ng,20260199901,100,Computer Science\nBad Email,not-an-email,20260199902,100,CSC\nDup,kunle.adeyemi@student.tasued.edu.ng,20260199903,100,CSC\nAdaeze Okonkwo,adaeze.okonkwo@student.tasued.edu.ng,20260101234,100,CSC\n";
const imp = new FormData();
imp.append("kind", "students");
imp.append("courseId", "crs-aiie111");
imp.append("file", new File([csv], "students.csv", { type: "text/csv" }));
r = await call("POST", "/imports/preview", imp);
check(r.status === 200 && r.data.summary.create === 1 && r.data.summary.error === 2, `import preview: ${JSON.stringify(r.data.summary)}`);
r = await call("POST", `/imports/${r.data.importId}/commit`);
check(r.status === 200 && r.data.created === 1 && r.data.lmsInvitesSent === 1 && r.data.teamsGuestInvitesSent === 1 && !("m365AccountsCreated" in r.data), `import commit: ${JSON.stringify(r.data)}`);
{
  const kunle = getDb().users.find((u) => u.email === "kunle.adeyemi@student.tasued.edu.ng")!;
  check(kunle.department === "Computer Science" && kunle.roles[0]?.scopeType === "global" && getDb().enrolments.some((e) => e.userId === kunle.id && e.courseId === "crs-aiie111"), "imported student: department text, enrolled in AIIE 111");
  check(kunle.authMethod === "password" && kunle.lmsInvite?.status === "sent" && kunle.teamsGuest?.status === "sent" && kunle.status === "invited", "imported student: password auth, invites sent");
  check(getDb().authTokens.some((t) => t.userId === kunle.id && t.kind === "invite" && !t.usedAt), "imported student has an invite token");
}
const staffImp = new FormData();
staffImp.append("kind", "staff");
staffImp.append("file", new File(["fullName,email,staffId\nDr. Sade Oyewole,sade.oyewole@tasued.edu.ng,TASUED/CSC/0301\n"], "staff.csv", { type: "text/csv" }));
r = await call("POST", "/imports/preview", staffImp);
r = await call("POST", `/imports/${r.data.importId}/commit`);
check(r.status === 200 && r.data.created === 1 && r.data.lmsInvitesSent === 0 && r.data.teamsGuestInvitesSent === 0, `staff import commit: ${JSON.stringify(r.data)}`);
check(getDb().users.find((u) => u.email === "sade.oyewole@tasued.edu.ng")?.authMethod === "microsoft", "imported staff: microsoft auth");

// Invitations, resets, deactivation
{
  const pendingStudent = getDb().users.find((u) => u.lmsInvite?.status === "sent" && u.id.startsWith("stu-"))!;
  const before = pendingStudent.lmsInvite!.sentAt;
  await new Promise((res) => setTimeout(res, 5));
  r = await call("POST", `/users/${pendingStudent.id}/invites/resend`, { lms: true, teams: true });
  check(r.status === 200 && r.data.lmsInvite.status === "sent" && r.data.lmsInvite.sentAt !== before && r.data.teamsGuest.status === "sent", `resend invites to ${pendingStudent.fullName}`);
  check(lastAudit().action === "invite.sent", "resend audited as invite.sent");
  const expired = getDb().users.find((u) => u.lmsInvite?.status === "expired")!;
  r = await call("POST", `/users/${expired.id}/invites/resend`, { lms: true });
  check(r.status === 200 && r.data.lmsInvite.status === "sent" && r.data.teamsGuest.status === "expired", "resend LMS only to expired invite → sent (Teams untouched)");
  r = await call("POST", `/users/stu-adaeze/invites/resend`, { teams: true });
  check(r.status === 200 && r.data.teamsGuest.status === "accepted", "resend to accepted Teams guest keeps accepted");
  r = await call("POST", `/users/stf-ogunleye/invites/resend`, { lms: true });
  check(r.status === 409, "resend for staff → 409");
  r = await call("POST", `/users/stu-adaeze/password-reset`);
  check(r.status === 204 && getDb().authTokens.some((t) => t.userId === "stu-adaeze" && t.kind === "reset" && !t.usedAt), "admin password reset → 204 + reset token");
  check(lastAudit().action === "password.reset_requested", "reset audited");
  r = await call("POST", `/users/stu-tunde/deactivate`);
  check(r.status === 200 && r.data.status === "deactivated" && r.data.teamsGuest.status === "accepted", "deactivate Tunde (Teams guest left as is)");
}
r = await call("POST", "/integrations/health/run");
check(r.status === 200 && Date.now() - new Date(r.data.checkedAt).getTime() < 5000, `health run: ${r.data.overall}`);
check(r.data.checks.map((x: any) => x.key).join(",") === "graph_auth,meeting_creation,change_notifications,recording_lookup,recording_playback,attendance_import,guest_invitations,email_delivery", "health check keys");
r = await call("GET", "/settings");
check(r.data.organiserAccountEmail === "classes@lms.tasued-online.ng" && r.data.minPasswordLength === 8 && !("recordingRetentionDays" in r.data), "settings: organiser account + min password length");
r = await call("PATCH", "/settings", { minPasswordLength: 4 });
check(r.status === 422, "minPasswordLength below 8 → 422");
r = await call("PATCH", "/settings", { maxUploadMb: 100 });
check(r.data.maxUploadMb === 100, "settings update");
r = await call("GET", "/audit?pageSize=5");
check(r.data.total >= 40, `audit: ${r.data.total} entries`);
r = await call("GET", "/admin/dashboard");
check(r.data.counts.courses === 1 && !("offerings" in r.data.counts) && r.data.recordingQueue.failed === 0 && !("processing" in r.data.recordingQueue), `super admin dashboard: ${JSON.stringify(r.data.counts)} (no recording queue — that's the lecturer's)`);
r = await call("POST", `/recordings/${failedRecId}/relink`);
check(r.status === 403, "super admin can't relink recordings → 403");
await call("POST", "/auth/dev-login", { userId: "stf-ogunleye" });
r = await call("GET", "/admin/dashboard");
check(r.data.recordingQueue.failed >= 1 && r.data.todayClasses !== undefined, `lecturer dashboard: queue ${JSON.stringify(r.data.recordingQueue)}`);
r = await call("POST", `/recordings/${failedRecId}/relink`);
check(r.status === 200 && ["ready", "failed"].includes(r.data.status), `relink failed recording → ${r.data.status}${r.data.failureReason ? ` (${r.data.failureReason})` : ""}`);
{
  // relink outcome is random (~70% found): run it on a batch and expect both outcomes
  const outcomes = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const rr = getDb().recordings.find((x) => x.id === failedRecId)!;
    rr.status = "failed";
    rr.oneDrive = undefined;
    outcomes.add((await call("POST", `/recordings/${failedRecId}/relink`)).data.status);
  }
  check(outcomes.has("ready") && outcomes.has("failed"), `relink outcomes over 40 tries: ${[...outcomes].join(", ")}`);
}
r = await call("GET", "/classes/does-not-exist");
check(r.status === 404 && r.data.code === "NOT_FOUND", "missing id → 404");

// Pipeline: class ends → pending → ready ~30 s after the recording is created (evaluated on read)
{
  const live = getDb().classes.filter((x) => ["live", "scheduled"].includes(classStatus(x, Date.now()))).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]!;
  const t0 = new Date(live.endsAt).getTime() + 1000;
  tick(getDb(), t0);
  const rec = getDb().recordings.find((x) => x.classSessionId === live.id)!;
  check(rec?.status === "pending" && !rec.oneDrive, "class ended → recording pending");
  tick(getDb(), t0 + 20_000);
  check(rec.status === "pending", "still pending after 20 s");
  tick(getDb(), t0 + 31_000);
  check(rec.status === "ready" && rec.published && rec.oneDrive?.fileName.startsWith(live.classCode + "-Recording-"), `ready after 30 s: ${rec.oneDrive?.fileName}`);
  const n = getDb().notifications.find((x) => x.kind === "recording_ready" && x.body.includes(rec.title) && x.userId === "stu-adaeze");
  check(!!n && n.body.includes("now available") && !/process/i.test(n.body + n.title), `notification: ${n?.body}`);
}
server.close();

/* ───────────── student app again ───────────── */
console.log("\nStudent app (after admin changes)");
server = setupServer(...createHandlers({ app: "student", latency: false }));
server.listen({ onUnhandledRequest: "error" });
r = await call("POST", "/auth/login", { email: "tunde.bakare@student.tasued.edu.ng", password: "Tunde-New-2026" });
check(r.status === 403 && r.data.code === "ACCOUNT_DEACTIVATED", "deactivated student login → 403 ACCOUNT_DEACTIVATED");
r = await call("POST", "/auth/dev-login", { userId: "stu-adaeze" });
r = await call("GET", `/recordings/${upId}/playback`);
check(r.status === 200, "student playback for the uploaded recording → 200");
r = await call("GET", "/me/notifications");
check(r.data.filter((x: any) => x.kind === "recording_ready").every((x: any) => !/process|transcod/i.test(x.body)), "recording notifications say 'now available'");
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
