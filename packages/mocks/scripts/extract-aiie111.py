#!/usr/bin/env python3
"""Convert the AIIE 111 student handout (PDF) into structured course content.

Usage:
    python3 packages/mocks/scripts/extract-aiie111.py [handout.pdf] [out.json]

Output: packages/mocks/src/db/seed/aiie111-outline.json (structure, objectives, word counts)
        packages/mocks/src/db/seed/aiie111-text.json (course text HTML per unit, loaded on demand)
    { course: {code, title, description, outcomes},
      parts:   [{letter, title, summary, modules}],
      modules: [{number, title, part, intro, units: [{code, title, objective, html, words}]}] }

How it works (PyMuPDF):
  * every text line is read with its spans (font, size, colour, position); page
    headers/footers ("Module N · …  AIIE 111", "TedPrime", page numbers) are dropped;
  * tables are found from their ruling: a thick teal rule under the header row and a
    thin rule under every body row; the rule segments give the column boundaries;
  * boxes (key ideas, example prompts, model answers, checklists …) are found from
    their small-caps label and the smallest drawn frame around it, and become
    <blockquote>s;
  * figures (anything above a "FIGURE n.n" caption) and a few side-by-side widgets
    cannot be read linearly, so they are replaced by hand-written equivalents
    (lists / small tables) defined in FIGURES and WIDGETS below;
  * the remaining lines are flowed into headings, paragraphs and lists, using font
    size/weight to tell them apart; words hyphenated across lines (U+2010) are joined.
Requires: pip install pymupdf
"""
from __future__ import annotations

import html as _html
import json
import math
import os
import re
import sys
from dataclasses import dataclass, field

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PDF = "/root/.claude/uploads/0c60a4a3-44e3-5606-b24d-10f574ea1701/6ac2e495-AIIE111_Foundation_of_AI_and_Digital_Productivity_Student_Handout_1.pdf"
DEFAULT_OUT = os.path.join(HERE, "..", "src", "db", "seed", "aiie111-outline.json")

HYPH = "‐"
TEAL = (0.0549, 0.4314, 0.4078)
HEADER_MAX_Y = 56.0
FOOTER_MIN_Y = 785.0
LEFT = 62.4

# ----------------------------------------------------------------------------- model


@dataclass
class Span:
    text: str
    font: str
    size: float
    color: int

    @property
    def bold(self) -> bool:
        return "Bold" in self.font

    @property
    def italic(self) -> bool:
        return "Italic" in self.font


@dataclass
class Line:
    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    base: float
    spans: list[Span]
    used: bool = False

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    def main(self) -> Span:
        best = max(self.spans, key=lambda s: len(s.text.strip()))
        return best

    @property
    def font(self) -> str:
        return self.main().font

    @property
    def size(self) -> float:
        return round(self.main().size, 1)

    @property
    def color(self) -> int:
        return self.main().color


@dataclass
class Element:
    page: int
    y: float
    kind: str  # unit | h3 | h4 | p | li | oli | html | table | box | objective
    data: dict = field(default_factory=dict)


def esc(s: str) -> str:
    return _html.escape(s, quote=False)


# ----------------------------------------------------------------------------- rich text


class Rich:
    """Accumulates text runs (text, bold, italic, strike) across wrapped lines."""

    def __init__(self) -> None:
        self.runs: list[list] = []

    def plain(self) -> str:
        return "".join(r[0] for r in self.runs)

    def add_line(self, line: Line, *, plain: bool = False, strike: bool = False, hard_break: bool = False) -> None:
        spans = [s for s in line.spans]
        # strip leading whitespace of the line
        first = True
        for s in spans:
            t = s.text.replace(" ", " ")
            if first:
                t = t.lstrip()
                if not t:
                    continue
                self._join(hard_break)
                first = False
            b = (s.bold and not plain)
            i = (s.italic and not plain)
            self._push(t, b, i, strike)
        # trim trailing whitespace
        if self.runs:
            self.runs[-1][0] = self.runs[-1][0].rstrip()

    def _join(self, hard_break: bool) -> None:
        if not self.runs:
            return
        last = self.runs[-1]
        if hard_break:
            last[0] = last[0].rstrip()
            self.runs.append(["\n", False, False, False])
            return
        t = last[0].rstrip()
        if t.endswith(HYPH):
            last[0] = t[:-1]
        elif t.endswith("-") and len(t) > 1 and t[-2].isalnum():
            last[0] = t
        elif (t.endswith("/") and not t.endswith(" /")) or t.endswith("–"):
            last[0] = t
        else:
            last[0] = t + " "

    def _push(self, t: str, b: bool, i: bool, s: bool) -> None:
        if self.runs and self.runs[-1][1:] == [b, i, s] and self.runs[-1][0] != "\n":
            self.runs[-1][0] += t
        else:
            self.runs.append([t, b, i, s])

    def html(self, *, wrap_bold: bool = True) -> str:
        out = []
        for t, b, i, s in self.runs:
            if t == "\n":
                out.append("<br>")
                continue
            # keep surrounding spaces outside the tags
            lead = t[: len(t) - len(t.lstrip())]
            trail = t[len(t.rstrip()):]
            core = esc(t.strip())
            if not core:
                out.append(esc(t))
                continue
            if i:
                core = f"<em>{core}</em>"
            if b and wrap_bold:
                core = f"<strong>{core}</strong>"
            if s:
                core = f"<s>{core}</s>"
            out.append(esc(lead) + core + esc(trail))
        h = "".join(out).strip()
        h = re.sub(r"</strong>(\s*)<strong>", r"\1", h)
        h = re.sub(r"</em>(\s*)<em>", r"\1", h)
        h = re.sub(r"\s+", " ", h).replace(" <br>", "<br>").replace("<br> ", "<br>")
        return h


def rich_of(lines: list[Line], **kw) -> Rich:
    r = Rich()
    for ln in lines:
        r.add_line(ln, **kw)
    return r


def norm_text(t: str) -> str:
    t = t.replace(" ", " ")
    return re.sub(r"\s+", " ", t).strip()


def join_plain(lines: list[Line]) -> str:
    return norm_text(rich_of(lines, plain=True).plain())


# ----------------------------------------------------------------------------- page loading


def load_lines(doc, pn: int) -> list[Line]:
    page = doc[pn - 1]
    out: list[Line] = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = [Span(s["text"], s["font"], s["size"], s["color"]) for s in l["spans"] if s["text"]]
            if not spans or not "".join(s.text for s in spans).strip():
                continue
            x0, y0, x1, y1 = l["bbox"]
            if y1 <= HEADER_MAX_Y or y0 >= FOOTER_MIN_Y:
                continue
            base = l["spans"][0]["origin"][1]
            out.append(Line(pn, x0, y0, x1, y1, base, spans))
    out.sort(key=lambda l: (round(l.base), l.x0))
    return out


def is_teal(c) -> bool:
    return c is not None and all(abs(a - b) < 0.02 for a, b in zip(c, TEAL))


