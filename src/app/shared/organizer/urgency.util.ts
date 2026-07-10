import { Event } from '../../core/models';

export interface EventUrgency {
  event: Event;
  occupied: number;
  fillRatio: number;
  daysUntil: number;
  score: number;
}

/**
 * Same urgency logic as the public runway: soonest + least-filled first.
 * Higher score = more urgent (surfaced first).
 */
export function scoreUrgency(event: Event, occupied: number): number {
  const now = Date.now();
  const start = new Date(event.startAt).getTime();
  const daysUntil = (start - now) / 86_400_000;
  const fillRatio = event.capacity > 0 ? occupied / event.capacity : 0;

  // Past events sink to the bottom.
  if (daysUntil < 0) return -1000 + daysUntil;

  // Proximity: closer events score higher (decays over ~30 days).
  const proximity = Math.max(0, 30 - daysUntil) / 30; // 0..1
  // Emptiness: less-filled events score higher (they need selling).
  const emptiness = 1 - Math.min(1, fillRatio); // 0..1

  return proximity * 60 + emptiness * 40;
}

export function buildUrgencyList(events: Event[], occupancy: Record<string, number>): EventUrgency[] {
  const now = Date.now();
  return events
    .map((event) => {
      const occupied = occupancy[event.id] ?? 0;
      const start = new Date(event.startAt).getTime();
      return {
        event,
        occupied,
        fillRatio: event.capacity > 0 ? occupied / event.capacity : 0,
        daysUntil: (start - now) / 86_400_000,
        score: scoreUrgency(event, occupied)
      };
    })
    .sort((a, b) => b.score - a.score);
}
