/**
 * Helpers for dual-mode QR: opaque TKT-… codes vs public /billet?qr=…&eventId=… URLs.
 */

export function extractQrCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const qr = url.searchParams.get('qr');
    if (qr) return qr.trim();
  } catch {
    // ignore
  }
  return trimmed;
}

export function extractEventIdFromQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('eventId');
  } catch {
    return null;
  }
}

/** Build a public deep-link suitable for encoding into a QR image. */
export function buildPublicTicketUrl(
  qrCode: string,
  eventId?: string,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const base = origin.replace(/\/$/, '');
  const params = new URLSearchParams({ qr: qrCode });
  if (eventId) {
    params.set('eventId', eventId);
  }
  return `${base}/billet?${params.toString()}`;
}
