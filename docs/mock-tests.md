# Mock tests

Full-length papers that signed-in students sit in an interface modelled on the
real IIT JAM computer-based test: section tabs, the five-state question
palette, Save & Next / Mark for Review, a numeric keypad for NAT questions, an
on-screen scientific calculator and a server-side clock.

This is separate from the short anonymous diagnostic under `/tests`. Different
tables, different code, nothing shared.

| Where | What |
|---|---|
| `/mock-tests` | List of published papers |
| `/mock-tests/<slug>` | Pattern, instructions, the student's past attempts, Start |
| `/mock-tests/<slug>/attempt/<id>` | The exam screen (owner only) |
| `/mock-tests/<slug>/attempt/<id>/result` | Analysis board and question review (owner and admins) |
| `/dashboard` | The student's progress: score trend, topic strength, every attempt |
| `/admin/mock-tests` | Import, publish/unpublish, delete, every student's attempts |

## Adding a paper

A paper is one JSON file in `content/mock-tests/`, plus its diagrams in
`public/mock-tests/<slug>/`. `content/mock-tests/jam-physics-demo.json` is a
working example of every question type.

```bash
# 1. validate — no database needed, reports every problem at once
npm run mock:import -- content/mock-tests/jam-physics-2025.json --check

# 2. load it as a draft (students can't see drafts; admins can open and sit them)
npm run mock:import -- content/mock-tests/jam-physics-2025.json

# 3. read it through at /admin/mock-tests, then flip the Published switch
#    (or pass --publish to step 2)
```

**Production imports itself.** Every production deploy runs the importer over
`content/mock-tests/*.json` right after migrations (`scripts/build.mjs`), so
merging a paper file to the default branch is what puts it on the live site.
Whether it is visible to students is the file's `"published"` field:

- `"published": true` — live as soon as the deploy finishes.
- left out — arrives as a draft; flip the switch at `/admin/mock-tests` when
  it has been proof-read. A later deploy leaves that switch alone.
- Note the flip side: a file that says `"published": true` re-publishes on
  every deploy, so to take such a paper down, change the file as well.

The `npm run mock:import` commands above are for your local database (they
read `DATABASE_URL` from `.env`). `/admin/mock-tests` → **Import paper** also
takes the same JSON pasted or as a file. A paper that exists only in the
database has no backup and no history, so commit the file as well.

**Editing a paper = edit the file and import it again.** The slug identifies the
paper and the question number identifies the question, so a re-import updates
rows in place and every recorded attempt stays attached. Scores already awarded
are not recomputed — if an answer key was wrong, students who sat it before the
fix keep their old score.

### Paper format

```jsonc
{
  "slug": "jam-physics-2025",          // URL and diagram folder; lowercase-with-hyphens
  "title": "IIT JAM Physics 2025",
  "exam": "IIT JAM",                   // default "IIT JAM"
  "subject": "physics",                // default "physics"
  "year": 2025,                        // optional; previous-year papers
  "description": "…",                  // optional; shown on the list and intro page
  "durationMinutes": 180,              // default 180
  "calculator": true,                  // default true
  "published": false,                  // optional; omit to leave the current state alone
  "sections": [
    {
      "name": "Section A",
      "instructions": "…",             // optional
      "questions": [ /* see below */ ]
    }
  ]
}
```

Questions:

```jsonc
// MCQ — exactly one answer
{
  "number": 1,                         // as printed on the paper; unique in the paper
  "type": "MCQ",
  "marks": 1,
  "topic": "Mechanics",                // optional; powers the topic-wise breakdown
  "prompt": "Text with $inline$ and $$display$$ LaTeX.",
  "image": "q1.png",                   // optional diagram
  "options": ["first", "second", "third", "fourth"],   // become A, B, C, D
  "answer": "B",
  "explanation": "Optional worked solution, shown after submission."
}

// MSQ — one or more answers; all-or-nothing
{ "number": 31, "type": "MSQ", "marks": 2, "prompt": "…",
  "options": ["…", "…", "…", "…"], "answer": ["A", "C"] }

// NAT — the accepted range straight from the official key, or one exact number
{ "number": 41, "type": "NAT", "marks": 1, "prompt": "…",
  "answer": { "min": 2.45, "max": 2.55 } }
{ "number": 42, "type": "NAT", "marks": 1, "prompt": "…", "answer": 5 }
```

Details that matter:

- **Negative marks** default to the JAM rule — one third of the marks on an MCQ,
  zero on MSQ and NAT. Override with `"negativeMarks": "2/3"` (a fraction
  string) or a number.
- **Options with pictures**: use objects instead of strings —
  `{ "label": "optional text", "image": "q7-a.png" }`. Ids still default to
  A, B, C…; set `"id"` to override.
- **Images**: a bare filename resolves to `public/mock-tests/<slug>/<file>`. A
  path starting with `/` or a full URL is used as-is. Figures are always shown
  on a white plate, so black-on-white crops from the PDF work in dark mode.
- **LaTeX**: `$…$` inline, `$$…$$` display, rendered by KaTeX. Inside JSON every
  backslash is doubled: `"$\\vec{F} = m\\vec{a}$"`. A literal dollar sign can't
  be written in a prompt — spell it out.
- **Order**: sections appear in file order; questions within a section in
  number order.

### From a question paper PDF and answer key

This is the usual route, and it is a job for Claude: hand over the PDF and the
official key and ask for a paper file.

1. Transcribe each question into the format above — LaTeX for all maths, section
   and marks exactly as printed.
2. Crop every figure out of the PDF into `public/mock-tests/<slug>/` (PNG at 2×
   or SVG), named by question: `q12.png`, `q12-a.png` for option figures.
