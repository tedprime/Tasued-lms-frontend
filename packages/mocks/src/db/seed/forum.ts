import { DAY, HOUR, iso, MIN } from "../../lib/dates";
import type { Random } from "../../lib/random";
import { activeStudentIds } from "../ops/common";
import type { DB, PostRow } from "../schema";
import { AIIE_COURSE_ID } from "./ids";
import { participates } from "./people";

/** "S" = a random enrolled student of that course (or any student for the General forum). */
interface TSpec {
  course: string | null;
  title: string;
  body: string;
  author: string;
  unit?: string;
  daysAgo: number;
  tags?: string[];
  pinned?: boolean;
  locked?: boolean;
  anonymous?: boolean;
  upvotes: number;
  replies: [string, string, boolean?][];
  reportReply?: number;
}

const A = AIIE_COURSE_ID;
const THREADS: TSpec[] = [
  { course: A, title: "Welcome to AIIE 111 — please read before your first class", author: "stf-ogunleye", daysAgo: 30, pinned: true, upvotes: 34, tags: ["announcement"],
    body: "<p>Welcome to <strong>Foundation of Artificial Intelligence and Digital Productivity</strong>. Classes hold on Teams every <strong>Monday, Wednesday and Friday, 10:00–12:00 and 14:00–16:00</strong>. Each class covers one or two units of the handout, and the recording appears under those units after class. The full handout is the course text on each unit page — read the unit before class.</p><p>Use this forum for questions about the course. Link your post to the unit it is about so others can find it. Mr. Nwosu (our teaching assistant) and I read it every day.</p>",
    replies: [["S", "<p>Thank you sir. Will the quizzes be on Teams or here on the LMS?</p>"], ["stf-nwosu", "<p>Quizzes are here on the LMS. They are timed, so start only when you are ready, and make sure your data or Wi-Fi is stable.</p>", true]] },
  { course: A, title: "Is ChatGPT the same thing as Copilot?", author: "stu-tunde", unit: "unt-aiie111-4-1", daysAgo: 16, upvotes: 14, tags: ["4.1"],
    body: "<p>Unit 4.1 lists chat assistants such as ChatGPT, Gemini, Claude and Copilot. Are they all the same model with different names? Which one should we use for the prompt journal?</p>",
    replies: [["S", "<p>I think Copilot is the one inside Word and Excel.</p>"], ["stf-ogunleye", "<p>Good question. They are different products from different companies, but all are chat assistants built on large language models, so the principles in Modules 4 and 5 apply to every one of them. Copilot is built into Microsoft 365 (Unit 6.1). For the prompt journal you may use any of them — just say which one in your AI-use statement.</p>", true], ["stu-adaeze", "<p>Thank you sir, this is clear now.</p>"]] },
  { course: A, title: "My prompts keep giving American examples", author: "stu-adaeze", unit: "unt-aiie111-5-2", daysAgo: 7, upvotes: 11, tags: ["5.2", "prompting"],
    body: "<p>When I ask for lesson ideas the AI uses dollars and baseball. How do I make it use Nigerian examples?</p>",
    replies: [["stf-nwosu", "<p>Add <strong>context</strong> and <strong>constraints</strong> (Unit 5.2): “for a JSS 2 class in Ogun State… Use Nigerian examples, naira and local markets.” Then use a follow-up prompt to correct anything that still sounds foreign (Unit 5.4).</p>", true], ["S", "<p>This worked for me too. I also ask it to use Yoruba and Hausa names.</p>"]] },
  { course: A, title: "Is a hallucination different from a simple mistake?", author: "S", unit: "unt-aiie111-4-5", daysAgo: 10, upvotes: 9, tags: ["4.5"],
    body: "<p>If a model gets a date wrong, is that a hallucination or just an error?</p>",
    replies: [["S", "<p>I think hallucination is when it invents something that doesn’t exist, like the fake journal article in the handout.</p>"], ["stf-nwosu", "<p>Both come from the same mechanism: the model produces a <em>plausible continuation</em>, not a checked fact (Unit 4.2). We usually say “hallucination” when the output is fluent and confident but false or invented — a reference, a statistic, a quotation. Either way the remedy is the same: verify (Unit 7.4).</p>", true]] },
  { course: A, title: "Few-shot or zero-shot — how do I know which to use?", author: "S", unit: "unt-aiie111-5-3", daysAgo: 5, upvotes: 6, tags: ["5.3"],
    body: "<p>For my practice questions I tried both. Is few-shot always better?</p>",
    replies: [["S", "<p>From the handout: zero-shot is fine for common tasks; few-shot when you want a particular style or format that is hard to describe.</p>"]] },
  { course: A, title: "Prompt Journal: do we need screenshots for all five tasks?", author: "stu-chiamaka", daysAgo: 4, upvotes: 8, tags: ["assignment-2"],
    body: "<p>Can we paste the text instead of screenshots? My phone screenshots are very large files.</p>",
    replies: [["stf-ogunleye", "<p>Pasting the text is fine — it is easier to read. Keep the file under 10 pages. What matters is that we can see your first prompt, the improved one and your comment on accuracy.</p>", true], ["stu-chiamaka", "<p>Thank you sir.</p>"]] },
  { course: A, title: "Can I ask AI to paraphrase my sources so Turnitin won’t flag them?", author: "S", unit: "unt-aiie111-11-3", daysAgo: 6, anonymous: true, upvotes: 3, tags: ["11.3", "integrity"],
    body: "<p>Asking for a friend 😅</p>",
    replies: [["stf-ogunleye", "<p>No. Using AI to disguise copied text is still plagiarism of the original source — Unit 11.3 calls this AI-assisted plagiarism. Paraphrase in your own words <em>and</em> cite the source (Unit 11.5).</p>", true]] },
  { course: A, title: "How do I cite ChatGPT in APA 7th edition?", author: "S", unit: "unt-aiie111-11-4", daysAgo: 3, upvotes: 7, tags: ["11.4", "referencing"],
    body: "<p>Our department uses APA. Do I put the prompt in the reference list?</p>",
    replies: [["stf-nwosu", "<p>In APA the developer is the author: <em>OpenAI. (2026). ChatGPT [Large language model]. https://chatgpt.com</em>, with an in-text citation such as (OpenAI, 2026) and a description of your prompt in the text — see the examples in Unit 11.4. And remember: for facts, cite the original source, not the chat.</p>", true]] },
  { course: A, title: "Does the NDPA apply to our class WhatsApp group?", author: "S", unit: "unt-aiie111-12-2", daysAgo: 2, upvotes: 5, tags: ["12.2", "data-protection"],
    body: "<p>Our class rep shared everyone’s phone numbers and matric numbers in a Google Sheet. Is that allowed under the Nigeria Data Protection Act 2023?</p>",
    replies: [["S", "<p>I don’t think he asked anyone before sharing it.</p>"]] },
  { course: A, title: "What should go into the AI portfolio?", author: "stu-chiamaka", unit: "unt-aiie111-14-2", daysAgo: 1, upvotes: 4, tags: ["14.2", "portfolio"],
    body: "<p>I know we get to Module 14 later, but I want to start collecting things now. What counts as an artefact?</p>",
    replies: [["stf-nwosu", "<p>Good thinking. Start with your prompt journal (Module 5) and your Assignment 1 reflection. Unit 14.2 lists six artefact types; for each one keep a short note of your process, your AI use and how you checked it.</p>", true]] },
  { course: A, title: "Recording for Week 2 Wednesday has no sound for the first few minutes", author: "S", daysAgo: 17, upvotes: 3, tags: ["recordings"],
    body: "<p>Is it just me? The audio starts at about 5:10.</p>",
    replies: [["stf-nwosu", "<p>The microphone was muted at the start of class. Skip to the “Recap” chapter — nothing was missed.</p>", true]] },
  { course: A, title: "Group formation for the needs-finding brief", author: "S", daysAgo: 1, upvotes: 4, tags: ["assignment-3"],
    body: "<p>Looking for group members from COSPED for Assignment 3. We want to interview students about the shuttle queues.</p>",
    replies: [["S", "<p>I’m in COSPED, add me.</p>"], ["S", "<p>Cheap data bundles 1GB for ₦150!!! DM me on WhatsApp 0803 000 0000</p>"]], reportReply: 1 },
  { course: A, title: "Anyone selling the AIIE 111 handout?", author: "S", daysAgo: 25, upvotes: 0, locked: true,
    body: "<p>Please who has the printed handout to sell?</p>",
    replies: [["stf-ogunleye", "<p>There is nothing to buy for this course — the whole handout is the course text on the LMS, and you can save it for offline reading. Locking this thread.</p>"]] },

  { course: null, title: "Teams says I can’t join the class meeting", author: "S", daysAgo: 26, upvotes: 15, tags: ["tech-help"],
    body: "<p>I can sign in to the LMS but Teams says I don’t have access to the TASUED organisation.</p>",
    replies: [["stf-super", "<p>You need to accept the Teams guest invitation first. Look for the email from Microsoft on behalf of TASUED (check Spam) and accept it with the same email you use for the LMS. If you can’t find it, email lms-support@tasued.edu.ng and we’ll resend it.</p>", true], ["S", "<p>Found it in spam. Worked for me, thanks.</p>"]] },
  { course: null, title: "Low-data tips for watching recordings", author: "stu-tunde", daysAgo: 20, upvotes: 22, pinned: true, tags: ["tips"],
    body: "<p>Turn on Low-data mode in Settings — recordings don’t autoplay and pages load lighter. Watch on campus Wi-Fi when you can, and read the course text offline before going home.</p>",
    replies: [["S", "<p>This saved me so much data, thank you!</p>"], ["S", "<p>If I stop halfway, does it remember where I was?</p>"], ["stu-tunde", "<p>Yes, it picks up from where you stopped.</p>"]] },
  { course: null, title: "Free AI tools that work on a basic Android phone?", author: "S", daysAgo: 8, upvotes: 6, tags: ["tools"],
    body: "<p>My phone has 2 GB RAM. Which free assistants work well on it for the prompt journal?</p>",
    replies: [["S", "<p>The Copilot and ChatGPT apps both work on mine (Tecno). You can also use them in the browser if storage is low.</p>"], ["stf-nwosu", "<p>Any of them is fine. Draft your prompts in a notes app when you are offline, as Unit 6.1 suggests, and paste them in when you are connected.</p>"]] },
];