def h_segments(doc, pn: int):
    """Horizontal rule segments: (y, x0, x1, kind) kind in {'head','row'}."""
    segs = []
    for d in doc[pn - 1].get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                p1, p2 = it[1], it[2]
                if abs(p1.y - p2.y) < 0.3 and abs(p2.x - p1.x) > 20:
                    col = d.get("color")
                    w = d.get("width") or 0
                    kind = "head" if (is_teal(col) and w > 1.0) else "row"
                    segs.append((round(p1.y, 1), min(p1.x, p2.x), max(p1.x, p2.x), kind))
    return segs


def frames(doc, pn: int):
    """Bounding boxes of drawn shapes big enough to be a box/card."""
    out = []
    for d in doc[pn - 1].get_drawings():
        r = d["rect"]
        if r.width >= 120 and r.height >= 18 and r.height < 700:
            out.append((r.x0, r.y0, r.x1, r.y1))
    return out


def small_markers(doc, pn: int):
    """Small circles/squares used as list markers (checklists, numbered steps)."""
    out = []
    for d in doc[pn - 1].get_drawings():
        r = d["rect"]
        if 7 <= r.width <= 16 and 7 <= r.height <= 16:
            out.append((r.x0, r.y0, r.x1, r.y1))
    return out


# ----------------------------------------------------------------------------- tables

def nice_header(t: str) -> str:
    t = norm_text(t)
    t = t.replace("(/ 40)", "(/40)").replace("( / 40)", "(/40)")
    keep = {"AI", "ML", "NDPA", "LLM", "CA"}
    words = t.split(" ")
    res = []
    for i, w in enumerate(words):
        core = re.sub(r"[^A-Za-z]", "", w)
        if core in keep:
            res.append(w)
        else:
            res.append(w.lower())
    s = " ".join(res)
    return s[:1].upper() + s[1:] if s else s


def find_tables(doc, pn: int, lines: list[Line]) -> list[Element]:
    segs = h_segments(doc, pn)
    heads: dict[float, list] = {}
    for y, x0, x1, k in segs:
        if k == "head":
            heads.setdefault(y, []).append((x0, x1))
    rows_by_y: dict[float, list] = {}
    for y, x0, x1, k in segs:
        if k == "row":
            rows_by_y.setdefault(y, []).append((x0, x1))
    head_ys = sorted(heads)
    elements = []
    for H in head_ys:
        cols = sorted(heads[H])
        tx0, tx1 = cols[0][0], cols[-1][1]
        bounds = [c[0] for c in cols] + [tx1]
        if len(cols) == 1:
            # single segment: column boundaries come from the row rules
            pass
        # row rules below, within table width
        next_head = min([h for h in head_ys if h > H] + [10_000])
        rys = sorted(y for y, segs_ in rows_by_y.items() if H < y < next_head and
                     min(s[0] for s in segs_) >= tx0 - 1 and max(s[1] for s in segs_) <= tx1 + 1
                     and abs(min(s[0] for s in segs_) - tx0) < 1.5 and abs(max(s[1] for s in segs_) - tx1) < 1.5)
        chain = []
        prev = H
        for y in rys:
            if y - prev > 120:
                break
            between = [l for l in lines if prev < l.base < y and not l.used and (l.x0 < tx0 + 3 or l.x0 > tx1)]
            if between:
                break
            chain.append(y)
            prev = y
        if len(cols) == 1 and chain:
            segs_ = sorted(rows_by_y[chain[0]])
            bounds = [s[0] for s in segs_] + [segs_[-1][1]]
        ncol = len(bounds) - 1

        def col_of(l: Line) -> int:
            x = l.x0 + 1
            for i in range(ncol):
                if bounds[i] - 2 <= x < bounds[i + 1] - 1:
                    return i
            return ncol - 1

        head_lines = [l for l in lines if H - 32 < l.y1 <= H + 1 and tx0 - 2 <= l.x0 <= tx1 and not l.used
                      and "Sora" in l.font]
        # only keep the contiguous header block (stop at a gap)
        head_lines.sort(key=lambda l: -l.y1)
        hb: list[Line] = []
        for l in head_lines:
            if not hb or (min(h.y0 for h in hb) - l.y1) < 4:
                hb.append(l)
        header = [""] * ncol
        for l in sorted(hb, key=lambda l: (l.base, l.x0)):
            c = col_of(l)
            header[c] = (header[c] + " " + l.text).strip()
            l.used = True
        body = []
        edges = [H] + chain
        for a, b in zip(edges, edges[1:]):
            cells: list[list[Line]] = [[] for _ in range(ncol)]
            for l in lines:
                if not l.used and a < (l.y0 + l.y1) / 2 < b and tx0 - 2 <= l.x0 <= tx1:
                    cells[col_of(l)].append(l)
                    l.used = True
            if any(cells):
                body.append(cells)
        if not body:
            continue
        rows_html = []
        for cells in body:
            tds = []
            for ci, cl in enumerate(cells):
                cl.sort(key=lambda l: (l.base, l.x0))
                strike = bool(cl) and all(l.color == 0x8A94A0 and "Italic" in l.font for l in cl)
                r = rich_of(cl, strike=strike)
                h = r.html()
                if strike:
                    h = re.sub(r"</?em>", "", h)
                if ci == 0 and cl and all("Sora" in l.font and "Bold" in l.font for l in cl):
                    h = f"<strong>{re.sub(r'</?strong>', '', h)}</strong>" if h else h
                tds.append(f"<td>{h}</td>")
            rows_html.append("<tr>" + "".join(tds) + "</tr>")
        headers = [nice_header(h) for h in header]
        elements.append(Element(pn, H - 12, "table", {"headers": headers, "rows": rows_html}))
    return elements


def table_html(headers: list[str], rows: list[str]) -> str:
    thead = ""
    if any(headers):
        thead = "<thead><tr>" + "".join(f"<th>{esc(h)}</th>" for h in headers) + "</tr></thead>"
    return f"<table>{thead}<tbody>{''.join(rows)}</tbody></table>"


# ----------------------------------------------------------------------------- labels / boxes

LABELS = {
    "KEYIDEA": "Key idea",
    "EXAMPLEPROMPT": "Example prompt",
    "FEW-SHOTPROMPT": "Few-shot prompt",
    "EXAMPLE": "Example",
    "SAMPLEAI-USESTATEMENT": "Sample AI-use statement",
    "SAMPLEREFLECTION": "Sample reflection",
    "MODELANSWER": "Model answer",
    "MARKINGPOINTS": "Marking points",
    "ANSWERKEY": "Answer key",
}


def label_text(t: str, parts: dict) -> str:
    sq = re.sub(r"[\s›_]", "", t)
    if sq in LABELS:
        return LABELS[sq]
    m = re.match(r"PART ([A-E]) · .* · (MODULES .*)$", norm_text(t))
    if m and m.group(1) in parts:
        return f"Part {m.group(1)} · {parts[m.group(1)]['title']} · Modules {m.group(2).split(' ', 1)[1]}"
    return norm_text(t)


