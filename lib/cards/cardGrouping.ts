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
export function sortParallels(parallels: ParallelInfo[]): ParallelInfo[] {
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

export type FighterCardRow = {
  id: string;
  set_id: string;
  subset: string;
  card_number: string;
  variation: string;
  print_run: number | null;
  is_rookie: boolean;
  set_name: string;
  set_year: number;
  set_sort_order: number;
};

export type FighterCardGroupRow = ParallelGroup & {
  subset: string;
};

export type FighterSetSection = {
  set_id: string;
  set_name: string;
  cards: FighterCardGroupRow[];
};

/**
 * Sets ordered newest year first, then sort_order, then name (same tail
 * ordering groupSetsByYear uses within a year). Within a set, cards are
 * grouped per subset (Base Set first, then alphabetical, via orderSubsets)
 * and each subset's rows are collapsed to one row per card_number via
 * groupByCardNumber — never across two different subsets, since the same
 * card_number can occur in more than one subset of the same set.
 */
export function groupFighterCards(rows: FighterCardRow[]): FighterSetSection[] {
  type SetBucket = {
    set_id: string;
    set_name: string;
    set_year: number;
    set_sort_order: number;
    rows: FighterCardRow[];
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
    const rowsBySubset = new Map<string, FighterCardRow[]>();
    for (const row of bucket.rows) {
      const list = rowsBySubset.get(row.subset);
      if (list) {
        list.push(row);
      } else {
        rowsBySubset.set(row.subset, [row]);
      }
    }

    const subsetsInOrder = orderSubsets(Array.from(rowsBySubset.keys()));
    const cards: FighterCardGroupRow[] = subsetsInOrder.flatMap((subset) =>
      groupByCardNumber(rowsBySubset.get(subset) ?? []).map((group) => ({ ...group, subset })),
    );

    return { set_id: bucket.set_id, set_name: bucket.set_name, cards };
  });
}
