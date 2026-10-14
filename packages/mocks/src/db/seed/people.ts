import type { RoleAssignment } from "@tasued/api-client";
import { DAY, HOUR, iso } from "../../lib/dates";
import type { Random } from "../../lib/random";
import type { DB, UserRow } from "../schema";
import { DEFAULT_PREFERENCES } from "../schema";
import { hashPassword, DEMO_STUDENT_PASSWORD } from "../../lib/password";
import { AIIE_ASSISTANT_IDS, AIIE_COURSE_ID, AIIE_LECTURER_IDS, DEMO_INVITE_TOKEN, DEMO_STUDENT_IDS, EXPIRED_INVITE_TOKEN, INVITED_DEMO_STUDENT_ID } from "./ids";

interface StaffSpec {
  id: string;
  fullName: string;
  email: string;
  staffId: string;
  department: string;
  roles: Omit<RoleAssignment, "id" | "scopeName">[];
}

const STAFF: StaffSpec[] = [
  { id: "stf-super", fullName: "Dr. Kehinde Ogundipe", email: "kehinde.ogundipe@tasued.edu.ng", staffId: "TASUED/ICT/0112", department: "Computer Science", roles: [{ role: "super_admin", scopeType: "global", scopeId: null }] },
  { id: "stf-ogunleye", fullName: "Dr. Adebayo Ogunleye", email: "adebayo.ogunleye@tasued.edu.ng", staffId: "TASUED/CSC/0131", department: "Computer Science", roles: [] },
  { id: "stf-nwosu", fullName: "Mr. Emeka Nwosu", email: "emeka.nwosu@tasued.edu.ng", staffId: "TASUED/CSC/0207", department: "Computer Science", roles: [] },
];

const FIRST = ["Oluwaseun", "Chinedu", "Aisha", "Ifeoluwa", "Emeka", "Fatima", "Damilola", "Chukwuemeka", "Bisola", "Ibrahim", "Ngozi", "Temitope", "Uchenna", "Zainab", "Babatunde", "Kemi", "Obinna", "Hadiza", "Folake", "Ikechukwu", "Yetunde", "Musa", "Chioma", "Olamide", "Amaka", "Sodiq", "Precious", "Femi", "Blessing", "Abdullahi", "Nneka", "Kehinde", "Taiwo", "Godwin", "Mariam", "Tobiloba", "Ebuka", "Funke", "Ayomide", "Efe", "Gbenga", "Ruth", "Victor", "Halimat", "Somto"];
const LAST = ["Adeyemi", "Okeke", "Balogun", "Ogunbiyi", "Abubakar", "Nwachukwu", "Olatunji", "Ibekwe", "Lawal", "Afolabi", "Salami", "Odukoya", "Onyekachi", "Ajibola", "Oyelaran", "Uche", "Bankole", "Danjuma", "Akande", "Obi", "Adesanya", "Ogundele", "Sanni", "Ilori", "Mohammed", "Ezenwa", "Oladipo", "Fagbemi", "Soyinka", "Onabanjo", "Adebowale", "Ekpo"];

const STUDENT_DEPTS = [
  "Computer Science",
  "Mathematics",
  "Physics",
  "English Studies",
  "History and Diplomatic Studies",
  "Economics",
  "Accounting",
  "Educational Technology",
  "Home Economics and Hotel Management",
  "Technical and Vocational Education",
  "Educational Foundations",
  "Educational Management",
];