def is_label(l: Line) -> bool:
    if l.used:
        return False
    f, s, c = l.font, l.size, l.color
    if f == "Sora-Ultra-Bold" and s <= 7.6 and c in (0xB8520A, 0xEF6E11, 0x0E6E68, 0xB03A22, 0x8A94A0):
        return not l.text.strip().startswith("FIGURE") and len(l.text.strip()) > 2
    if f == "Sora-Ultra-Bold" and abs(s - 9.2) < 0.15 and c == 0x1B2430:  # checklist titles
        return True
    return False


# ----------------------------------------------------------------------------- flow

def body_like(l: Line) -> bool:
    return l.font.startswith("Newsreader") or l.font == "Sora"


def group_rows(lines: list[Line]) -> list[list[Line]]:
    rows: list[list[Line]] = []
    for l in sorted(lines, key=lambda l: (l.base, l.x0)):
        if rows and abs(rows[-1][0].base - l.base) < 2.2:
            rows[-1].append(l)
        else:
            rows.append([l])
    for r in rows:
        r.sort(key=lambda l: l.x0)
    return rows


def flow_elements(pn: int, lines: list[Line], markers, *, in_box: bool = False, box_right: float = 533) -> list[Element]:
    """Turn loose lines (sorted) into heading/paragraph/list elements."""
    els: list[Element] = []
    rows = group_rows([l for l in lines if not l.used])
    cur: Element | None = None
    cur_lines: list[Line] = []
    prompt_mode = in_box and any(l.font == "Sora" for r in rows for l in r)

    def flush():
        nonlocal cur, cur_lines
        if cur is not None and cur_lines:
            if prompt_mode:
                r = Rich()
                maxx = max(l.x1 for l in cur_lines)
                prev = None
                for l in cur_lines:
                    hb = prev is not None and prev.x1 < maxx - 45 and prev.text.rstrip()[-1:] in ".:?!”\"]"
                    r.add_line(l, hard_break=hb)
                    prev = l
            else:
                r = rich_of(cur_lines)
            cur.data["rich"] = r
            cur.data["x0"] = cur_lines[0].x0
            cur.data["last"] = cur_lines[-1]
            els.append(cur)
        cur, cur_lines = None, []

    for row in rows:
        first = row[0]
        txt = first.text.strip()
        # unit header: white badge "N.N" + big title
        if first.font == "Sora-Ultra-Bold" and first.color == 0xFFFFFF and re.fullmatch(r"\d+\.\d+", txt) and len(row) > 1:
            flush()
            els.append(Element(pn, first.y0, "unit", {"code": txt, "title": norm_text(row[1].text)}))
            continue
        if first.font == "Newsreader-Italic" and first.color == 0x0E6E68 and abs(first.size - 9.8) < 0.2 and not in_box:
            if els and els[-1].kind in ("unit", "objective") and cur is None:
                if els[-1].kind == "objective":
                    els[-1].data["lines"].append(first)
                else:
                    els.append(Element(pn, first.y0, "objective", {"lines": [first]}))
                continue
        if first.font == "Sora-Bold" and abs(first.size - 9.8) < 0.15 and first.color == 0x1B2430 and len(row) == 1:
            flush()
            els.append(Element(pn, first.y0, "h3", {"text": norm_text(first.text)}))
            continue
        if first.font == "Sora-Bold" and abs(first.size - 9.6) < 0.15 and first.color == 0x1B2430:
            if cur is not None and cur.kind == "h4" and first.base - cur_lines[-1].base < 16:
                cur_lines.append(first)
                continue
            flush()
            cur = Element(pn, first.y0, "h4", {})
            cur_lines = [first]
            continue
        # bullet marker
        if txt == "•" and len(row) > 1:
            flush()
            cur = Element(pn, first.y0, "li", {})
            cur_lines = row[1:]
            continue
        # drawn marker (checklist circle / numbered disc) to the left of the line
        mk = None
        for m in markers:
            if m[2] <= first.x0 + 1 and first.x0 - m[2] < 16 and m[1] - 4 <= first.base <= m[3] + 6:
                mk = m
                break
        numtxt = re.fullmatch(r"\d{1,2}", txt)
        if numtxt and first.font == "Sora-Ultra-Bold" and len(row) > 1:
            flush()
            cur = Element(pn, first.y0, "oli", {})
            cur_lines = row[1:]
            continue
        if mk is not None:
            flush()
            cur = Element(pn, first.y0, "li", {"check": True})
            cur_lines = list(row)
            continue
        # continuation of current block?
        if cur is not None and cur.kind in ("p", "li", "oli", "h4") and cur.kind != "h4":
            prevl = cur_lines[-1]
            gap = first.base - prevl.base
            same_x = abs(first.x0 - cur_lines[0].x0) < 3 or (cur.kind in ("li", "oli") and abs(first.x0 - prevl.x0) < 3)
            if same_x and 0 < gap < max(17.6, prevl.size * 1.62):
                cur_lines.extend(row)
                continue
        flush()
        if cur is None:
            cur = Element(pn, first.y0, "p", {})
            cur_lines = list(row)
    flush()
    return els


# ----------------------------------------------------------------------------- hand-written figure equivalents

