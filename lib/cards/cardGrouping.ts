export type SetRow = {
  id: string;
  name: string;
  year: number;
  manufacturer: string;
  sort_order: number;
};

export type SetYearGroup = {
  year: number;
  sets: SetRow[];
};

export function groupSetsByYear(sets: SetRow[]): SetYearGroup[] {
  const byYear = new Map<number, SetRow[]>();
  for (const set of sets) {
    const existing = byYear.get(set.year);
    if (existing) {
      existing.push(set);
    } else {
      byYear.set(set.year, [set]);
    }
  }

  const groups = Array.from(byYear.entries()).map(([year, yearSets]) => ({
    year,
    sets: [...yearSets].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  }));

  groups.sort((a, b) => b.year - a.year);
  return groups;
}

/** "Base Set" always leads if present; the rest are alphabetical — the ticket
 * gives no other ordering signal for subsets. */
export function orderSubsets(subsets: string[]): string[] {
  const unique = Array.from(new Set(subsets)).sort((a, b) => a.localeCompare(b));
  const baseIndex = unique.indexOf('Base Set');
  if (baseIndex > 0) {
    const [base] = unique.splice(baseIndex, 1);
    unique.unshift(base);
  }
  return unique;
}

/**
 * Natural sort on card_number: digit runs compare numerically ("2" before
 * "10"), everything else compares as text, so alphanumeric codes like
 * "RA-AP" fall in with their neighbors instead of before every plain digit.
 */
function naturalSortParts(value: string): (string | number)[] {
  const matches = value.match(/\d+|\D+/g);
  if (!matches) {
    return [value];
  }
  return matches.map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function compareCardNumbers(a: string, b: string): number {
  const partsA = naturalSortParts(a);
  const partsB = naturalSortParts(b);
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const partA = partsA[i];
    const partB = partsB[i];
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;
    if (typeof partA === 'number' && typeof partB === 'number') {
      if (partA !== partB) return partA - partB;
      continue;
    }
    const strA = String(partA);
    const strB = String(partB);
    if (strA !== strB) return strA.localeCompare(strB);
  }
  return 0;
}

export type ParallelInfo = {
  id: string;
  variation: string;
  print_run: number | null;
};

/** Largest print run first, unnumbered ahead of all numbered ones, 1/1 last. */
export function sortParallels<T extends Pick<ParallelInfo, 'print_run'>>(parallels: T[]): T[] {
  return [...parallels].sort((a, b) => {
    if (a.print_run == null && b.print_run == null) return 0;
    if (a.print_run == null) return -1;
    if (b.print_run == null) return 1;
    return b.print_run - a.print_run;
  });
}

export function parallelChipLabel(parallel: ParallelInfo): string {
  if (parallel.print_run === 1) {
    return '1/1';
  }
  if (parallel.print_run == null) {
    return parallel.variation;
  }
  return `${parallel.variation} /${parallel.print_run}`;
}

/**
 * Compact label for the list parallel line: unnumbered parallels by name
 * (a card can have several, e.g. Base and Gold), numbered ones by print run
 * only, and 1/1.
 */
export function parallelLineLabel(parallel: ParallelInfo): string {
  if (parallel.print_run === 1) {
    return '1/1';
  }
  if (parallel.print_run == null) {
    return parallel.variation;
  }
  return `/${parallel.print_run}`;
}

/**
 * Identity of a parallel across cards: each card in a subset has its own
 * cards.id per parallel, so the matrix lines its columns up on variation +
 * print run instead.
 */
export function parallelKey(parallel: Pick<ParallelInfo, 'variation' | 'print_run'>): string {
  return `${parallel.variation}|${parallel.print_run ?? ''}`;
}

export type MatrixColumn = {
  key: string;
  variation: string;
  print_run: number | null;
};

/**
 * Distinct parallels present anywhere in the subset, in the same order the
 * list chips use (sortParallels — ties keep first-seen order). Only covers
 * the pages loaded so far, so columns can appear as more pages arrive.
 */
export function matrixColumns(cards: ParallelGroup[]): MatrixColumn[] {
  const byKey = new Map<string, MatrixColumn>();
  for (const card of cards) {
    for (const parallel of card.parallels) {
      const key = parallelKey(parallel);
      if (!byKey.has(key)) {
        byKey.set(key, { key, variation: parallel.variation, print_run: parallel.print_run });
      }
    }
  }
  return sortParallels(Array.from(byKey.values()));
}

export type ParallelGroupRow = {
  id: string;
  card_number: string;
  variation: string;
  print_run: number | null;
  is_rookie: boolean;
};

export type ParallelGroup = {
  card_number: string;
  is_rookie: boolean;
  parallels: ParallelInfo[];
};

/**
 * Groups by card_number regardless of which loaded page a row came from, so
 * a card whose parallels straddle two .range() pages still merges into one
 * row once both pages have arrived (and shows a partial chip set in the
 * meantime, since rows render as pages come in). Callers must only pass rows
 * that already share one set + subset — card_number is unique within that
 * scope, not across a whole set or fighter.
 */
