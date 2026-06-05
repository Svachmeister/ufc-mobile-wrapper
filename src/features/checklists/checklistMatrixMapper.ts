import type { NativeChecklistCard } from '@/src/lib/checklists';
import { OWNED_LIKE_STATUSES } from '@/src/lib/collection';

import type {
  ChecklistCellStatus,
  SectionChecklistColumn,
  SectionChecklistRow,
} from './SectionChecklistMatrix';

type ChecklistMatrixDataInput = {
  cards: NativeChecklistCard[];
  sectionName: string;
  setName: string;
};

type ChecklistMatrixData = {
  cellCards: Record<string, NativeChecklistCard>;
  columns: SectionChecklistColumn[];
  meta: string;
  rows: SectionChecklistRow[];
  sectionName: string;
  setName: string;
};

function normalizeKeyPart(value: string | null) {
  if (!value) return '';

  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\//g, '-')
    .replace(/^-/, 'minus-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getVariation(card: NativeChecklistCard) {
  const detail = card.detail.trim();
  const [, variation] = detail.split(/\s+-\s+/, 2);

  if (variation?.trim()) return variation.trim();
  if (detail && !detail.startsWith('#') && detail !== 'Base card') return detail;
  return 'Base';
}

function getPrintRun(card: NativeChecklistCard) {
  const value = card.printRun?.trim();
  if (!value) return null;
  return value.replace(/^\//, '');
}

function getCardCode(card: NativeChecklistCard) {
  const detailNumber = card.detail.match(/^#([^\s-]+)/)?.[1] ?? null;
  return card.cardIdLabel || detailNumber || card.cardId;
}

function shortenVariationLabel(variation: string) {
  const cleaned = variation.trim();
  const lower = cleaned.toLowerCase();

  if (!cleaned || lower === 'base card') return 'Base';
  if (lower === 'refractor' || lower === 'base refractor') return lower === 'base refractor' ? 'Base Ref' : 'Ref';
  if (lower.includes('printing plate')) return 'Plate';

  const colorRefractor = cleaned.match(/^(.+?)\s+refractor$/i);
  if (colorRefractor?.[1]) return colorRefractor[1].trim();

  return cleaned
    .replace(/SuperFractor/gi, 'Superfractor')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrintRun(column: SectionChecklistColumn) {
  const source = `${column.sortLabel ?? ''} ${column.label}`;
  const match = source.match(/\/(-?\d+)/);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function isOneOfOneColumn(column: SectionChecklistColumn) {
  const source = `${column.sortLabel ?? ''} ${column.label}`.toLowerCase();
  return source.includes('superfractor') ||
    source.includes('platinum') ||
    source.includes('printing plate') ||
    source.includes('plate') ||
    /\/1(?!\d)/.test(source);
}

function getColumnSortRank(column: SectionChecklistColumn) {
  const label = column.label.toLowerCase();
  const sortLabel = (column.sortLabel ?? column.label).toLowerCase();
  const printRun = parsePrintRun(column);

  if (isOneOfOneColumn(column)) return 10000;
  if (label === 'base') return 0;
  if (label === 'ref' || label === 'base ref' || sortLabel === 'refractor' || sortLabel === 'base refractor') return 10;

  if (printRun === null) return 50;
  if (printRun <= 0) return 9000 + Math.abs(printRun);
  if (printRun <= 3) return 8000 + (3 - printRun);

  return 1000 - printRun;
}

function toMatrixStatus(status: string | null): ChecklistCellStatus {
  if (status === 'wanted') return 'wanted';
  if (status && OWNED_LIKE_STATUSES.has(status)) return 'owned';
  return null;
}

export function createMatrixColumnKey(card: NativeChecklistCard) {
  const variationKey = normalizeKeyPart(getVariation(card)) || 'base';
  const printRunKey = normalizeKeyPart(getPrintRun(card));

  return printRunKey ? `${variationKey}::${printRunKey}` : variationKey;
}

export function createMatrixColumnLabel(card: NativeChecklistCard) {
  const variation = shortenVariationLabel(getVariation(card));
  const printRun = getPrintRun(card);

  if (!printRun) return variation;
  return `${variation} /${printRun}`;
}

export function createMatrixRowKey(card: NativeChecklistCard) {
  return [
    card.setId || 'unknown-set',
    card.subset || 'unknown-subset',
    getCardCode(card),
    card.fighterName || 'Unknown fighter',
  ].map((part) => normalizeKeyPart(part)).join('::');
}

export function sortMatrixColumns(columns: SectionChecklistColumn[]) {
  return [...columns].sort((a, b) => {
    const rankCompare = getColumnSortRank(a) - getColumnSortRank(b);
    if (rankCompare !== 0) return rankCompare;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}

export function buildChecklistMatrixData({
  cards,
  sectionName,
  setName,
}: ChecklistMatrixDataInput): ChecklistMatrixData {
  const columnsByKey = new Map<string, SectionChecklistColumn>();
  const rowsByKey = new Map<string, SectionChecklistRow>();
  const cellCards: Record<string, NativeChecklistCard> = {};

  cards.forEach((card) => {
    const columnKey = createMatrixColumnKey(card);
    const rowKey = createMatrixRowKey(card);
    const cellKey = `${rowKey}::${columnKey}`;

    if (!columnsByKey.has(columnKey)) {
      columnsByKey.set(columnKey, {
        key: columnKey,
        label: createMatrixColumnLabel(card),
        sortLabel: getVariation(card),
      });
    }

    const row = rowsByKey.get(rowKey) ?? {
      cardCode: getCardCode(card),
      cells: {},
      fighterName: card.fighterName,
      key: rowKey,
    };

    if (cellCards[cellKey]) {
      console.warn('Duplicate checklist matrix cell ignored.', {
        cardId: card.cardId,
        columnKey,
        existingCardId: cellCards[cellKey].cardId,
        fighterName: card.fighterName,
        rowKey,
      });
      return;
    }

    row.cells[columnKey] = toMatrixStatus(card.status);
    rowsByKey.set(rowKey, row);
    cellCards[cellKey] = card;
  });

  const columns = sortMatrixColumns([...columnsByKey.values()]);
  const rows = [...rowsByKey.values()].sort((a, b) => {
    const codeCompare = (a.cardCode || '').localeCompare(b.cardCode || '', undefined, { numeric: true });
    if (codeCompare !== 0) return codeCompare;
    return a.fighterName.localeCompare(b.fighterName);
  });

  return {
    cellCards,
    columns,
    meta: `${rows.length} fighters · ${cards.length} cards · ${columns.length} parallels`,
    rows,
    sectionName,
    setName,
  };
}
