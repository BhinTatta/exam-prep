import { COLLEGE_CLOSING_RANKS, RANK_EXAM, RANK_YEARS, type Category, type YearData } from "./data";

export type YearEstimate = {
  year: number;
  difficulty: string;
  /** Null when the score was below that year's qualifying cutoff. */
  rank: number | null;
  /** The rank band of the bracket the score falls in: [best, worst]. */
  band: [number, number] | null;
  cutoff: number;
};

export type RankPrediction = {
  marks: number;
  years: YearEstimate[];
  /** Mean of the years in which this score would have qualified. */
  average: number | null;
  /** Best and worst single-year estimate. */
  range: [number, number] | null;
  qualifiedYears: number;
};

/**
 * Ranks fall off roughly exponentially with marks, so points between two
 * anchors are placed on a straight line in log-rank, not in rank. Linear
 * interpolation would put a score halfway between "rank 10" and "rank 1000"
 * at rank 505; the real answer is nearer 100.
 */
function between(marks: number, hi: { marks: number; rank: number }, lo: { marks: number; rank: number }) {
  const t = (hi.marks - marks) / (hi.marks - lo.marks);
  return Math.exp(Math.log(hi.rank) + t * (Math.log(lo.rank) - Math.log(hi.rank)));
}

/** A rank is an estimate; printing "AIR 1,347" would claim precision the data doesn't have. */
function tidy(rank: number) {
  const step = rank < 30 ? 1 : rank < 300 ? 5 : rank < 2000 ? 10 : 50;
  return Math.max(1, Math.round(rank / step) * step);
}

export function estimateForYear(data: YearData, marks: number): YearEstimate {
  const { anchors } = data;
  const cutoff = anchors[anchors.length - 1].marks;
  const base = { year: data.year, difficulty: data.difficulty, cutoff };
  if (marks < cutoff) return { ...base, rank: null, band: null };

  const top = anchors[0];
  if (marks >= top.marks) {
    // Above the last bracket the table only says "rank 1 to N". Rank 1 is
    // pinned to the year's top score where that's known, and otherwise to full
    // marks — the one score certain to be first.
    const first = { marks: data.topMarks ?? RANK_EXAM.maxMarks, rank: 1 };
    const rank = marks >= first.marks ? 1 : between(marks, first, top);
    return { ...base, rank: tidy(rank), band: [1, top.rank] };
  }

  const i = anchors.findIndex((a) => marks >= a.marks);
  const hi = anchors[i - 1];
  const lo = anchors[i];
  return { ...base, rank: tidy(between(marks, hi, lo)), band: [hi.rank + 1, lo.rank] };
}

export function predictRank(rawMarks: number): RankPrediction {
  const marks = Math.max(0, Math.min(RANK_EXAM.maxMarks, rawMarks));
  const years = RANK_YEARS.map((y) => estimateForYear(y, marks));
  const ranks = years.flatMap((y) => (y.rank === null ? [] : [y.rank]));
  return {
    marks,
    years,
    average: ranks.length ? tidy(ranks.reduce((a, b) => a + b, 0) / ranks.length) : null,
    range: ranks.length ? [Math.min(...ranks), Math.max(...ranks)] : null,
    qualifiedYears: ranks.length,
  };
}

export type CollegeChance = "likely" | "borderline" | "unlikely";

/** Where a rank sits against each institute's usual closing band, for one category. */
export function collegeChances(rank: number, category: Category) {
  return COLLEGE_CLOSING_RANKS.map(({ institute, closing }) => {
    const [low, high] = closing[category];
    const chance: CollegeChance = rank <= low ? "likely" : rank <= high ? "borderline" : "unlikely";
    return { institute, low, high, chance };
  });
}

/** Does this paper use the scale the reference data is for? */
export function isRankable(test: { exam: string; subject: string }, maxScore: number) {
  return (
    test.exam.trim().toLowerCase() === RANK_EXAM.exam.toLowerCase() &&
    test.subject.trim().toLowerCase() === RANK_EXAM.subject &&
    Math.abs(maxScore - RANK_EXAM.maxMarks) < 0.01
  );
}

export const formatRank = (rank: number) => rank.toLocaleString("en-IN");