export function groupByCardNumber<T extends ParallelGroupRow>(rows: T[]): ParallelGroup[] {
  const byNumber = new Map<string, ParallelGroup>();

  for (const row of rows) {
    let group = byNumber.get(row.card_number);
    if (!group) {
      group = { card_number: row.card_number, is_rookie: row.is_rookie, parallels: [] };
      byNumber.set(row.card_number, group);
    }
    group.is_rookie = group.is_rookie || row.is_rookie;
    group.parallels.push({ id: row.id, variation: row.variation, print_run: row.print_run });
  }

  return Array.from(byNumber.values())
    .map((group) => ({ ...group, parallels: sortParallels(group.parallels) }))
    .sort((a, b) => compareCardNumbers(a.card_number, b.card_number));
}

export type ChecklistRow = ParallelGroupRow & {
  fighter_name: string;
};

export type ChecklistCard = ParallelGroup & {
  fighter_name: string;
};

export function groupChecklistRows(rows: ChecklistRow[]): ChecklistCard[] {
  const fighterNameByNumber = new Map<string, string>();
  for (const row of rows) {
    if (!fighterNameByNumber.has(row.card_number)) {
      fighterNameByNumber.set(row.card_number, row.fighter_name);
    }
  }

  return groupByCardNumber(rows).map((group) => ({
    ...group,
    fighter_name: fighterNameByNumber.get(group.card_number) ?? '',
  }));
}

type SetSubsetRow = ParallelGroupRow & {
  set_id: string;
  set_name: string;
  set_year: number;
  set_sort_order: number;
  subset: string;
};

type SetSubsetBucket<T> = {
  set_id: string;
  set_name: string;
  subsetsInOrder: string[];
  rowsBySubset: Map<string, T[]>;
};

/**
 * Shared by groupFighterCards and groupCollectionCards: buckets rows by set
 * (newest year first, then sort_order, then name — same tail ordering
 * groupSetsByYear uses within a year), then by subset within each set
 * (Base Set first, then alphabetical, via orderSubsets). Callers still run
 * groupByCardNumber themselves per subset, since what they attach to each
 * collapsed card row differs (e.g. Collection also wants fighter_name).
 */
function bucketRowsBySetAndSubset<T extends SetSubsetRow>(rows: T[]): SetSubsetBucket<T>[] {
  type SetBucket = {
    set_id: string;
    set_name: string;
    set_year: number;
    set_sort_order: number;
    rows: T[];
  };
  const bySet = new Map<string, SetBucket>();

  for (const row of rows) {
    let bucket = bySet.get(row.set_id);
    if (!bucket) {
      bucket = {
        set_id: row.set_id,
        set_name: row.set_name,
        set_year: row.set_year,
        set_sort_order: row.set_sort_order,
        rows: [],
      };
      bySet.set(row.set_id, bucket);
    }
    bucket.rows.push(row);
  }

  const buckets = Array.from(bySet.values()).sort(
    (a, b) => b.set_year - a.set_year || a.set_sort_order - b.set_sort_order || a.set_name.localeCompare(b.set_name),
  );

  return buckets.map((bucket) => {
    const rowsBySubset = new Map<string, T[]>();
    for (const row of bucket.rows) {
      const list = rowsBySubset.get(row.subset);
      if (list) {
        list.push(row);
      } else {
        rowsBySubset.set(row.subset, [row]);
      }
    }

    return {
      set_id: bucket.set_id,
      set_name: bucket.set_name,
      subsetsInOrder: orderSubsets(Array.from(rowsBySubset.keys())),
      rowsBySubset,
    };
  });
}

export type FighterCardRow = SetSubsetRow;

export type FighterCardGroupRow = ParallelGroup & {
  subset: string;
};

export type FighterSetSection = {
  set_id: string;
  set_name: string;
  cards: FighterCardGroupRow[];
};

export function groupFighterCards(rows: FighterCardRow[]): FighterSetSection[] {
  return bucketRowsBySetAndSubset(rows).map((bucket) => ({
    set_id: bucket.set_id,
    set_name: bucket.set_name,
    cards: bucket.subsetsInOrder.flatMap((subset) =>
      groupByCardNumber(bucket.rowsBySubset.get(subset) ?? []).map((group) => ({ ...group, subset })),
    ),
  }));
}

export type CollectionCardRow = SetSubsetRow & {
  fighter_name: string;
};

export type CollectionCardGroupRow = ParallelGroup & {
  subset: string;
  fighter_name: string;
};

export type CollectionSetSection = {
  set_id: string;
  set_name: string;
  cards: CollectionCardGroupRow[];
};

/**
 * Same set/subset bucketing as groupFighterCards, plus fighter_name
 * reattached per card_number the way groupChecklistRows does (first row
 * encountered for that number, within the current subset).
 */
export function groupCollectionCards(rows: CollectionCardRow[]): CollectionSetSection[] {
  return bucketRowsBySetAndSubset(rows).map((bucket) => ({
    set_id: bucket.set_id,
    set_name: bucket.set_name,
    cards: bucket.subsetsInOrder.flatMap((subset) => {
      const subsetRows = bucket.rowsBySubset.get(subset) ?? [];
      const fighterNameByNumber = new Map<string, string>();
      for (const row of subsetRows) {
        if (!fighterNameByNumber.has(row.card_number)) {
          fighterNameByNumber.set(row.card_number, row.fighter_name);
        }
      }
      return groupByCardNumber(subsetRows).map((group) => ({
        ...group,
        subset,
        fighter_name: fighterNameByNumber.get(group.card_number) ?? '',
      }));
    }),
  }));
}