export function seedPeople(db: DB, now: number, r: Random) {
  const users: UserRow[] = [];
  const created = (days: number) => iso(now - days * DAY);

  for (const s of STAFF) {
    users.push({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      staffId: s.staffId,
      department: s.department,
      status: "active",
      authMethod: "microsoft",
      roles: s.roles.map((x, i) => ({ ...x, id: `${s.id}-role${i + 1}` })),
      createdAt: created(r.int(300, 900)),
      lastSeenAt: iso(now - r.int(1, 48) * HOUR),
      phone: `+234 80${r.int(2, 9)} ${r.int(100, 999)} ${r.int(1000, 9999)}`,
    });
  }

  const deptNo = (id: string) => String(STUDENT_DEPTS.indexOf(id) + 1).padStart(2, "0");
  const student = (id: string, fullName: string, department: string, level: number, seq: number, email?: string): UserRow => {
    const [first, ...rest] = fullName.split(" ");
    const createdAt = now - (level === 100 ? r.int(30, 45) : r.int(380, 420)) * DAY;
    return {
      id,
      fullName,
      email: email ?? `${first!.toLowerCase()}.${rest.join("").toLowerCase()}@student.tasued.edu.ng`,
      matricNumber: `${level === 100 ? 2026 : 2025}${deptNo(department)}${String(seq).padStart(5, "0")}`,
      department,
      level,
      status: "active",
      authMethod: "password",
      lmsInvite: { status: "accepted", sentAt: iso(createdAt + 2 * HOUR), acceptedAt: iso(createdAt + r.int(3, 40) * HOUR) },
      teamsGuest: { status: "accepted", sentAt: iso(createdAt + 2 * HOUR), acceptedAt: iso(createdAt + r.int(3, 60) * HOUR) },
      roles: [{ id: `${id}-role1`, role: "student", scopeType: "global", scopeId: null }],
      createdAt: iso(createdAt),
      lastSeenAt: iso(now - r.int(1, 120) * HOUR),
    };
  };

  users.push(
    { ...student("stu-adaeze", "Adaeze Okonkwo", "Computer Science", 100, 1234), phone: "+234 803 412 7781", lastSeenAt: iso(now - 2 * HOUR) },
    { ...student("stu-tunde", "Tunde Bakare", "Economics", 100, 2287), phone: "+234 816 220 9034", lastSeenAt: iso(now - 20 * HOUR) },
    { ...student("stu-chiamaka", "Chiamaka Eze", "Mathematics", 100, 1876), lastSeenAt: iso(now - 5 * HOUR) },
  );

  const usedNames = new Set(users.map((u) => u.fullName));
  const usedSeq = new Set([1234, 2287, 1876, 3141]);
  usedNames.add("Ifeoluwa Adeyemi");
  let expiredInviteUserId = "";
  let n = 0;
  while (n < 57) {
    const name = `${r.pick(FIRST)} ${r.pick(LAST)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    let seq = r.int(1000, 9999);
    while (usedSeq.has(seq)) seq = r.int(1000, 9999);
    usedSeq.add(seq);
    n++;
    const u = student(`stu-${String(n).padStart(3, "0")}`, name, r.pick(STUDENT_DEPTS), r.chance(0.85) ? 100 : 200, seq);
    const sentAgo = (days: number) => iso(now - days * DAY);
    if (n === 7 || n === 44) {
      // invitations sent, not yet accepted
      u.status = "invited";
      u.lmsInvite = { status: "sent", sentAt: sentAgo(n === 7 ? 3 : 1) };
      u.teamsGuest = { status: "sent", sentAt: sentAgo(n === 7 ? 3 : 1) };
      u.lastSeenAt = undefined;
    }
    if (n === 23 || n === 31 || n === 38) {
      // signed in to the LMS but hasn't accepted the Teams guest invitation yet
      u.teamsGuest = { status: "sent", sentAt: sentAgo(n === 23 ? 9 : 4) };
    }
    if (n === 19) u.status = "suspended";
    if (n === 56) {
      // never acted on the invitation; the link has expired
      u.status = "invited";
      u.lmsInvite = { status: "expired", sentAt: sentAgo(12) };
      u.teamsGuest = { status: "expired", sentAt: sentAgo(12) };
      u.lastSeenAt = undefined;
      expiredInviteUserId = u.id;
    }
    users.push(u);
  }

  // Invited student for demoing the set-password page (/set-password?token=demo-invite-token).
  users.push({
    ...student(INVITED_DEMO_STUDENT_ID, "Ifeoluwa Adeyemi", "Educational Technology", 100, 3141),
    status: "invited",
    lmsInvite: { status: "sent", sentAt: iso(now - 2 * HOUR) },
    teamsGuest: { status: "sent", sentAt: iso(now - 2 * HOUR) },
    createdAt: iso(now - 2 * HOUR),
    lastSeenAt: undefined,
  });

  db.users = users;
  for (const u of users) db.preferences[u.id] = { ...DEFAULT_PREFERENCES };
  db.preferences["stu-tunde"] = { ...DEFAULT_PREFERENCES, lowDataMode: true };

  /* credentials (mock hashes — see lib/password.ts) and one-time links */
  for (const u of users) {
    if (u.authMethod !== "password" || u.lmsInvite?.status !== "accepted") continue;
    const demo = (DEMO_STUDENT_IDS as readonly string[]).includes(u.id);
    db.credentials[u.id] = {
      passwordHash: hashPassword(demo ? DEMO_STUDENT_PASSWORD : `seed-${u.id}-${r.token(10)}`),
      // Chiamaka was given a temporary password by an admin: the app must force a change.
      mustChangePassword: u.id === "stu-chiamaka",
      updatedAt: u.lmsInvite.acceptedAt ?? u.createdAt,
    };
  }
  for (const u of users) {
    if (u.lmsInvite?.status !== "sent" || u.id === INVITED_DEMO_STUDENT_ID) continue;
    db.authTokens.push({ token: r.token(40), kind: "invite", userId: u.id, createdAt: u.lmsInvite.sentAt!, expiresAt: iso(new Date(u.lmsInvite.sentAt!).getTime() + 7 * DAY) });
  }
  db.authTokens.push(
    { token: DEMO_INVITE_TOKEN, kind: "invite", userId: INVITED_DEMO_STUDENT_ID, createdAt: iso(now - 2 * HOUR), expiresAt: iso(now + 7 * DAY) },
    { token: EXPIRED_INVITE_TOKEN, kind: "invite", userId: expiredInviteUserId, createdAt: iso(now - 12 * DAY), expiresAt: iso(now - 5 * DAY) },
  );

  /* course-scoped staff role assignments for AIIE 111 (the course itself is seeded by seedCourses) */
  for (const [ids, role] of [
    [AIIE_LECTURER_IDS, "lecturer"],
    [AIIE_ASSISTANT_IDS, "teaching_assistant"],
  ] as const) {
    for (const uid of ids) {
      const u = users.find((x) => x.id === uid)!;
      u.roles.push({ id: `${uid}-${AIIE_COURSE_ID}`, role, scopeType: "course", scopeId: AIIE_COURSE_ID });
    }
  }
  // Every student is registered on AIIE 111 (a university-wide course), including invited ones.
  for (const u of users.filter((x) => x.id.startsWith("stu-"))) {
    db.enrolments.push({
      id: `enr-${AIIE_COURSE_ID}-${u.id}`,
      courseId: AIIE_COURSE_ID,
      userId: u.id,
      enrolledAt: u.id === INVITED_DEMO_STUDENT_ID ? u.createdAt : iso(Math.max(new Date(u.createdAt).getTime() + HOUR, now - r.int(30, 34) * DAY)),
      status: "active",
    });
  }
}

/**
 * Students who actually take part (signed in to the LMS and accepted the Teams guest invitation).
 * Invited / suspended students and those who haven't accepted Teams are enrolled but inactive.
 */
export function participates(db: DB, userId: string): boolean {
  const u = db.users.find((x) => x.id === userId);
  return !!u && u.status === "active" && u.lmsInvite?.status === "accepted";
}

/** Per-student "diligence" used to make attendance/submissions/scores consistent. */
export function diligence(userId: string): number {
  if (userId === "stu-adaeze") return 0.93;
  if (userId === "stu-tunde") return 0.72;
  if (userId === "stu-chiamaka") return 0.84;
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 0.62 + ((h % 1000) / 1000) * 0.36;
}
