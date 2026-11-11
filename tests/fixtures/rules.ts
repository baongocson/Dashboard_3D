// Expected examples agreed in task 01. They are not evidence of implemented algorithms.
export const csvCases = [
  {
    id: 'comma',
    input: 'id,value\n001,2\n002,\n',
    options: { delimiter: ',', header: true },
    expectedColumns: ['id', 'value'],
    expectedRows: [
      ['001', 2],
      ['002', null],
    ],
  },
  {
    id: 'bom-semicolon',
    input: '\uFEFFname;value\nAn;1\nBinh;2\n',
    options: { delimiter: ';', header: true },
    expectedColumns: ['name', 'value'],
    expectedRows: [
      ['An', 1],
      ['Binh', 2],
    ],
  },
  {
    id: 'tab-no-header',
    input: 'a\t1\nb\t2',
    options: { delimiter: '\t', header: false },
    expectedColumns: ['column_1', 'column_2'],
    expectedRows: [
      ['a', 1],
      ['b', 2],
    ],
  },
  {
    id: 'empty-versus-fields',
    input: 'a,b\n\n,\n0, \n',
    options: { delimiter: ',', header: true },
    expectedColumns: ['a', 'b'],
    expectedRows: [
      [null, null],
      [0, null],
    ],
  },
  {
    id: 'default-null-token',
    input: 'a,b,c\nNA,null,-',
    options: { delimiter: ',', header: true },
    expectedColumns: ['a', 'b', 'c'],
    expectedRows: [['NA', null, '-']],
  },
  {
    id: 'lossless-text',
    input:
      'code,big,mixed,date,ambiguous\n001,9007199254740993,1,01/02/2026,"1,234"\n002,9007199254740994,text,02/03/2026,"2,345"',
    options: { delimiter: ',', header: true },
    expectedColumns: ['code', 'big', 'mixed', 'date', 'ambiguous'],
    expectedRows: [
      ['001', '9007199254740993', '1', '01/02/2026', '1,234'],
      ['002', '9007199254740994', 'text', '02/03/2026', '2,345'],
    ],
  },
  {
    id: 'quoted-newline',
    input: 'name,value\n"line 1\nline 2",2',
    options: { delimiter: ',', header: true },
    expectedColumns: ['name', 'value'],
    expectedRows: [['line 1\nline 2', 2]],
  },
] as const;

export const csvErrorCases = [
  { id: 'bad-width', input: 'a,b\n1,2,3', outcome: 'block-import', task: '04' },
  { id: 'duplicate-header', input: 'a,a\n1,2', outcome: 'confirm-proposed-names', task: '04' },
  { id: 'empty-header', input: ',b\n1,2', outcome: 'confirm-proposed-names', task: '04' },
  { id: 'invalid-utf8', bytes: [0xc3, 0x28], outcome: 'decode-error', task: '04' },
  { id: 'oversize', bytesLength: 20_000_001, outcome: 'reject-before-parse', task: '04' },
] as const;

export const statisticsCases = {
  task: '05',
  quantile: { input: [1, 2, 3, 4], q1: 1.75, median: 2.5, q3: 3.25 },
  populationStandardDeviation: { input: [1, 2, 3], expected: Math.sqrt(2 / 3) },
  pairwisePearson: { x: [1, 2, null, 4], y: [2, 4, 6, 8], pairs: 3, coefficient: 1 },
  constantPearson: { x: [1, 1], y: [2, 3], pairs: 2, coefficient: null, reason: 'constant-column' },
  tooFewPairs: {
    x: [null, 1],
    y: [2, null],
    pairs: 0,
    coefficient: null,
    reason: 'insufficient-pairs',
  },
  iqr: { input: [0, 1, 2, 3, 100], k: 1.5, q1: 1, q3: 3, lower: -2, upper: 6, outliers: [100] },
  duplicates: {
    input: [
      [1, 'a'],
      [1, 'a'],
      [2, 'b'],
    ],
    excessRows: 1,
    keepSourceIndexes: [0, 2],
  },
} as const;

export const missingCases = {
  task: '11',
  modeTie: { input: ['b', 'a', 'a', 'b', null], chosen: 'b', tied: true },
  interpolation: { input: [null, 2, null, 6, null], expected: [null, 2, 4, 6, null] },
  forward: { input: [null, 2, null], expected: [null, 2, 2] },
  backward: { input: [null, 2, null], expected: [2, 2, null] },
  allMissing: {
    input: [null, null],
    disabled: ['mean', 'median', 'mode', 'interpolate', 'forward', 'backward'],
  },
  sortedCalculation: {
    rowIds: ['r1', 'r2', 'r3'],
    axis: [3, 1, 2],
    values: [6, 2, null],
    expectedByRow: [6, 2, 4],
    expectedOrder: ['r1', 'r2', 'r3'],
  },
  duplicateAxis: { axis: [1, 1, 2], outcome: 'require-valid-axis-or-explicit-row-order' },
} as const;

export const laterCases = [
  {
    id: 'log-domain',
    task: '14',
    input: [-1, 0, null],
    expected: { blocked: true, invalidSourceIndexes: [0] },
  },
  {
    id: 'sqrt-domain',
    task: '14',
    input: [-1, 4, null],
    expected: { blocked: true, invalidSourceIndexes: [0] },
  },
  {
    id: 'yeo-johnson-failure',
    task: '14',
    expected: { columnError: true, fallbackLambda: false, autoScale: false },
  },
  { id: 'ambiguous-date', task: '12', input: '01/02/2026', expected: { requireFormat: true } },
  {
    id: 'timezone-required',
    task: '12',
    input: '2026-11-05T10:00:00',
    expected: { requireTimezone: true },
  },
  {
    id: 'one-hot-name-collision',
    task: '15',
    input: { source: 'color', categories: ['red', 'blue'], existing: ['color__red'] },
    expected: { proposedNames: ['color__red__2', 'color__blue'], requirePreview: true },
  },
  {
    id: 'encoding-missing',
    task: '15',
    input: ['red', null],
    expected: { blockedUntilChoice: true },
  },
  {
    id: 'ordinal-order',
    task: '15',
    input: ['high', 'low', 'medium'],
    expected: { order: ['low', 'medium', 'high'], values: [2, 0, 1] },
  },
  {
    id: 'restore-stale-chart',
    task: '09',
    expected: { noRecompute: true, restoreCamera: true, restoreStableSelection: true },
  },
  {
    id: 'quota-failure',
    task: '03',
    expected: { unchangedCurrentPointer: true, noSuccess: true, noExit: true },
  },
  { id: 'lost-ack', task: '18', expected: { sameOperationId: true, duplicateVersion: false } },
  { id: 'conflict', task: '18', expected: { preserveLocal: true, overwriteServerPointer: false } },
  { id: 'expired-upload', task: '18', expected: { reuploadLocal: true, sameOperationId: true } },
  { id: 'offline-pending-logout', task: '19', expected: { blocked: true, deleteLocal: false } },
  {
    id: 'idle-and-absolute-expiry',
    task: '16',
    expected: { idleHours: 24, absoluteDays: 7, status: 'proposed' },
  },
] as const;
