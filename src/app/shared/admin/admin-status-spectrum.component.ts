import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ChartPoint } from '../../core/models';

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: '#94A3B8',
  EN_REVISION: '#F59E0B',
  PUBLIE: '#53B29A',
  COMPLET: '#6366F1',
  ANNULE: '#F43F5E',
  ARCHIVE: '#64748B'
};

@Component({
  selector: 'app-admin-status-spectrum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="space-y-4" role="img" [attr.aria-label]="ariaLabel()">
      <div class="admin-status-spectrum-track">
        @for (segment of segments(); track segment.label) {
          <div
            class="admin-status-spectrum-segment"
            [class.admin-status-spectrum-segment--live]="segment.label === 'PUBLIE'"
            [style.flex-grow]="segment.value"
            [style.background]="segment.color"
            [attr.title]="segment.displayLabel + ' · ' + segment.value"
          ></div>
        }
      </div>

      @if (variant() === 'ranked') {
        <ul class="admin-status-spectrum-rank-list">
          @for (segment of segments(); track segment.label; let i = $index) {
            <li class="admin-status-spectrum-rank-row">
              <span class="admin-status-spectrum-rank-index" aria-hidden="true">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-xs font-medium text-text-primary">{{ segment.displayLabel }}</span>
                  <span class="shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
                    <strong class="text-text-primary">{{ segment.value }}</strong>
                    · {{ segment.percent }}%
                  </span>
                </div>
                <div class="admin-status-spectrum-rank-bar" aria-hidden="true">
                  <span
                    class="admin-status-spectrum-rank-fill"
                    [style.width.%]="segment.percent"
                    [style.background]="segment.color"
                  ></span>
                </div>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (segment of segments(); track segment.label) {
            <div class="admin-status-spectrum-card" [class.admin-status-spectrum-card--live]="segment.label === 'PUBLIE'">
              <div class="admin-status-spectrum-card-row">
                <span class="admin-status-spectrum-swatch" [style.background]="segment.color" aria-hidden="true"></span>
                <span class="admin-status-spectrum-label">{{ segment.displayLabel }}</span>
              </div>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="font-mono text-xl font-semibold tabular-nums text-text-primary">{{ segment.value }}</span>
                <span class="font-mono text-xs tabular-nums text-text-secondary">{{ segment.percent }}%</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class AdminStatusSpectrumComponent {
  readonly points = input<ChartPoint[]>([]);
  readonly labelMap = input<Record<string, string>>({});
  readonly colorMap = input<Record<string, string>>({});
  readonly ariaLabel = input('Répartition par statut');
  /** cards = grid (few statuses); ranked = compact bars (many action types). */
  readonly variant = input<'cards' | 'ranked'>('cards');

  protected readonly segments = computed(() => {
    const points = this.points()
      .filter((point) => point.value > 0)
      .slice()
      .sort((a, b) => b.value - a.value);
    const total = Math.max(1, points.reduce((sum, point) => sum + point.value, 0));
    const labels = this.labelMap();
    const colors = this.colorMap();

    return points.map((point) => ({
      label: point.label,
      displayLabel: labels[point.label] ?? point.label,
      value: point.value,
      percent: Math.round((point.value / total) * 100),
      color: colors[point.label] ?? STATUS_COLORS[point.label] ?? '#94A3B8'
    }));
  });
}
