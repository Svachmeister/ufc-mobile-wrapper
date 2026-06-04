import { useState } from 'react';

import SectionChecklistMatrix, {
  type ChecklistCellStatus,
  type SectionChecklistColumn,
  type SectionChecklistRow,
} from './SectionChecklistMatrix';

const columns: SectionChecklistColumn[] = [
  { key: 'base', label: 'Base' },
  { key: 'refractor', label: 'Ref' },
  { key: 'green', label: '/99' },
  { key: 'gold', label: '/50' },
  { key: 'orange', label: '/25' },
  { key: 'black', label: '/10' },
  { key: 'red', label: '/5' },
  { key: 'superfractor', label: '1/1' },
];

const sampleRows: SectionChecklistRow[] = [
  {
    cardCode: 'CRA-01',
    cells: {
      base: 'owned',
      black: null,
      gold: null,
      green: null,
      orange: 'owned',
      red: 'wanted',
      refractor: 'wanted',
      superfractor: null,
    },
    fighterName: 'Ailin Perez',
    key: 'cra-01',
  },
  {
    cardCode: 'CRA-02',
    cells: {
      base: 'owned',
      black: null,
      gold: null,
      green: 'wanted',
      orange: null,
      red: null,
      refractor: 'owned',
      superfractor: null,
    },
    fighterName: 'Christian Duncan',
    key: 'cra-02',
  },
  {
    cardCode: 'CRA-03',
    cells: {
      base: null,
      black: 'wanted',
      gold: null,
      green: 'owned',
      orange: null,
      red: null,
      refractor: 'wanted',
      superfractor: null,
    },
    fighterName: 'Charles Jourdain',
    key: 'cra-03',
  },
  {
    cardCode: 'CRA-04',
    cells: {
      base: 'owned',
      black: null,
      gold: 'wanted',
      green: null,
      orange: null,
      red: null,
      refractor: null,
      superfractor: null,
    },
    fighterName: 'Jose Mariscal',
    key: 'cra-04',
  },
  {
    cardCode: 'CRA-05',
    cells: {
      base: 'owned',
      black: 'wanted',
      gold: 'owned',
      green: 'wanted',
      orange: null,
      red: null,
      refractor: 'owned',
      superfractor: null,
    },
    fighterName: 'Carlos Prates',
    key: 'cra-05',
  },
  {
    cardCode: 'CRA-06',
    cells: {
      base: null,
      black: null,
      gold: null,
      green: null,
      orange: 'wanted',
      red: null,
      refractor: 'owned',
      superfractor: null,
    },
    fighterName: 'Danny Barlow',
    key: 'cra-06',
  },
  {
    cardCode: 'CRA-07',
    cells: {
      base: 'owned',
      black: 'owned',
      gold: 'wanted',
      green: 'owned',
      orange: null,
      red: 'wanted',
      refractor: 'wanted',
      superfractor: null,
    },
    fighterName: 'Jiri Prochazka',
    key: 'cra-07',
  },
  {
    cardCode: 'CRA-08',
    cells: {
      base: 'owned',
      black: null,
      gold: 'wanted',
      green: 'owned',
      orange: 'wanted',
      red: 'wanted',
      refractor: 'owned',
      superfractor: null,
    },
    fighterName: 'Alex Pereira',
    key: 'cra-08',
  },
];

function getNextPreviewStatus(status: ChecklistCellStatus): ChecklistCellStatus {
  if (status === null) return 'owned';
  if (status === 'owned') return 'wanted';
  return null;
}

export default function SectionChecklistPreview() {
  const [rows, setRows] = useState(sampleRows);

  return (
    <SectionChecklistMatrix
      columns={columns}
      meta="41 fighters · 9 parallels"
      onCellPress={(rowKey, columnKey, currentStatus) => {
        setRows((currentRows) => currentRows.map((row) => (
          row.key === rowKey
            ? {
                ...row,
                cells: {
                  ...row.cells,
                  [columnKey]: getNextPreviewStatus(currentStatus),
                },
              }
            : row
        )));
      }}
      rows={rows}
      sectionName="CHROME ROOKIE AUTOGRAPHS"
      setName="Chrome Rookie Autographs · 2025 Topps Chrome UFC"
    />
  );
}
