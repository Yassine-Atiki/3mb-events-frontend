import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ChartPoint } from '../../core/models';

const PALETTE = [
  '#53B29A',
  '#6366F1',
  '#8B5CF6',
  '#3B82F6',
  '#0EA5E9',
  '#F59E0B',
  '#F43F5E',
  '#FB7185'
];

interface DonutSegment {
  label: string;
  value: number;
  percent: number;
  color: string;
  dash: string;
  offset: number;
}

@Component({
  selector: 'app-admin-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="flex min-w-0 flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-8">
      <div class="relative shrink-0" [style.width.px]="size" [style.height.px]="size">
        <svg [attr.width]="size" [attr.height]="size" class="block -rotate-90" role="img" [attr.aria-label]="ariaLabel()">
          <circle
            [attr.cx]="center"
            [attr.cy]="center"
            [attr.r]="radius"
            fill="none"
            stroke="#E8EDEC"
            [attr.stroke-width]="stroke"
          />
          @for (segment of segments(); track segment.label) {
            <circle
              [attr.cx]="center"
              [attr.cy]="center"
              [attr.r]="radius"
              fill="none"
              [attr.stroke]="segment.color"
              [attr.stroke-width]="stroke"
              stroke-linecap="butt"
              [attr.stroke-dasharray]="segment.dash"
              [attr.stroke-dashoffset]="segment.offset"
            />
          }
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="font-mono text-2xl font-semibold tabular-nums text-text-primary">{{ total() }}</span>
          <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Total</span>
        </div>
      </div>

      <ul class="grid w-full min-w-0 flex-1 gap-2.5">
        @for (segment of segments(); track segment.label) {
          <li class="grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center gap-x-2.5 text-sm">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="segment.color"></span>
            <span class="min-w-0 truncate text-text-secondary">{{ segment.label }}</span>
            <span class="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
              <span class="font-mono text-xs font-semibold tabular-nums text-text-primary">{{ segment.value }}</span>
              <span class="font-mono text-[10px] tabular-nums text-text-secondary">{{ segment.percent }}%</span>
            </span>
          </li>
        }
      </ul>
    </div>
  `
})
export class AdminDonutChartComponent {
  readonly points = input<ChartPoint[]>([]);
  readonly ariaLabel = input('Répartition par catégorie');

  protected readonly size = 188;
  protected readonly stroke = 28;
  protected readonly center = this.size / 2;
  protected readonly radius = (this.size - this.stroke) / 2;
  protected readonly circumference = 2 * Math.PI * this.radius;

  protected readonly total = computed(() => this.points().reduce((sum, point) => sum + point.value, 0));

  protected readonly segments = computed<DonutSegment[]>(() => {
    const points = this.points().filter((point) => point.value > 0);
    const total = Math.max(1, points.reduce((sum, point) => sum + point.value, 0));
    let offset = 0;

    return points.map((point, index) => {
      const length = (point.value / total) * this.circumference;
      const dash = `${length} ${this.circumference - length}`;
      const segment = {
        label: point.label,
        value: point.value,
        percent: Math.round((point.value / total) * 100),
        color: PALETTE[index % PALETTE.length],
        dash,
        offset: -offset
      };
      offset += length;
      return segment;
    });
  });
}