FIGURES: dict[str, str] = {
    "1.1": (
        "<ul><li><strong>Artificial intelligence</strong>: any technique that lets computers perform tasks associated with human intelligence, including hand-written rules"
        "<ul><li><strong>Machine learning</strong>: systems that learn patterns from data instead of following rules written by people"
        "<ul><li><strong>Deep learning</strong>: machine learning with many-layered neural networks"
        "<ul><li><strong>Generative AI</strong>: deep learning used to create new text, images, audio, video and code</li></ul>"
        "</li></ul></li></ul></li></ul>"
    ),
    "2.1": (
        "<table><thead><tr><th>Year</th><th>Milestone</th></tr></thead><tbody>"
        "<tr><td><strong>1950</strong></td><td>Turing’s paper</td></tr>"
        "<tr><td><strong>1956</strong></td><td>Dartmouth</td></tr>"
        "<tr><td><strong>1966</strong></td><td>ELIZA</td></tr>"
        "<tr><td><em>1970s</em></td><td><em>AI winter</em></td></tr>"
        "<tr><td><strong>1980s</strong></td><td>Expert systems</td></tr>"
        "<tr><td><em>Late 1980s</em></td><td><em>AI winter</em></td></tr>"
        "<tr><td><strong>1997</strong></td><td>Deep Blue</td></tr>"
        "<tr><td><strong>2012</strong></td><td>Deep learning</td></tr>"
        "<tr><td><strong>2016</strong></td><td>AlphaGo</td></tr>"
        "<tr><td><strong>2017</strong></td><td>Transformer</td></tr>"
        "<tr><td><strong>2022</strong></td><td>ChatGPT</td></tr>"
        "</tbody></table>"
    ),
    "2.2": (
        "<ul><li><strong>Data</strong>: internet, smartphones</li>"
        "<li><strong>Computing power</strong>: GPUs, cloud</li>"
        "<li><strong>Algorithms</strong>: deep learning, transformers</li>"
        "<li><strong>Investment</strong>: funding, open research</li>"
        "<li><strong>Accessibility</strong>: chat apps, free tiers</li></ul>"
        "<p>→ <strong>AI today</strong>: all five together</p>"
    ),
    "3.1": (
        "<ol><li><strong>Data</strong>: labelled examples</li>"
        "<li><strong>Training</strong>: finds patterns</li>"
        "<li><strong>Model</strong>: stored patterns</li>"
        "<li><strong>Testing</strong>: unseen examples</li>"
        "<li><strong>Prediction</strong>: new cases</li></ol>"
    ),
    "3.2": (
        "<ul><li><strong>Input layer</strong>: Attendance, Assignments, CA score</li>"
        "<li><strong>Hidden layers</strong>: two layers of four neurons each; every neuron is connected to every neuron in the next layer</li>"
        "<li><strong>Output layer</strong>: Likely to pass, At risk</li></ul>"
        "<p>The highlighted path runs from Attendance through the hidden layers to “At risk”.</p>"
    ),
    "4.1": (
        "<p><strong>Tokens so far:</strong> The · teacher · wrote · on · the · <strong>?</strong></p>"
        "<table><thead><tr><th>Likely next tokens (illustrative)</th><th>Probability</th></tr></thead><tbody>"
        "<tr><td>board</td><td>57%</td></tr><tr><td>chalkboard</td><td>19%</td></tr>"
        "<tr><td>whiteboard</td><td>12%</td></tr><tr><td>wall</td><td>4%</td></tr></tbody></table>"
    ),
    "4.2": (
        "<ol><li><strong>Pre-training</strong>: reads vast amounts of text; <em>learns language and knowledge</em></li>"
        "<li><strong>Fine-tuning</strong>: trains on example answers; <em>learns to follow instructions</em></li>"
        "<li><strong>Human feedback</strong>: people rate responses; <em>learns what is helpful and safe</em></li></ol>"
        "<p>→ <strong>Assistant</strong></p>"
    ),
    "5.1": (
        "<ol><li><strong>Prompt</strong>: ask clearly</li>"
        "<li><strong>Read</strong>: check critically</li>"
        "<li><strong>Refine</strong>: follow up</li></ol>"
        "<p>Each cycle leads to <strong>better output</strong>.</p>"
    ),
    "6.1": (
        "<table><thead><tr><th>Before: text-heavy</th><th>After: one idea, visual</th></tr></thead><tbody>"
        "<tr><td><strong>Benefits of Mobile Learning</strong><br>Eight long lines of small text fill the slide.</td>"
        "<td><strong>Phones put practice in every pocket</strong><br>A phone image beside three short points: Daily quizzes · Offline reading · Peer groups</td></tr>"
        "</tbody></table>"
    ),
    "7.1": (
        "<table><thead><tr><th>Step</th><th>What to do</th><th>If it fails</th></tr></thead><tbody>"
        "<tr><td><strong>1. Search</strong></td><td>title in Google Scholar or the library</td><td>Not found</td></tr>"
        "<tr><td><strong>2. Match</strong></td><td>authors, year, journal and pages</td><td>Not found</td></tr>"
        "<tr><td><strong>3. Open</strong></td><td>and read the relevant part</td><td>Can’t access</td></tr>"
        "<tr><td><strong>4. Confirm</strong></td><td>it supports your claim</td><td>Doesn’t support</td></tr>"
        "</tbody></table>"
        "<p>All four steps pass → <strong>Cite</strong>. <strong>Any failure: do not cite it. Find a real source for the claim.</strong></p>"
    ),
    "8.1": (
        "<ul><li><strong>Problems</strong>: repeated frustrations</li>"
        "<li><strong>Changes</strong>: new policies, habits, events</li>"
        "<li><strong>Gaps</strong>: needs others ignore</li>"
        "<li><strong>New technology</strong>: what is now possible or cheap</li></ul>"
        "<p>All four lead to an <strong>opportunity</strong>.</p>"
    ),
    "9.1": (
        "<ol><li><strong>Empathise</strong></li><li><strong>Define</strong></li><li><strong>Ideate</strong></li>"
        "<li><strong>Prototype</strong></li><li><strong>Test</strong></li></ol>"
        "<p><em>Testing often sends you back to an earlier stage.</em></p>"
    ),
    "10.1": (
        "<ol><li><strong>Data</strong> ⚠: groups under-represented; past unfairness recorded</li>"
        "<li><strong>Design</strong> ⚠: choices of what to predict and which features to use</li>"
        "<li><strong>Deployment</strong> ⚠: used in a new context; outputs trusted too much</li></ol>"
        "<p>→ <strong>Unfair outcomes</strong></p>"
    ),
    "11.1": (
        "<table><thead><tr><th>Not permitted</th><th>Permitted with disclosure</th><th>Freely permitted</th></tr></thead><tbody>"
        "<tr><td>Examinations and tests</td><td>Brainstorming; outlining</td><td>Practising with an AI tutor</td></tr>"
        "<tr><td>Tasks that state “no AI”</td><td>Grammar feedback on your draft</td><td>Self-quizzing on your notes</td></tr>"
        "</tbody></table>"
        "<p><em>Typical examples only. The rules for each course and task decide.</em></p>"
    ),
    "13.1": (
        "<p>More AI ← → More human</p>"
        "<table><thead><tr><th>Automate</th><th>Augment</th><th>Human-led</th></tr></thead><tbody>"
        "<tr><td>Transcribing a recording</td><td>Drafting lesson notes</td><td>Comforting a distressed learner</td></tr>"
        "<tr><td>Formatting a reference list</td><td>Differentiating a worksheet</td><td>Managing a classroom</td></tr>"
        "<tr><td>Marking multiple-choice tests</td><td>Analysing class results</td><td>Meeting a worried parent</td></tr>"
        "</tbody></table>"
    ),
}


def caption_html(lines: list[Line]) -> tuple[str, str]:
    t = join_plain(lines)
    m = re.match(r"FIGURE\s+(\d+\.\d+)\s*(.*)$", t)
    assert m, t
    return m.group(1), f"<p><em><strong>Figure {m.group(1)}</strong> {esc(m.group(2))}</em></p>"


def flow_style(l: Line) -> bool:
    """Lines that belong to the running text (used to find where a figure starts)."""
    if l.x0 > LEFT + 1.5 and not (l.text.strip() == "•"):
        return False
    if l.font in ("Newsreader", "Newsreader-Bold", "Newsreader-Italic") and l.size >= 9.9 and l.color == 0x1B2430:
        return True
    if l.font == "Sora-Bold" and abs(l.size - 9.8) < 0.15 and l.color == 0x1B2430:
        return True
    return False


MEDIA_DIRS = [os.path.join(HERE, "..", "..", "..", "apps", app, "public", "course-media", "aiie111") for app in ("student", "admin")]
MEDIA_URL = "/course-media/aiie111"
FIGURE_SCALE = 2.5
FIGURE_MAX_W = 1600

