import { Injectable } from '@angular/core';

import { Event, Ticket } from '../../core/models';

export interface TicketPdfPayload {
  ticket: Ticket;
  event: Event;
  categoryName?: string;
  statusLabel: string;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(iso));
}

function sanitizeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

@Injectable({ providedIn: 'root' })
export class TicketPdfService {
  async download(payload: TicketPdfPayload): Promise<void> {
    const [{ default: QRCode }, { jsPDF }] = await Promise.all([import('qrcode'), import('jspdf')]);

    const qrDataUrl = await QRCode.toDataURL(payload.ticket.qrCode, { width: 280, margin: 1 });

    const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    doc.setFillColor(83, 178, 154);
    doc.rect(0, 0, pageW, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text((payload.categoryName || 'BILLET').toUpperCase(), margin, 11);

    doc.setFontSize(15);
    const titleLines = doc.splitTextToSize(payload.event.title, pageW - margin * 2) as string[];
    doc.text(titleLines.slice(0, 2), margin, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(formatDateTime(payload.event.startAt), margin, 34);

    let y = 50;
    doc.setTextColor(26, 31, 28);
    doc.setFontSize(11);
    doc.text(`Lieu : ${payload.event.city}`, margin, y);
    y += 7;
    doc.text(`Statut : ${payload.statusLabel}`, margin, y);
    y += 10;

    const qrSize = 52;
    doc.addImage(qrDataUrl, 'PNG', (pageW - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 8;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Présentez ce QR code à l'entrée de l'événement.", pageW / 2, y, { align: 'center' });
    y += 8;

    if (payload.ticket.seatLabel) {
      doc.setTextColor(26, 31, 28);
      doc.setFontSize(10);
      doc.text(`Place : ${payload.ticket.seatLabel}`, pageW / 2, y, { align: 'center' });
      y += 8;
    }

    doc.setDrawColor(230, 237, 236);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    doc.setFontSize(8);
    doc.setTextColor(26, 31, 28);
    doc.text(`Réf. billet : ${payload.ticket.id}`, margin, y);
    doc.text(`Émis le ${formatDate(payload.ticket.issuedAt)}`, pageW - margin, y, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("3MB Events — Justificatif d'inscription.", pageW / 2, pageH - 8, { align: 'center' });

    const slug = sanitizeFilename(payload.event.slug || 'evenement');
    const shortId = payload.ticket.id.slice(0, 8);
    doc.save(`billet-${slug}-${shortId}.pdf`);
  }
}
