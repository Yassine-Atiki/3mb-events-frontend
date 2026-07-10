/**
 * Category accent colors — a thin, distinctive tint used on ticket QR quiet-zones
 * so a stack of tickets is visually scannable at a glance. Keyed by category slug,
 * with a deterministic fallback for unknown categories.
 */
const CATEGORY_COLORS: Record<string, string> = {
  conference: '#6366F1', // indigo
  formation: '#3B82F6', // blue
  atelier: '#F59E0B', // amber
  salon: '#8B5CF6', // violet
  soiree: '#F43F5E', // rose
  networking: '#0EA5E9', // sky
  'sport-bien-etre': '#10B981' // emerald
};

const FALLBACK_PALETTE = ['#6366F1', '#3B82F6', '#F59E0B', '#8B5CF6', '#F43F5E', '#0EA5E9', '#10B981'];

export function categoryColor(slug: string | undefined | null): string {
  if (!slug) return '#53B29A';
  const direct = CATEGORY_COLORS[slug];
  if (direct) return direct;

  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}