FIGURE_ALT = {
    "1.1": "Four nested boxes: artificial intelligence contains machine learning, which contains deep learning, which contains generative AI.",
    "2.1": "Timeline of AI milestones from Turing's 1950 paper to ChatGPT in 2022, with the two AI winters shaded.",
    "2.2": "Five factors — data, computing power, algorithms, investment and accessibility — with arrows converging on 'AI today'.",
    "3.1": "Flow diagram: data, training, model, testing, prediction, with the model step highlighted.",
    "3.2": "Small neural network with three inputs (attendance, assignments, CA score), two hidden layers and outputs 'likely to pass' and 'at risk'; one path is highlighted.",
    "4.1": "The tokens 'The teacher wrote on the' followed by a question mark, and a bar chart of likely next tokens: board 57%, chalkboard 19%, whiteboard 12%, wall 4%.",
    "4.2": "Three training stages — pre-training, fine-tuning, human feedback — leading to an assistant.",
    "5.1": "A cycle of three circles: prompt (ask clearly), read (check critically) and refine (follow up), around 'better output'.",
    "6.1": "Two slides side by side: a text-heavy slide titled 'Benefits of Mobile Learning' and a clear slide 'Phones put practice in every pocket' with a phone image and three short points.",
    "7.1": "Four steps to check a reference — search, match, open, confirm — leading to 'cite', with a failure under each step: do not cite it.",
    "8.1": "Four boxes — problems, changes, gaps, new technology — connected to a central 'opportunity' circle.",
    "9.1": "Five circles in a row — empathise, define, ideate, prototype, test — with a dashed arrow from test back to define.",
    "10.1": "Three warning-marked stages — data, design, deployment — leading to 'unfair outcomes'.",
    "11.1": "Three columns: not permitted, permitted with disclosure, freely permitted, each with two example uses of AI.",
    "13.1": "A scale from 'more AI' to 'more human' with three groups of teacher tasks: automate, augment and human-led.",
}


def crop_figure(doc, pn: int, top: float, cap: Line, num: str) -> tuple[str, int, int]:
    """Render the figure's drawing region (between the text above and the caption) to an optimised PNG."""
    from PIL import Image, ImageChops
    import io
    page = doc[pn - 1]
    y_min, y_max = top + 1, cap.y0 - 2
    boxes = []
    for d in page.get_drawings():
        r = d["rect"]
        if r.y1 < y_min or r.y0 > y_max or r.width > 560:
            continue
        if r.y0 >= y_max - 8 or (r.height < 2 and r.width > 300):  # rule above the caption
            continue
        boxes.append((max(r.x0, 40), max(r.y0, y_min), min(r.x1, 555), min(r.y1, y_max)))
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            x0, y0, x1, y1 = l["bbox"]
            if y0 >= y_min - 1 and y1 <= y_max + 1:
                boxes.append((x0, y0, x1, y1))
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    pad = 4
    rules = [d["rect"].y0 for d in page.get_drawings() if y_min < d["rect"].y0 < cap.y0 and d["rect"].y0 >= y_max - 8]
    bottom = min([y_max] + [ry - 0.5 for ry in rules])
    clip = pymupdf.Rect(x0 - pad, max(y_min, y0 - pad), x1 + pad, min(bottom, y1 + pad))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(FIGURE_SCALE, FIGURE_SCALE), clip=clip, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    # trim surrounding white space, keep a small margin
    bg = Image.new("RGB", img.size, (255, 255, 255))
    bbox = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        m = 12
        img = img.crop((max(0, bbox[0] - m), max(0, bbox[1] - m), min(img.width, bbox[2] + m), min(img.height, bbox[3] + m)))
    if img.width > FIGURE_MAX_W:
        img = img.resize((FIGURE_MAX_W, round(img.height * FIGURE_MAX_W / img.width)), Image.LANCZOS)
    q = img.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    name = f"figure-{num.replace('.', '-')}.png"
    buf = io.BytesIO()
    q.save(buf, "PNG", optimize=True)
    for d in MEDIA_DIRS:
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, name), "wb") as f:
            f.write(buf.getvalue())
    print(f"  figure {num}: {name} {img.width}x{img.height} {len(buf.getvalue()) // 1024} KB")
    return name, img.width, img.height


def find_figures(doc, pn: int, lines: list[Line]) -> list[Element]:
    els = []
    caps = [l for l in lines if l.text.strip().startswith("FIGURE") and l.spans[0].font == "Sora-Ultra-Bold"]
    for cap in caps:
        num, _ = caption_html([cap])
        above = [l for l in lines if l.y1 <= cap.y0 + 0.5 and flow_style(l)]
        top = max([l.y1 for l in above], default=HEADER_MAX_Y)
        for l in lines:
            if top < (l.y0 + l.y1) / 2 <= cap.y1 + 0.5:
                l.used = True
        if num not in FIGURES or num not in FIGURE_ALT:
            raise SystemExit(f"No hand-written equivalent / alt text for Figure {num}")
        name, w, h = crop_figure(doc, pn, top, cap, num)
        text = re.match(r"FIGURE\s+\d+\.\d+\s*(.*)$", join_plain([cap])).group(1)
        html = (f'<figure><img src="{MEDIA_URL}/{name}" alt="{_html.escape(FIGURE_ALT[num])}" loading="lazy" width="{w}" height="{h}">'
                f"<figcaption><strong>Figure {num}</strong> {esc(text)}</figcaption></figure>"
                f"<details><summary>Text version of Figure {num}</summary>{FIGURES[num]}</details>")
        els.append(Element(pn, top + 0.1, "html", {"html": html, "figure": num}))
    return els


# ----------------------------------------------------------------------------- widgets (side-by-side layouts)

def lines_in(lines, y0, y1, x0=0, x1=600):
    return [l for l in lines if y0 <= (l.y0 + l.y1) / 2 <= y1 and x0 <= l.x0 < x1]


def w_vague_specific(lines):
    left = [l for l in lines if l.x0 < 230 and l.font != "Sora-Ultra-Bold"]
    right = [l for l in lines if l.x0 > 260 and l.font != "Sora-Ultra-Bold"]
    return ("<table><thead><tr><th>Vague</th><th>Specific</th></tr></thead><tbody><tr>"
            f"<td>{rich_of(left).html()}</td><td>{rich_of(right).html()}</td></tr></tbody></table>")


def w_label_value(lines, *, label_max_x, title=None, headers=None):
    """Rows of SMALL-CAPS LABEL + text to its right (component tags, portfolio entry)."""
    labels = sorted([l for l in lines if l.x0 < label_max_x and "Ultra" in l.font and l.size < 7.5], key=lambda l: l.base)
    vals = [l for l in lines if l.x0 >= label_max_x]
    rows = []
    for i, lab in enumerate(labels):
        top = lab.y0 - 6
        bot = labels[i + 1].y0 - 6 if i + 1 < len(labels) else 10_000
        v = [l for l in vals if top <= (l.y0 + l.y1) / 2 < bot]
        v.sort(key=lambda l: l.base)
        rows.append(f"<tr><td><strong>{esc(nice_header(lab.text))}</strong></td><td>{rich_of(v).html()}</td></tr>")
    thead = f"<thead><tr><th>{esc(headers[0])}</th><th>{esc(headers[1])}</th></tr></thead>" if headers else ""
    t = f"<table>{thead}<tbody>{''.join(rows)}</tbody></table>"
    if title:
        t = f"<p><strong>{esc(title)}</strong></p>" + t
    return t


