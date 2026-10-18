import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  setOwner,
  owner,
  saveCourse,
  savedCourses,
  removeCourse,
} from "../apps/student/src/pwa/offline-store";
test("offline library isolates accounts, expires copies and rejects saves after logout", async () => {
  const course = {
    id: "c",
    owner: "alice",
    title: "Course",
    code: "C101",
    savedAt: Date.now(),
    expiresAt: Date.now() + 100000,
    units: [],
  };
  await setOwner("alice");
  await saveCourse(course);
  assert.equal((await savedCourses()).length, 1);
  await setOwner("alice");
  assert.equal((await savedCourses()).length, 1);
  await setOwner("bob");
  assert.equal((await savedCourses()).length, 0);
  await assert.rejects(saveCourse(course), /Account changed/);
  await setOwner("alice");
  await saveCourse({ ...course, expiresAt: Date.now() - 1 });
  assert.equal((await savedCourses()).length, 0);
  await saveCourse(course);
  await removeCourse("c");
  assert.equal((await savedCourses()).length, 0);
  await saveCourse(course);
  await setOwner(null);
  assert.equal(await owner(), null);
  assert.equal((await savedCourses()).length, 0);
  await assert.rejects(saveCourse(course));
  assert.equal(await setOwner(null), false);
});
