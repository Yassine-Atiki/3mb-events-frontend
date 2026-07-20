import * as XLSX from 'xlsx';

export interface ParsedParticipantRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  quantity: number;
  /** Optional ticket type name from the sheet (matched later). */
  ticketTypeName?: string;
  error?: string;
}

export interface ParseParticipantSpreadsheetResult {
  rows: ParsedParticipantRow[];
  validCount: number;
  errorCount: number;
}

const HEADER_ALIASES: Record<string, keyof Omit<ParsedParticipantRow, 'rowNumber' | 'error'>> = {
  prenom: 'firstName',
  'prénom': 'firstName',
  firstname: 'firstName',
  first_name: 'firstName',
  'first name': 'firstName',
  nom: 'lastName',
  lastname: 'lastName',
  last_name: 'lastName',
  'last name': 'lastName',
  name: 'lastName',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  courriel: 'email',
  telephone: 'phone',
  téléphone: 'phone',
  tel: 'phone',
  'tél': 'phone',
  phone: 'phone',
  mobile: 'phone',
  quantite: 'quantity',
  quantité: 'quantity',
  qty: 'quantity',
  quantity: 'quantity',
  billet: 'ticketTypeName',
  ticket: 'ticketTypeName',
  tickettype: 'ticketTypeName',
  'ticket type': 'ticketTypeName',
  'type de billet': 'ticketTypeName',
  'type billet': 'ticketTypeName'
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function cellString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Parse an Excel (.xlsx/.xls) or CSV file into participant rows.
 * Expected columns (FR/EN): Prénom, Nom, Email, Téléphone?, Quantité?, Billet?
 */
export async function parseParticipantSpreadsheet(file: File): Promise<ParseParticipantSpreadsheetResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });

  if (rawRows.length === 0) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  const sampleKeys = Object.keys(rawRows[0] ?? {});
  const fieldByHeader = new Map<string, keyof Omit<ParsedParticipantRow, 'rowNumber' | 'error'>>();
  for (const key of sampleKeys) {
    const normalized = normalizeHeader(key);
    const field = HEADER_ALIASES[normalized];
    if (field) fieldByHeader.set(key, field);
  }

  const hasFirst = [...fieldByHeader.values()].includes('firstName');
  const hasLast = [...fieldByHeader.values()].includes('lastName');
  const hasEmail = [...fieldByHeader.values()].includes('email');
  if (!hasFirst || !hasLast || !hasEmail) {
    throw new Error(
      'Colonnes requises manquantes. Attendu : Prénom, Nom, Email (optionnel : Téléphone, Quantité, Billet).'
    );
  }

  const rows: ParsedParticipantRow[] = rawRows.map((raw, index) => {
    const mapped: Partial<ParsedParticipantRow> = {
      rowNumber: index + 2,
      quantity: 1
    };

    for (const [header, field] of fieldByHeader.entries()) {
      const value = cellString(raw[header]);
      if (field === 'quantity') {
        const qty = Number(value.replace(',', '.'));
        mapped.quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      } else if (field === 'phone') {
        mapped.phone = value || undefined;
      } else if (field === 'ticketTypeName') {
        mapped.ticketTypeName = value || undefined;
      } else {
        mapped[field] = value;
      }
    }

    const firstName = (mapped.firstName ?? '').trim();
    const lastName = (mapped.lastName ?? '').trim();
    const email = (mapped.email ?? '').trim().toLowerCase();
    const quantity = mapped.quantity && mapped.quantity > 0 ? mapped.quantity : 1;

    let error: string | undefined;
    if (!firstName || !lastName || !email) {
      error = 'Prénom, nom et e-mail sont obligatoires.';
    } else if (!isValidEmail(email)) {
      error = 'E-mail invalide.';
    }

    return {
      rowNumber: mapped.rowNumber!,
      firstName,
      lastName,
      email,
      phone: mapped.phone,
      quantity,
      ticketTypeName: mapped.ticketTypeName,
      error
    };
  });

  const validCount = rows.filter((r) => !r.error).length;
  return {
    rows,
    validCount,
    errorCount: rows.length - validCount
  };
}

/** Build and download a starter Excel template for participant import (headers only). */
export function downloadParticipantImportTemplate(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Prénom', 'Nom', 'Email', 'Téléphone', 'Quantité', 'Billet']
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');
  XLSX.writeFile(workbook, 'modele-import-participants.xlsx');
}

export interface RegistrationCsvRow {
  participantFirstName: string;
  participantLastName: string;
  participantEmail: string;
  participantPhone?: string;
  ticketTypeId: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: string;
  createdAt: string;
  checkedInAt?: string;
}

function csvEscape(value: string | number | undefined | null): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r;]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function slugifyFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

function formatCsvDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  // ASCII-only — Intl fr-FR uses narrow spaces that Excel misreads as dates (shows #####).
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Force Excel to keep the value as text instead of auto-converting to a date. */
function excelTextCell(value: string): string {
  if (!value) return '';
  return `="${value.replace(/"/g, '""')}"`;
}

/** Download the current inscriptions list as a CSV file (Excel-friendly, UTF-8 BOM). */
export function downloadRegistrationsCsv(
  registrations: RegistrationCsvRow[],
  options: {
    ticketTypeNames: Record<string, string>;
    statusLabel: (status: string) => string;
    eventTitle?: string;
  }
): void {
  const headers = [
    'Prénom',
    'Nom',
    'Email',
    'Téléphone',
    'Billet',
    'Quantité',
    'Montant',
    'Devise',
    'Statut',
    'Inscrit le',
    'Check-in'
  ];

  const lines = [
    headers.join(';'),
    ...registrations.map((row) =>
      [
        csvEscape(row.participantFirstName),
        csvEscape(row.participantLastName),
        csvEscape(row.participantEmail),
        csvEscape(row.participantPhone ?? ''),
        csvEscape(options.ticketTypeNames[row.ticketTypeId] ?? row.ticketTypeId),
        csvEscape(row.quantity),
        csvEscape(row.totalPrice),
        csvEscape(row.currency),
        csvEscape(options.statusLabel(row.status)),
        excelTextCell(formatCsvDate(row.createdAt)),
        excelTextCell(formatCsvDate(row.checkedInAt))
      ].join(';')
    )
  ];

  const content = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const titlePart = options.eventTitle ? `${slugifyFilePart(options.eventTitle)}-` : '';
  link.href = url;
  link.download = `inscriptions-${titlePart}${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function matchTicketTypeId(
  ticketTypeName: string | undefined,
  ticketTypes: { id: string; name: string; tempId?: string }[],
  fallbackId?: string
): string | null {
  if (!ticketTypeName?.trim()) {
    return fallbackId ?? null;
  }
  const normalized = normalizeHeader(ticketTypeName);
  const match = ticketTypes.find((t) => normalizeHeader(t.name) === normalized);
  if (match) return match.tempId ?? match.id;
  return fallbackId ?? null;
}

export function validateImportTicketTypes(
  rows: ParsedParticipantRow[],
  ticketTypes: { id: string; name: string }[],
  defaultTicketTypeId?: string
): ParsedParticipantRow[] {
  return rows.map((row) => {
    if (row.error) return row;
    const ticketTypeId = matchTicketTypeId(row.ticketTypeName, ticketTypes, defaultTicketTypeId);
    if (ticketTypeId) return row;
    if (row.ticketTypeName?.trim()) {
      return { ...row, error: `Billet inconnu : « ${row.ticketTypeName.trim()} »` };
    }
    return { ...row, error: 'Type de billet manquant.' };
  });
}