def w_components(lines):
    return w_label_value(lines, label_max_x=150, headers=["Component", "Prompt text"])


def w_portfolio(lines):
    title = [l for l in lines if l.font == "Sora-Ultra-Bold" and l.size > 9]
    rest = [l for l in lines if l not in title]
    return "<blockquote>" + w_label_value(rest, label_max_x=140, title=join_plain(title)) + "</blockquote>"


def w_chat(lines):
    labels = sorted([l for l in lines if "Ultra" in l.font and l.size < 7], key=lambda l: l.base)
    out = []
    for i, lab in enumerate(labels):
        bot = labels[i + 1].y0 - 2 if i + 1 < len(labels) else 10_000
        v = sorted([l for l in lines if l not in labels and lab.y1 - 1 <= l.y0 < bot], key=lambda l: l.base)
        who = "You" if lab.text.strip() == "YOU" else "AI"
        out.append(f"<p><strong>{who}:</strong> {rich_of(v).html()}</p>")
    return "<blockquote>" + "".join(out) + "</blockquote>"


def w_two_col_labelled(lines, split=300):
    cols = []
    for side in (lambda l: l.x0 < split, lambda l: l.x0 >= split):
        ls = sorted([l for l in lines if side(l)], key=lambda l: l.base)
        lab = [l for l in ls if "Ultra" in l.font]
        txt = [l for l in ls if l not in lab]
        cols.append((nice_header(join_plain(lab)), rich_of(txt).html()))
    return ("<table><thead><tr>" + "".join(f"<th>{esc(c[0])}</th>" for c in cols) + "</tr></thead><tbody><tr>"
            + "".join(f"<td>{c[1]}</td>" for c in cols) + "</tr></tbody></table>")


def w_empathy(lines):
    quads = []
    for (ya, yb) in ((480, 560), (560, 620)):
        row = []
        for side in (lambda l: l.x0 < 300, lambda l: l.x0 >= 300):
            ls = sorted([l for l in lines if side(l) and ya <= l.y0 < yb], key=lambda l: l.base)
            lab = [l for l in ls if "Ultra" in l.font]
            txt = [l for l in ls if l not in lab]
            row.append(f"<td><strong>{esc(nice_header(join_plain(lab)))}</strong><br>{rich_of(txt).html()}</td>")
        quads.append("<tr>" + "".join(row) + "</tr>")
    return "<table><tbody>" + "".join(quads) + "</tbody></table>"


def w_spreadsheet(lines):
    cols = ["", "A", "B", "C", "D", "E"]
    xs = [70, 95, 180, 275, 385, 450, 600]
    grid_lines = [l for l in lines if l.y0 > 245 and l.y0 < 362]
    rows: dict[int, list[str]] = {}
    for r in group_rows(grid_lines):
        cells = [""] * 6
        for l in r:
            for i in range(6):
                if xs[i] <= l.x0 < xs[i + 1]:
                    cells[i] = esc(norm_text(l.text))
        rows[len(rows)] = cells
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" if i else f"<td><strong>{c}</strong></td>" for i, c in enumerate(cells)) + "</tr>" for cells in rows.values())
    t = "<table><thead><tr>" + "".join(f"<th>{c}</th>" for c in cols) + f"</tr></thead><tbody>{body}</tbody></table>"
    f = "<p>Formulas: <code>D2 =B2+C2</code> · <code>E2 =IF(D2&gt;=40,\"Pass\",\"Fail\")</code> · <code>D6 =AVERAGE(D2:D5)</code></p>"
    return t + f


def w_formula(lines):
    return f"<blockquote><p><strong>{esc(join_plain(lines))}</strong></p></blockquote>"


def w_steps(lines):
    items = []
    for r in group_rows(lines):
        txt = [l for l in r if not re.fullmatch(r"\d", l.text.strip())]
        items.append(f"<li>{rich_of(txt).html()}</li>")
    return "<ol>" + "".join(items) + "</ol>"


def w_habits(lines):
    xs = [60, 185, 305, 425, 600]
    items = []
    for i in range(4):
        ls = sorted([l for l in lines if xs[i] <= l.x0 < xs[i + 1] and not re.fullmatch(r"\d", l.text.strip())], key=lambda l: l.base)
        title = [l for l in ls if "Sora" in l.font]
        body = [l for l in ls if l not in title]
        items.append(f"<li><strong>{esc(join_plain(title))}</strong>: {rich_of(body).html()}</li>")
    return "<ol>" + "".join(items) + "</ol>"


def w_mcq(lines):
    """15.4 Section A: numbered questions with four options in two columns + answer key."""
    nums = sorted([l for l in lines if l.font == "Sora-Ultra-Bold" and re.fullmatch(r"\d+", l.text.strip()) and l.x0 < 80],
                  key=lambda l: l.base)
    key = [l for l in lines if "ANSWER KEY" in l.text]
    key_y = key[0].y0 if key else 10_000
    items = []
    for i, n in enumerate(nums):
        top = n.y0 - 6
        bot = nums[i + 1].y0 - 6 if i + 1 < len(nums) else key_y - 2
        ls = [l for l in lines if top <= l.y0 < bot and l is not n]
        stem = sorted([l for l in ls if l.font.startswith("Sora")], key=lambda l: l.base)
        opts = [l for l in ls if l.font.startswith("Newsreader")]
        options: list[list[Line]] = []
        for col in (lambda l: l.x0 < 300, lambda l: l.x0 >= 300):
            pass
        starts = sorted([l for l in opts if re.match(r"^[A-D]\. ", l.text.strip())], key=lambda l: l.text.strip()[0])
        for s in starts:
            group = [s]
            nxt = sorted([l for l in opts if abs(l.x0 - s.x0) < 2 and l.base > s.base], key=lambda l: l.base)
            for l in nxt:
                if re.match(r"^[A-D]\. ", l.text.strip()) or l.base - group[-1].base > 16:
                    break
                group.append(l)
            options.append(group)
        opt_html = "<br>".join(rich_of(g, plain=True).html() for g in options)
        items.append(f"<li><strong>{rich_of(stem, plain=True).html()}</strong><br>{opt_html}</li>")
    out = "<ol>" + "".join(items) + "</ol>"
    if key:
        val = [l for l in lines if abs(l.base - key[0].base) < 3 and l is not key[0]]
        out += f"<blockquote><p><strong>Answer key:</strong> {esc(join_plain(val))}</p></blockquote>"
    for l in lines:
        l.used = True
    return out


