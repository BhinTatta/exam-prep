// Marks-vs-rank reference data for IIT JAM Physics.
//
// IMPORTANT — what this is and is not. The organising IITs publish score
// distributions, not a marks-to-rank sheet. This table is an approximate,
// community-compiled reconstruction (statistical reports plus self-reported
// candidate results), supplied by the site owner. It is good enough to tell a
// student "around AIR 150" versus "around AIR 900"; it is not good enough to
// tell AIR 150 from AIR 170, and nothing built on it should pretend otherwise.
//
// To add a year or correct a figure, edit this file only — the calculator, the
// result-page panel and the college list all read from here.

export const RANK_EXAM = { exam: "IIT JAM", subject: "physics", maxMarks: 100 } as const;

export type YearData = {
  year: number;
  /** How the paper was generally rated. Shown beside the year. */
  difficulty: string;
  /**
   * Anchor points, highest marks first: scoring exactly `marks` placed a
   * candidate at about `rank`. Each anchor is the bottom of one 5-mark bracket
   * from the source table (so a rank here is the worst rank in its bracket).
   * The last anchor is the lowest score that still got a rank.
   */
  anchors: { marks: number; rank: number }[];
  /** The top score that year, where it is known. Rank 1 is pinned to it. */
  topMarks?: number;
  /** Candidates who qualified, where it is known. */
  qualified?: number;
};

const table = (rows: [number, number][]) => rows.map(([marks, rank]) => ({ marks, rank }));

export const RANK_YEARS: YearData[] = [
  {
    year: 2026,
    difficulty: "Very tough",
    topMarks: 68.67,
    qualified: 4499,
    anchors: table([[65, 3], [60, 10], [55, 25], [50, 55], [45, 100], [40, 160], [35, 340], [30, 620], [25, 1150], [20, 2000], [15, 3200], [12, 4499]]),
  },
  {
    year: 2025,
    difficulty: "Tough",
    anchors: table([[65, 15], [60, 40], [55, 80], [50, 145], [45, 230], [40, 320], [35, 550], [30, 880], [25, 1450], [20, 2350], [15, 3600]]),
  },
  {
    year: 2024,
    difficulty: "Moderate to tough",
    anchors: table([[65, 35], [60, 85], [55, 160], [50, 280], [45, 450], [40, 680], [35, 1000], [30, 1450], [25, 2150], [20, 3100]]),
  },
  {
    year: 2023,
    difficulty: "Moderate",
    anchors: table([[65, 50], [60, 110], [55, 210], [50, 360], [45, 560], [40, 820], [35, 1180], [30, 1650], [25, 2400], [20, 3400]]),
  },
  {
    year: 2022,
    difficulty: "Easy to moderate",
    anchors: table([[65, 120], [60, 240], [55, 410], [50, 640], [45, 930], [40, 1300], [35, 1800], [30, 2450], [25, 3300]]),
  },
];

export const CATEGORIES = ["General", "EWS", "OBC-NCL", "SC", "ST"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Typical closing ranks for M.Sc. Physics, as a [low, high] band across recent
 * rounds and years. Approximate, from coaching-site counselling summaries.
 */
export const COLLEGE_CLOSING_RANKS: { institute: string; closing: Record<Category, [number, number]> }[] = [
  { institute: "IIT Bombay", closing: { General: [40, 55], EWS: [160, 210], "OBC-NCL": [150, 350], SC: [530, 880], ST: [1800, 2400] } },
  { institute: "IIT Kanpur", closing: { General: [110, 225], EWS: [420, 500], "OBC-NCL": [390, 490], SC: [1150, 1350], ST: [2400, 2700] } },
  { institute: "IIT Delhi", closing: { General: [140, 165], EWS: [400, 460], "OBC-NCL": [350, 435], SC: [1100, 1250], ST: [2350, 2450] } },
  { institute: "IIT Kharagpur", closing: { General: [170, 200], EWS: [450, 520], "OBC-NCL": [420, 500], SC: [1200, 1400], ST: [2500, 2800] } },
  { institute: "IIT Madras", closing: { General: [210, 230], EWS: [480, 550], "OBC-NCL": [450, 540], SC: [1300, 1500], ST: [2600, 3000] } },
  { institute: "IIT Roorkee", closing: { General: [200, 235], EWS: [490, 560], "OBC-NCL": [460, 550], SC: [1350, 1550], ST: [2700, 3100] } },
  { institute: "IIT Jodhpur", closing: { General: [550, 625], EWS: [900, 1100], "OBC-NCL": [850, 1050], SC: [2100, 2500], ST: [3500, 4200] } },
];
