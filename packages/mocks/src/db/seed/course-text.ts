import type { UnitRow } from "../schema";
import { scheduleSave } from "../store";

/**
 * AIIE 111 course text (~190 KB of HTML) lives in its own chunk so the app doesn't download it at
 * start-up: a unit's text is filled in the first time that unit is requested, like a real API
 * returning one unit at a time. Units seeded from the handout carry `textRef` (their unit code)
 * until then; once filled (or edited by staff) the text is stored on the unit like any other field.
 */
let textByCode: Promise<Record<string, string>> | null = null;

function loadText() {
  textByCode ??= import("./aiie111-text.json").then((m) => (m.default ?? m) as Record<string, string>);
  return textByCode;
}

export async function ensureUnitText(unit: UnitRow): Promise<UnitRow> {
  if (!unit.textRef) return unit;
  const text = await loadText();
  if (unit.textRef) {
    unit.courseTextHtml = text[unit.textRef] ?? "";
    delete unit.textRef;
    scheduleSave();
  }
  return unit;
}

/** Original handout HTML for one unit code (smoke tests). */
export async function handoutText(code: string) {
  return (await loadText())[code];
}
