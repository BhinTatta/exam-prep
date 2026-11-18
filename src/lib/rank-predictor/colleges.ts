// Opening and closing ranks for M.Sc. Physics at every IIT, from the final
// admission round of each year (JAM 2026 round 6, 2025 round 4, 2024 the
// fifth admission list). All ranks are All India Ranks.
//
// Kept in code, not the database: it changes once a year, every visitor reads
// all of it, and it is small enough that a query would cost more than it saves.
//
// Source: compiled by the site owner from the published opening/closing rank
// lists. It is used for rough guidance only — the page says as much.
//
// ADDING A YEAR: paste that year's table into `TABLES` in the same shape — one
// line per institute: course code | General | EWS | OBC-NCL | SC | ST, each as
// "opening-closing", or "—" where no seat was offered. The parser below checks
// every line when this module loads, so a typo fails the build instead of
// quietly showing a wrong rank. Add any new institute to `INSTITUTES` first.

export const CATEGORIES = ["General", "EWS", "OBC-NCL", "SC", "ST"] as const;
export type Category = (typeof CATEGORIES)[number];

/** JAM course code → institute. Codes are stable across years; names in source tables are not. */
const INSTITUTES: Record<string, { name: string; jointPhd?: boolean }> = {
  "1207": { name: "IIT Bombay" },
  "1503": { name: "IIT Kanpur" },
  "1303": { name: "IIT Delhi" },
  "1703": { name: "IIT Madras" },
  "1805": { name: "IIT Roorkee" },
  "1403": { name: "IIT Guwahati" },
  "1604": { name: "IIT Kharagpur", jointPhd: true },
  "2103": { name: "IIT Hyderabad" },
  "2202": { name: "IIT Indore" },
  "2003": { name: "IIT Gandhinagar" },
  "2702": { name: "IIT (BHU) Varanasi" },
  "1903": { name: "IIT Bhubaneswar", jointPhd: true },
  "2303": { name: "IIT Ropar" },
  "2403": { name: "IIT Jodhpur" },
  "3103": { name: "IIT Mandi" },
  "2603": { name: "IIT (ISM) Dhanbad" },
  "2503": { name: "IIT Patna" },
  "3003": { name: "IIT Tirupati" },
  "2903": { name: "IIT Palakkad" },
  "2803": { name: "IIT Bhilai" },
  "3303": { name: "IIT Dharwad" },
  "3202": { name: "IIT Jammu" },
  "3402": { name: "IIT Goa" },
};