# (page, y0, y1, renderer) — widgets that are laid out side by side and are not captioned figures
WIDGETS = [
    (25, 445, 525, w_vague_specific),
    (26, 322, 474, w_components),
    (28, 360, 580, w_chat),
    (32, 412, 522, w_two_col_labelled),
    (34, 228, 382, w_spreadsheet),
    (49, 485, 612, w_empathy),
    (50, 70, 96, w_formula),
    (51, 236, 334, w_steps),
    (57, 188, 280, w_habits),
    (75, 545, 760, w_portfolio),
    (83, 95, 752, w_mcq),
]


def find_widgets(pn: int, lines: list[Line]) -> list[Element]:
    els = []
    for wp, y0, y1, fn in WIDGETS:
        if wp != pn:
            continue
        ls = [l for l in lines if y0 <= (l.y0 + l.y1) / 2 <= y1 and not l.used]
        h = fn(ls)
        for l in ls:
            l.used = True
        els.append(Element(pn, y0, "html", {"html": h, "widget": fn.__name__}))
    return els


# ----------------------------------------------------------------------------- boxes

def find_boxes(doc, pn: int, lines: list[Line], parts: dict) -> list[Element]:
    fr = frames(doc, pn)
    markers = small_markers(doc, pn)
    els = []
    labels = [l for l in lines if is_label(l)]
    for lab in labels:
        if lab.used:
            continue
        cands = [f for f in fr if f[0] - 2 <= lab.x0 and lab.x1 <= f[2] + 2 and f[1] - 2 <= lab.y0 and lab.y1 <= f[3] + 2]
        if cands:
            f = min(cands, key=lambda f: (f[2] - f[0]) * (f[3] - f[1]))
            inside = [l for l in lines if not l.used and l is not lab and f[0] - 1 <= l.x0 and l.x1 <= f[2] + 2 and f[1] <= (l.y0 + l.y1) / 2 <= f[3]]
            right = f[2]
        else:
            inside = []
            prev = lab
            for l in sorted(lines, key=lambda l: l.base):
                if l.used or l is lab or l.base <= lab.base:
                    continue
                if l.x0 >= lab.x0 - 1 and l.base - prev.base < 22:
                    inside.append(l)
                    prev = l
                elif l.base - prev.base >= 22:
                    break
            right = 533
        lab.used = True
        name = label_text(lab.text, parts)
        inner = flow_elements(pn, inside, markers, in_box=True, box_right=right)
        for l in inside:
            l.used = True
        els.append(Element(pn, lab.y0 - 4, "box", {"label": name, "inner": inner,
                                                   "strong_body": lab.font == "Sora-Ultra-Bold" and name == "Key idea"}))
    # unlabeled frame at the very top of a page = continuation of a box from the previous page
    for f in fr:
        if f[1] > 75 or (f[2] - f[0]) < 300:
            continue
        inside = [l for l in lines if not l.used and f[0] - 1 <= l.x0 and l.x1 <= f[2] + 2 and f[1] <= (l.y0 + l.y1) / 2 <= f[3]]
        if inside and all(l.x0 > LEFT + 4 for l in inside):
            inner = flow_elements(pn, inside, markers, in_box=True)
            for l in inside:
                l.used = True
            els.append(Element(pn, f[1], "box", {"label": None, "inner": inner}))
    return els


# ----------------------------------------------------------------------------- rendering elements

def render_inner(els: list[Element], *, strong_body=False) -> str:
    out = []
    i = 0
    while i < len(els):
        e = els[i]
        if e.kind in ("li", "oli"):
            tag = "ul" if e.kind == "li" else "ol"
            items = []
            while i < len(els) and els[i].kind == e.kind:
                items.append(f"<li>{els[i].data['rich'].html()}</li>")
                i += 1
            out.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue
        if e.kind == "p":
            h = e.data["rich"].html()
            if strong_body:
                h = f"<strong>{re.sub(r'</?strong>', '', h)}</strong>"
            out.append(f"<p>{h}</p>")
        elif e.kind == "h4":
            out.append(f"<h4>{re.sub(r'</?strong>', '', e.data['rich'].html())}</h4>")
        elif e.kind == "h3":
            out.append(f"<h4>{esc(e.data['text'])}</h4>")
        i += 1
    return "".join(out)


def ends_sentence(t: str) -> bool:
    t = t.rstrip()
    return bool(t) and t[-1] in ".?!:”\")’;"


# ----------------------------------------------------------------------------- main

def parse_contents(doc) -> list[dict]:
    mods = []
    for pn in (2, 3):
        for row in group_rows(load_lines(doc, pn)):
            t = " ".join(l.text for l in row if l.text.strip() != ".")
            if True:
                t = re.sub(r"\s*\.?\s*\d+\s*$", "", norm_text(t)).strip()
                m = re.match(r"^M\s*ODULE\s+(\d+)\s+(.*)$", t)
                if m:
                    mods.append({"number": int(m.group(1)), "title": m.group(2).strip(), "units": []})
                    continue
                m = re.match(r"^(\d+)\.(\d+)\s+(.*)$", t)
                if m and mods:
                    mods[-1]["units"].append((f"{m.group(1)}.{m.group(2)}", m.group(3).strip()))
    return mods


