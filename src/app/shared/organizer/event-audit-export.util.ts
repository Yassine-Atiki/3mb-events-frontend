import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

import { EventAudit } from '../../core/models';

export type EventAuditExportFormat = 'pdf' | 'excel';

function sheetFromRows(rows: (string | number)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

function phaseLabel(audit: EventAudit): string {
  return audit.phase === 'AFTER' ? 'Post-événement' : 'Pré-événement';
}

function fileSlug(audit: EventAudit): string {
  return (
    audit.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'evenement'
  );
}

function summaryRows(audit: EventAudit): (string | number)[][] {
  const rows: (string | number)[][] = [
    ['Audit événement', audit.title],
    ['Phase', phaseLabel(audit)],
    ['Début', audit.startAt],
    ['Fin', audit.endAt],
    ['Capacité', audit.capacity],
    [],
    ['Inscriptions (personnes)', audit.registeredCount],
    ['Places réservées', audit.registeredQuantity],
    ['Taux d’occupation (%)', audit.occupancyRate],
    ['Revenus collectés (MAD)', audit.revenueCollected],
    ['Liste d’attente', audit.waitlistCount],
    ['Remboursements en attente', audit.pendingRefundsCount]
  ];

  if (audit.phase === 'AFTER') {
    rows.push(
      [],
      ['Présents', audit.attendedCount],
      ['Taux de présence (%)', audit.attendanceRate],
      ['No-shows', audit.noShowCount],
      ['Taux de no-show (%)', audit.noShowRate],
      ['Revenus nets (MAD)', audit.finalRevenue],
      ['Remboursements traités (MAD)', audit.refundsProcessedAmount],
      ['Nb remboursements traités', audit.refundsProcessedCount]
    );
  }

  return rows;
}

/** Download an Excel event-audit report (before or after phase). */
export function downloadEventAuditExcel(audit: EventAudit): void {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheetFromRows(summaryRows(audit)), 'Synthèse');

  const ticketRows: (string | number)[][] = [
    ['Type de billet', 'Inscriptions', 'Places'],
    ...audit.registrationsByTicketType.map((item) => [
      item.ticketTypeName,
      item.count,
      item.quantity
    ])
  ];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(ticketRows), 'Par billet');

  if (audit.phase === 'AFTER' && audit.attendeesByTicketType.length > 0) {
    const attendeeRows: (string | number)[][] = [
      ['Type de billet', 'Présents', 'Places'],
      ...audit.attendeesByTicketType.map((item) => [
        item.ticketTypeName,
        item.count,
        item.quantity
      ])
    ];
    XLSX.utils.book_append_sheet(workbook, sheetFromRows(attendeeRows), 'Présents par billet');
  }

  const trendRows: (string | number)[][] = [
    ['Date', 'Inscriptions cumulées'],
    ...audit.registrationTrend.map((point) => [point.label, point.value])
  ];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(trendRows), 'Tendance');

  XLSX.writeFile(workbook, `audit-${fileSlug(audit)}-${audit.phase.toLowerCase()}.xlsx`);
}

/** Download a PDF event-audit report (before or after phase). */
export function downloadEventAuditPdf(audit: EventAudit): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number): void => {
    if (y + needed <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const title = (text: string): void => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(text, margin, y);
    y += 8;
  };

  const subtitle = (text: string): void => {
    ensureSpace(8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(text, margin, y);
    y += 7;
  };

  const section = (text: string): void => {
    ensureSpace(12);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 118, 110);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  const kv = (label: string, value: string | number): void => {
    ensureSpace(7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    const valueText = String(value);
    doc.text(valueText, margin + contentWidth, y, { align: 'right' });
    y += 6;
  };

  const table = (headers: string[], rows: (string | number)[][]): void => {
    if (rows.length === 0) {
      ensureSpace(7);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text('Aucune donnée', margin, y);
      y += 6;
      return;
    }

    const colCount = headers.length;
    const colWidth = contentWidth / colCount;

    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    headers.forEach((header, index) => {
      doc.text(header, margin + index * colWidth, y);
    });
    y += 2;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    for (const row of rows) {
      ensureSpace(6);
      row.forEach((cell, index) => {
        const text = String(cell);
        if (index === 0) {
          doc.text(text, margin + index * colWidth, y, { maxWidth: colWidth - 2 });
        } else {
          doc.text(text, margin + (index + 1) * colWidth - 1, y, { align: 'right' });
        }
      });
      y += 5.5;
    }
  };

  title('Audit événement');
  subtitle(`${audit.title} · ${phaseLabel(audit)}`);

  section('Synthèse');
  for (const row of summaryRows(audit)) {
    if (row.length === 0) {
      y += 2;
      continue;
    }
    kv(String(row[0]), row[1] ?? '');
  }

  section('Répartition par billet');
  table(
    ['Type de billet', 'Inscriptions', 'Places'],
    audit.registrationsByTicketType.map((item) => [item.ticketTypeName, item.count, item.quantity])
  );

  if (audit.phase === 'AFTER') {
    section('Présents par billet');
    table(
      ['Type de billet', 'Présents', 'Places'],
      audit.attendeesByTicketType.map((item) => [item.ticketTypeName, item.count, item.quantity])
    );
  }

  section('Tendance des inscriptions');
  table(
    ['Date', 'Inscriptions cumulées'],
    audit.registrationTrend.map((point) => [point.label, point.value])
  );

  doc.save(`audit-${fileSlug(audit)}-${audit.phase.toLowerCase()}.pdf`);
}

export function downloadEventAudit(audit: EventAudit, format: EventAuditExportFormat): void {
  if (format === 'pdf') {
    downloadEventAuditPdf(audit);
    return;
  }
  downloadEventAuditExcel(audit);
}