//            code | General  | EWS       | OBC-NCL   | SC        | ST
const TABLES: Record<number, string> = {
  2026: `
    1207 | 5-64     | 91-131    | 66-203    | 79-588    | 282-780
    1503 | 33-153   | 159-220   | 154-303   | 595-918   | 419-2804
    1303 | 2-175    | 204-441   | 218-485   | 378-859   | 306-1846
    1703 | 53-227   | 254-528   | 235-473   | 408-1282  | 1985-2259
    1805 | 156-250  | 371-569   | 365-534   | 385-1111  | 1854-2883
    1403 | 52-384   | 404-704   | 449-749   | 976-2187  | 1490-2815
    1604 | 96-409   | 515-747   | 476-868   | 1225-1990 | 2112-3644
    2103 | 191-429  | 735-866   | 454-707   | 630-1678  | 2340-3025
    2202 | 297-479  | 600-916   | 581-939   | 1375-2152 | 2949-3322
    2003 | 293-500  | 807-952   | 670-921   | 988-2257  | 2101-3042
    2702 | 354-507  | 542-723   | 591-836   | 1140-1557 | 2899-4420
    1903 | 343-577  | 1021-1200 | 787-1049  | 1879-2229 | 2866-4310
    2303 | 368-604  | 730-964   | 729-949   | 1173-2299 | 4139-5017
    2403 | 44-615   | 904-1127  | 766-1086  | 1559-2421 | 3204-4089
    3103 | 482-619  | 742-925   | 682-1299  | 924-2001  | 3279-3279
    2603 | 425-691  | 878-1131  | 738-1266  | 2485-2782 | 3858-5431
    2503 | 517-721  | 1189-1227 | 951-1290  | 2496-2630 | 4173-4412
    3003 | 642-732  | 1073-1255 | 827-1337  | 2487-2845 | 5045-5045
    2903 | 519-796  | 1267-1321 | 914-1352  | 1654-2871 | 4478-4503
    2803 | 728-825  | 1276-1393 | 929-1403  | 2480-2724 | 5254-5329
    3303 | 683-831  | 1259-1261 | 1365-1413 | 2222-2401 | 4488-4488
    3202 | 592-856  | 1171-1311 | 874-1396  | 2609-2763 | 5412-5412
    3402 | 786-876  | —         | 1344-1344 | —         | —
  `,
  2025: `
    1207 | 4-44     | 56-166    | 51-212    | 59-471    | 803-2268
    1503 | 6-114    | 249-463   | 140-367   | 497-1174  | 2589-2984
    1303 | 26-135   | 171-457   | 138-324   | 294-1107  | 831-2422
    1703 | 9-155    | 205-368   | 193-393   | 547-1323  | 1514-3263
    1805 | 131-182  | 214-465   | 342-478   | 1037-1292 | 665-3206
    1403 | 142-265  | 512-611   | 339-555   | 481-1413  | 742-3532
    1604 | 79-280   | 564-675   | 354-686   | 388-1351  | 2561-4003
    2103 | 160-310  | 514-687   | 406-701   | 1404-1546 | 3865-4180
    2003 | 187-365  | 725-809   | 477-752   | 1558-2033 | 2977-4309
    2702 | 316-409  | 561-691   | 587-748   | 706-1379  | 3321-4228
    2202 | 323-425  | 657-730   | 489-771   | 1482-1618 | 3862-3889
    2303 | 386-521  | 702-805   | 732-863   | 1653-2156 | 4362-4557
    2403 | 139-526  | 625-768   | 631-921   | 1766-2231 | 2871-4461
    3103 | 443-558  | 664-865   | 743-922   | 2277-2280 | 4706-4706
    1903 | 356-566  | 791-955   | 594-847   | 1656-1819 | 3983-4277
    2603 | 335-576  | 694-963   | 707-973   | 1472-2257 | 3850-4602
    3003 | 534-683  | 976-976   | 956-1192  | 2252-2451 | 4357-4512
    2503 | 429-684  | 827-913   | 910-1010  | 1771-2379 | 4350-4622
    2803 | 556-708  | 892-1079  | 800-1172  | 2348-2360 | 4724-4724
    2903 | 583-745  | 1164-1400 | 984-1185  | 1782-2308 | 4726-4726
    3202 | 424-759  | 1214-1273 | 1034-1210 | 2404-2552 | 4332-4332
    3303 | 716-794  | 1171-1178 | 1074-1194 | 2285-2394 | 3915-3915
  `,
  2024: `
    1207 | 1-43     | 84-167    | 44-136    | 321-588   | 159-1718
    1503 | 4-139    | 191-330   | 142-201   | 635-1296  | 2678-3441
    1303 | 25-157   | 235-280   | 171-308   | 373-1309  | 1611-2809
    1703 | 28-173   | 207-361   | 208-405   | 582-1340  | 2193-4073
    1805 | 138-232  | 279-348   | 319-402   | 1256-1394 | 2891-3066
    1604 | 78-290   | 315-516   | 333-524   | 665-1489  | 2104-4280
    1403 | 183-310  | 352-447   | 350-525   | 1206-1646 | 2035-3170
    2103 | 278-345  | 420-597   | 474-581   | 547-1726  | 4046-4202
    2702 | 166-422  | 564-731   | 528-641   | 1745-1811 | 3761-4285
    2003 | 234-438  | 491-793   | 469-661   | 1548-1955 | 2618-3650
    1903 | 317-472  | 601-701   | 604-709   | 1400-2046 | 3978-4170
    2202 | 354-476  | 672-745   | 562-719   | 1925-2076 | 2695-3576
    2403 | 446-503  | 697-826   | 755-801   | 2116-2199 | 4199-4199
    2303 | 370-554  | 702-763   | 687-773   | 2188-2304 | 4755-4756
    3103 | 432-593  | 894-992   | 821-919   | 1475-2524 | 4233-4358
    2603 | 382-644  | 828-941   | 690-837   | 1759-2356 | 4364-4590
    2503 | 505-707  | 942-1019  | 757-876   | 2304-2550 | 4163-5039
    2803 | 529-803  | 1008-1070 | 963-1026  | 2296-2768 | 4770-4787
    3003 | 326-840  | 1047-1246 | 874-977   | 2568-2807 | 4665-4665
    2903 | 486-872  | 1072-1232 | 885-1002  | 2189-2599 | 4240-4240
    3202 | 612-879  | 1058-1219 | 884-1066  | 2549-2791 | 1945-1945
  `,
  // IIT Jammu 2024 ST is as published: a single round-3 seat, lower than its
  // other years. Left in rather than smoothed over.
};

export type RankRange = { opening: number; closing: number };
export type CollegeYear = Record<Category, RankRange | null>;

export type College = {
  code: string;
  name: string;
  /** Kharagpur and Bhubaneswar admit to a Joint M.Sc.–Ph.D., not a 2-year M.Sc. */
  jointPhd: boolean;
  /** Only the years the institute offered seats. */
  years: Partial<Record<number, CollegeYear>>;
};

function parseRange(cell: string, where: string): RankRange | null {
  if (cell === "—" || cell === "-") return null;
  const m = /^(\d+)-(\d+)$/.exec(cell);
  if (!m) throw new Error(`colleges.ts ${where}: "${cell}" is not "opening-closing" or "—"`);
  const opening = Number(m[1]);
  const closing = Number(m[2]);
  if (opening > closing) throw new Error(`colleges.ts ${where}: opening ${opening} is after closing ${closing}`);
  return { opening, closing };
}

function build(): College[] {
  const byCode = new Map<string, College>();
  for (const [year, table] of Object.entries(TABLES)) {
    for (const line of table.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const cells = line.split("|").map((c) => c.trim());
      const [code, ...ranges] = cells;
      const where = `${year} ${code}`;
      const institute = INSTITUTES[code];
      if (!institute) throw new Error(`colleges.ts ${where}: unknown course code — add it to INSTITUTES`);
      if (ranges.length !== CATEGORIES.length) throw new Error(`colleges.ts ${where}: expected ${CATEGORIES.length} categories`);
      const college = byCode.get(code) ?? { code, name: institute.name, jointPhd: !!institute.jointPhd, years: {} };
      if (college.years[Number(year)]) throw new Error(`colleges.ts ${where}: listed twice`);
      college.years[Number(year)] = Object.fromEntries(
        CATEGORIES.map((category, i) => [category, parseRange(ranges[i], `${where} ${category}`)])
      ) as CollegeYear;
      byCode.set(code, college);
    }
  }
  return [...byCode.values()];
}

export const COLLEGES: College[] = build();

/** Newest first: the order the years are shown in. */
export const COLLEGE_YEARS: number[] = Object.keys(TABLES).map(Number).sort((a, b) => b - a);