export function seedForum(db: DB, now: number, r: Random) {
  db.categories.push({ id: "cat-aiie111", courseId: AIIE_COURSE_ID, name: "AIIE 111", description: "Questions and discussion about Foundation of Artificial Intelligence and Digital Productivity — link your post to a unit." });
  db.categories.push({ id: "cat-general", courseId: null, name: "General", description: "Campus-wide questions, tech help and study tips." });
  const allStudents = db.users.filter((u) => u.roles.some((x) => x.role === "student") && participates(db, u.id)).map((u) => u.id);
  const pickStudent = (course: string | null) => r.pick((course ? activeStudentIds(db, course) : allStudents).filter((x) => participates(db, x) && !x.startsWith("stu-a") && x !== "stu-tunde" && x !== "stu-chiamaka"));

  THREADS.forEach((t, i) => {
    const id = `thr-${String(i + 1).padStart(2, "0")}`;
    const author = t.author === "S" ? pickStudent(t.course) : t.author;
    const created = now - t.daysAgo * DAY - r.int(1, 10) * HOUR;
    const pool = (t.course ? activeStudentIds(db, t.course) : allStudents).filter((x) => participates(db, x));
    let last = created;
    const posts: PostRow[] = t.replies.map(([who, body, accepted], j) => {
      last = Math.min(now - 5 * MIN, last + r.int(1, 20) * HOUR);
      return {
        id: `${id}-p${j + 1}`,
        threadId: id,
        parentId: null,
        bodyHtml: body,
        authorId: who === "S" ? pickStudent(t.course) : who,
        createdAt: iso(last),
        upvoterIds: r.sample(pool, accepted ? r.int(3, 9) : r.int(0, 3)),
        isAcceptedAnswer: !!accepted,
        isHidden: false,
      };
    });
    db.posts.push(...posts);
    db.threads.push({
      id,
      categoryId: t.course ? "cat-aiie111" : "cat-general",
      courseId: t.course,
      unitId: t.unit,
      title: t.title,
      bodyHtml: t.body,
      authorId: author,
      createdAt: iso(created),
      lastActivityAt: iso(last),
      upvoterIds: r.sample(pool.filter((x) => x !== author), t.upvotes),
      subscriberIds: [author],
      isPinned: !!t.pinned,
      isLocked: !!t.locked,
      isResolved: t.replies.some((x) => x[2]),
      isAnonymous: !!t.anonymous,
      tags: t.tags ?? [],
    });
    if (t.reportReply !== undefined) {
      const p = posts[t.reportReply]!;
      for (const [k, reason] of ["Spam / advertising", "Not related to the course"].entries()) {
        const reporter = r.pick(pool);
        db.reports.push({ id: `rep-${id}-${k + 1}`, targetType: "post", targetId: p.id, threadId: id, threadTitle: t.title, excerpt: p.bodyHtml.replace(/<[^>]+>/g, "").slice(0, 120), reason, reportedBy: db.users.find((u) => u.id === reporter)?.fullName ?? "Student", reporterId: reporter, reportedAt: iso(now - r.int(2, 20) * HOUR), status: "open" });
      }
    }
  });

  // Older, already-handled reports.
  const locked = db.threads.find((t) => t.isLocked)!;
  db.reports.push({ id: "rep-old-1", targetType: "thread", targetId: locked.id, threadId: locked.id, threadTitle: locked.title, excerpt: "Please who has the printed handout to sell?", reason: "Commercial post", reportedBy: "Mr. Emeka Nwosu", reporterId: "stf-nwosu", reportedAt: iso(now - 24 * DAY), status: "actioned" });
  const anon = db.threads.find((t) => t.isAnonymous)!;
  db.reports.push({ id: "rep-old-2", targetType: "thread", targetId: anon.id, threadId: anon.id, threadTitle: anon.title, excerpt: "Asking for a friend", reason: "Encouraging cheating", reportedBy: "Anonymous student", reporterId: allStudents[9]!, reportedAt: iso(now - 5 * DAY), status: "dismissed" });

  // Demo students follow their own threads plus one popular one.
  db.threads.find((t) => t.id === "thr-02")!.subscriberIds.push("stu-adaeze");
}