3. Take answers from the **official final key**, not from solving the paper. NAT
   ranges go in exactly as the key gives them. If the key marks a question as
   "marks to all" or dropped, say so rather than guessing an answer.
4. `--check`, import as a draft, then proof-read every question at
   `/admin/mock-tests/<id>` against the PDF — that page shows each prompt
   rendered with its key. Publish only after that.

The standard JAM paper, for sanity-checking the totals the importer prints
(60 questions, 100 marks, 180 minutes):

| Section | Questions | Type | Marks each | Wrong answer |
|---|---|---|---|---|
| A | Q1–10 | MCQ | 1 | −1/3 |
| A | Q11–30 | MCQ | 2 | −2/3 |
| B | Q31–40 | MSQ | 2 | 0, no partial marks |
| C | Q41–50 | NAT | 1 | 0 |
| C | Q51–60 | NAT | 2 | 0 |

## How an attempt works

- **Starting** creates a `MockAttempt` with `deadlineAt = now + duration`. That
  timestamp is the clock. The browser countdown displays it (corrected for the
  device's clock skew); it never decides anything.
- **Answering** mirrors the real interface: an answer is recorded by Save & Next
  or Mark for Review & Next. An option clicked and then abandoned via the
  palette is not saved. "Answered & Marked for Review" is evaluated.
- **Saving**: each recorded change is pushed to `MockResponse` in the background
  and again every 20 seconds, so a refresh or a crash resumes the same paper
  with the same clock. Submit sends the complete state once more.
- **Time's up**: the browser submits at zero. If the tab was closed, the attempt
  is finalized from its saved answers the next time anything reads it (the
  intro page, the attempt page, the result page) — no cron job involved. The
  server accepts a submission up to 60 seconds late to absorb network delay;
  later than that it scores the saved answers and ignores what was sent.
- **Scoring** happens once, in `src/lib/mock-tests/scoring.ts`, and the result
  is stored on the attempt (`score`, counts, `sectionBreakdown`) and on each
  response (`isCorrect`, `marksAwarded`, `timeSpentSeconds`).
- The answer key never reaches the browser during an attempt — the exam page
  selects question columns explicitly.

## Analysis and progress

Nothing here is stored separately. The analysis board (after a paper) and the
progress dashboard are both derived on read from `MockAttempt` and
`MockResponse` by `src/lib/mock-tests/analytics.ts`, so a new chart or a changed
rule never needs a backfill.

- **Standing** ("#9 of 34, ahead of 76%") compares a score with every other
  submitted attempt at the same paper. It is hidden until at least five other
  attempts exist, because a rank among two people means nothing.
- **Topic panels** only appear for papers whose questions carry a `topic`, so tag
  topics when writing a paper file — it is what makes the analysis useful.
- On the dashboard, scores are shown as a percentage of each paper's marks so
  different papers share one axis, and topic accuracy counts only questions the
  student attempted.
- Charts live in `src/components/mock-tests/analysis/`. Correct/incorrect use
  the theme's `--success` / `--destructive`; because those two are hard to tell
  apart with red-green colour blindness, every chart that uses them also names
  or marks the outcome (the dot / cross / dash under each column).

## Rank predictor

`/rank-predictor` turns a JAM Physics score into an estimated All India Rank:
one average across the years on file, a row per year, and which IITs that
rank usually reaches. The same estimate appears on the analysis board, but
only for papers on the scale the data covers (exam "IIT JAM", subject
"physics", 100 marks) — a 21-mark demo gets no rank.

The data is in code, not the database — it changes once a year and every
visitor reads all of it:

- `src/lib/rank-predictor/data.ts` — the marks-vs-rank anchor points per year.
- `src/lib/rank-predictor/colleges.ts` — opening and closing ranks for M.Sc.
  Physics at every IIT, per category, from each year's final admission round.
  To add a year, paste its table in the same `code | General | EWS | OBC-NCL |
  SC | ST` shape. Every line is checked when the module loads, so a typo
  fails the build rather than showing a wrong rank.

The IIT list judges each year on its own: the score's estimated rank in that
year's exam against that year's closing rank. "Good chance" means it would
have got in every year the seat existed; "Borderline" means some years, or
within 15% of the closing rank; otherwise "Unlikely".

That data is approximate. IITs do not publish marks-to-rank tables; the
figures are a community reconstruction supplied by the site owner, not an
official source. Between two anchor points a rank is interpolated (on a log
scale, since ranks fall off exponentially with marks) and then rounded, so
the page says "≈ 160", never "AIR 163".

## Who can see an attempt

The student and admins. The rule lives in one function,
`canViewMockAttempt` in `src/lib/mock-tests/attempts.ts`; giving mentors access
(for example, a mentor with a booking with that student) means changing that
function and adding a page that lists the attempts they may open. Everything a
mentor would want is already stored: each answer as typed, whether it was
right, marks, time spent per question, and how the attempt ended.

## Code map

| File | Role |
|---|---|
| `prisma/schema.prisma` (`Mock*` models) | Tables |
| `src/lib/mock-tests/types.ts` | Paper file schema and validation |
| `src/lib/mock-tests/import.ts` | Paper → database (shared by script and admin) |
| `src/lib/mock-tests/scoring.ts` | The scorer |
| `src/lib/mock-tests/attempts.ts` | Finalizing, expiry, view permission |
| `src/lib/mock-tests/analytics.ts` | Analysis board and dashboard numbers |
| `src/lib/mock-tests/calculator.ts` | Calculator arithmetic |
| `src/app/mock-tests/actions.ts` | start / save progress / submit |
| `src/components/mock-tests/exam-runner.tsx` | The exam screen |
| `scripts/import-mock-test.ts` | `npm run mock:import` |