def main() -> None:
    pdf = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    doc = pymupdf.open(pdf)
    contents = parse_contents(doc)
    assert len(contents) == 15, len(contents)

    parts: dict[str, dict] = {}
    course = {"code": "AIIE 111", "title": "", "description": "", "outcomes": []}
    modules: list[dict] = []
    all_els: list[Element] = []

    # cover title
    cover = load_lines(doc, 1)
    course["title"] = norm_text(" ".join(l.text for l in cover if l.size > 25))

    for pn in range(4, doc.page_count + 1):
        lines = load_lines(doc, pn)
        texts = [l.text for l in lines]
        if any(re.fullmatch(r"P\s*A\s*R\s*T\s+[A-E]", t.strip()) for t in texts):
            letter = [t.strip()[-1] for t in texts if re.fullmatch(r"P\s*A\s*R\s*T\s+[A-E]", t.strip())][0]
            title = join_plain([l for l in lines if 29 <= l.size <= 31])
            summary = join_plain([l for l in lines if l.font == "Newsreader" and abs(l.size - 12) < 0.3])
            parts[letter] = {"letter": letter, "title": title, "summary": summary, "modules": []}
            continue
        if pn == 4:
            about_i = next(i for i, l in enumerate(lines) if re.sub(r"\s", "", l.text) == "ABOUTTHISCOURSE")
            what_i = next(i for i, l in enumerate(lines) if re.sub(r"\s", "", l.text).startswith("WHATYOUWILL"))
            about = [l for l in lines[about_i + 1:what_i]]
            paras = [e.data["rich"] for e in flow_elements(pn, about, [])]
            course["description"] = "\n\n".join(norm_text(r.plain()) for r in paras)
            outs = [l for l in lines[what_i + 1:] if l.x0 > 85]
            course["outcomes"] = [norm_text(l.text) for l in sorted(outs, key=lambda l: l.base)]
            continue
        # module title page
        if any(re.sub(r"\s", "", l.text) == "MODULE" for l in lines) and any(l.size >= 49 for l in lines):
            num = int([l.text for l in lines if l.size >= 49][0])
            tag = [l.text for l in lines if l.font == "Sora-Semi-Bold" and l.color == 0x0E6E68][0]
            letter = re.match(r"Part ([A-E])", tag.strip()).group(1)
            title = join_plain([l for l in lines if abs(l.size - 23) < 0.5])
            intro = join_plain([l for l in lines if l.font == "Newsreader" and abs(l.size - 11.2) < 0.3])
            modules.append({"number": num, "title": title, "part": letter, "intro": intro, "units": []})
            parts[letter]["modules"].append(num)
            first_unit = min([l.y0 for l in lines if l.color == 0xFFFFFF and re.fullmatch(r"\d+\.\d+", l.text.strip())], default=270)
            for l in lines:
                if l.y1 < first_unit - 2:
                    l.used = True
            all_els.append(Element(pn, 0, "module", {"number": num}))
        els: list[Element] = []
        els += find_widgets(pn, lines)
        els += find_figures(doc, pn, lines)
        els += find_tables(doc, pn, lines)
        els += find_boxes(doc, pn, lines, parts)
        markers = small_markers(doc, pn)
        els += flow_elements(pn, [l for l in lines if not l.used], markers)
        leftovers = [l for l in lines if not l.used]
        els.sort(key=lambda e: e.y)
        all_els += els

    # ------------------------------------------------------------- assemble units
    by_num = {m["number"]: m for m in modules}
    unit = None
    unit_els: dict[str, list[Element]] = {}
    order: list[tuple[int, dict]] = []
    cur_mod = None
    for e in all_els:
        if e.kind == "module":
            cur_mod = by_num[e.data["number"]]
            continue
        if e.kind == "unit":
            unit = {"code": e.data["code"], "title": e.data["title"], "objective": "", "html": "", "words": 0}
            cur_mod["units"].append(unit)
            unit_els[unit["code"]] = []
            continue
        if e.kind == "objective":
            unit["objective"] = join_plain(e.data["lines"])
            continue
        if unit is None:
            continue
        unit_els[unit["code"]].append(e)

    for m in modules:
        for u in m["units"]:
            u["html"] = render_unit(unit_els[u["code"]])
            txt = re.sub(r"<[^>]+>", " ", u["html"])
            u["words"] = len(re.findall(r"[A-Za-z0-9₦][\w’'%₦.,-]*", _html.unescape(txt)))

    # ------------------------------------------------------------- checks against the contents page
    problems = []
    for cm in contents:
        m = by_num.get(cm["number"])
        if not m:
            problems.append(f"module {cm['number']} missing")
            continue
        codes = [u["code"] for u in m["units"]]
        if codes != [c for c, _ in cm["units"]]:
            problems.append(f"module {m['number']} units {codes} != contents {[c for c, _ in cm['units']]}")
        for (code, title), u in zip(cm["units"], m["units"]):
            if norm_text(title).rstrip(".") != norm_text(u["title"]).rstrip("."):
                problems.append(f"unit {code} title {u['title']!r} != contents {title!r}")
            if not u["html"] or not u["objective"]:
                problems.append(f"unit {code} empty html/objective")
    n_units = sum(len(m["units"]) for m in modules)
    if n_units != 73:
        problems.append(f"{n_units} units (expected 73)")
    if problems:
        print("\n".join(problems))
        raise SystemExit(1)

    data = {
        "course": course,
        "parts": [parts[k] for k in sorted(parts)],
        "modules": modules,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    # The course text is ~200 KB; it lives in its own file so the app only downloads it when a
    # unit is opened (aiie111-text.json, keyed by unit code). The outline stays small.
    text = {u["code"]: u["html"] for m in modules for u in m["units"]}
    outline = {**data, "modules": [{**m, "units": [{k: v for k, v in u.items() if k != "html"} for u in m["units"]]} for m in modules]}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(outline, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(os.path.join(os.path.dirname(out_path), "aiie111-text.json"), "w", encoding="utf-8") as f:
        json.dump(text, f, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {out_path}: {len(parts)} parts, {len(modules)} modules, {n_units} units, "
          f"{sum(u['words'] for m in modules for u in m['units'])} words")


def render_unit(els: list[Element]) -> str:
    # merge across page breaks: paragraph / list item split by a page, tables continued
    merged: list[Element] = []
    for e in els:
        if merged:
            p = merged[-1]
            if e.page != p.page:
                if p.kind == "p" and e.kind == "p" and not ends_sentence(p.data["rich"].plain()) and abs(e.data["x0"] - LEFT) < 2:
                    p.data["rich"].runs[-1][0] = p.data["rich"].runs[-1][0].rstrip() + " "
                    p.data["rich"].runs += e.data["rich"].runs
                    continue
                if p.kind == "li" and e.kind == "p" and abs(e.data["x0"] - p.data["x0"]) < 3 and not ends_sentence(p.data["rich"].plain()):
                    p.data["rich"].runs[-1][0] = p.data["rich"].runs[-1][0].rstrip() + " "
                    p.data["rich"].runs += e.data["rich"].runs
                    continue
                if p.kind == "table" and e.kind == "table" and p.data["headers"] == e.data["headers"]:
                    p.data["rows"] += e.data["rows"]
                    continue
                if p.kind == "box" and e.kind == "box" and e.data["label"] is None:
                    p.data["inner"] += e.data["inner"]
                    continue
        merged.append(e)
    out = []
    i = 0
    while i < len(merged):
        e = merged[i]
        k = e.kind
        if k in ("li", "oli"):
            tag = "ul" if k == "li" else "ol"
            items = []
            while i < len(merged) and merged[i].kind == k:
                items.append(f"<li>{merged[i].data['rich'].html()}</li>")
                i += 1
            out.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue
        if k == "p":
            if e.data["x0"] > LEFT + 8:  # indented example (e.g. reference formats)
                out.append(f"<blockquote><p>{e.data['rich'].html()}</p></blockquote>")
            else:
                out.append(f"<p>{e.data['rich'].html()}</p>")
        elif k == "h3":
            out.append(f"<h3>{esc(e.data['text'])}</h3>")
        elif k == "h4":
            out.append(f"<h4>{re.sub(r'</?strong>', '', e.data['rich'].html())}</h4>")
        elif k == "table":
            out.append(table_html(e.data["headers"], e.data["rows"]))
        elif k == "html":
            out.append(e.data["html"])
        elif k == "box":
            lab = e.data["label"]
            head = f"<p><strong>{esc(lab)}</strong></p>" if lab else ""
            out.append(f"<blockquote>{head}{render_inner(e.data['inner'], strong_body=e.data.get('strong_body', False))}</blockquote>")
        i += 1
    return "".join(out)


if __name__ == "__main__":
    main()
