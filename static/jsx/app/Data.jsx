// app/Data.jsx — demo data + formatters

const ALL_CLIENTS = [
  { id: 'dupont',   name: 'DUPONT & FILS SARL',          siren: '432 891 256', form: 'SARL', closing: '31/12', dossiers: 6, status: 'À jour' },
  { id: 'rivest',   name: 'RIVEST CONSEIL SAS',          siren: '812 503 119', form: 'SAS',  closing: '31/12', dossiers: 4, status: 'À jour' },
  { id: 'meridian', name: 'MÉRIDIAN ARCHITECTES SARL',   siren: '527 110 884', form: 'SARL', closing: '31/12', dossiers: 7, status: 'À jour' },
  { id: 'gauthier', name: 'GAUTHIER & ASSOCIÉS SCP',     siren: '391 442 067', form: 'SCP',  closing: '31/12', dossiers: 5, status: 'À jour' },
  { id: 'atlas',    name: 'ATLAS LOGISTIQUE SARL',       siren: '784 219 552', form: 'SARL', closing: '30/04', dossiers: 9, status: 'En cours' },
  { id: 'novelis',  name: 'NOVELIS SAS',                 siren: '654 332 991', form: 'SAS',  closing: '31/12', dossiers: 3, status: 'En cours' },
];

const OCR_TICKET_A = {
  vendor: 'OFFICE PRO PARIS',
  date: '15/04/2026',
  total: 124.80, ttva: 20.80, ht: 104.00,
  lines: [
    { date: '15/04/2026', label: 'Office Pro Paris — Fournitures bureau', account: '6064',   accountLabel: 'Fournitures administratives', debit: 104.00, credit: 0,      confidence: 'high' },
    { date: '15/04/2026', label: 'TVA déductible 20%',                    account: '44566',  accountLabel: 'TVA déductible biens & services', debit: 20.80,  credit: 0,      confidence: 'high' },
    { date: '15/04/2026', label: 'CB Office Pro Paris',                   account: '512100', accountLabel: 'Banque',                       debit: 0,      credit: 124.80, confidence: 'high' },
  ],
};

const OCR_TICKET_B = {
  vendor: 'LE COMPTOIR DE LYON',
  date: '12/04/2026',
  total: 67.50, ttva: 6.14, ht: 61.36,
  lines: [
    { date: '12/04/2026', label: 'Le Comptoir de Lyon — Repas client', account: '6257',   accountLabel: 'Réceptions', debit: 61.36, credit: 0,     confidence: 'high' },
    { date: '12/04/2026', label: 'TVA déductible 10%',                  account: '44566',  accountLabel: 'TVA déductible biens & services', debit: 6.14, credit: 0,     confidence: 'doubt' },
    { date: '12/04/2026', label: 'CB Le Comptoir de Lyon',              account: '512100', accountLabel: 'Banque',     debit: 0,     credit: 67.50, confidence: 'high' },
  ],
};

const OCR_HISTORY = [
  { id: 't-1014', file: 'IMG_4521.jpg',         vendor: 'OFFICE PRO PARIS',     total: 124.80,  status: 'auto',   date: '15/04/2026, 14:32' },
  { id: 't-1013', file: 'IMG_4519.jpg',         vendor: 'LE COMPTOIR DE LYON',  total: 67.50,   status: 'review', date: '15/04/2026, 11:08' },
  { id: 't-1012', file: 'IMG_4518.jpg',         vendor: 'TOTAL ÉNERGIES',       total: 78.40,   status: 'auto',   date: '15/04/2026, 09:14' },
  { id: 't-1011', file: 'scan_facture_004.pdf', vendor: 'COTRA TRANSPORTS',     total: 1240.00, status: 'auto',   date: '14/04/2026, 17:45' },
  { id: 't-1010', file: 'IMG_4516.jpg',         vendor: '— illisible —',        total: null,    status: 'fail',   date: '14/04/2026, 16:22' },
  { id: 't-1009', file: 'IMG_4515.jpg',         vendor: 'MONOPRIX 75009',       total: 23.40,   status: 'auto',   date: '14/04/2026, 11:55' },
];

window.DEMO = { ALL_CLIENTS, OCR_TICKET_A, OCR_TICKET_B, OCR_HISTORY };

window.fmtEur = (n, opts = {}) => {
  if (n == null || isNaN(n)) return '—';
  const { decimals = 2 } = opts;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n) + ' €';
};
