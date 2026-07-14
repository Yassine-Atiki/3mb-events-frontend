import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ChartPoint } from '../../core/models';

@Component({
  selector: 'app-admin-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <svg
      class="block h-full w-full"
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.42" />
          <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0.02" />
        </linearGradient>
        <linearGradient [attr.id]="lineGradientId" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.55" />
          <stop offset="100%" [attr.stop-color]="color()" stop-opacity="1" />
        </linearGradient>
      </defs>

      @if (areaPath()) {
        <path [attr.d]="areaPath()!" [attr.fill]="'url(#' + gradientId + ')'" />
        <path
          [attr.d]="linePath()!"
          fill="none"
          [attr.stroke]="'url(#' + lineGradientId + ')'"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        @for (node of nodes(); track node.label) {
          <circle
            [attr.cx]="node.x"
            [attr.cy]="node.y"
            r="4"
            fill="white"
            [attr.stroke]="color()"
            stroke-width="2"
          />
          @if (showLabels()) {
            <text
              [attr.x]="node.x"
              [attr.y]="height - 6"
              text-anchor="middle"
              class="admin-area-chart-label"
            >
              {{ node.shortLabel }}
            </text>
          }
        }
      }
    </svg>
  `
})
export class AdminAreaChartComponent {
  readonly points = input<ChartPoint[]>([]);
  readonly color = input('#53B29A');
  readonly ariaLabel = input('Courbe de tendance');
  /** When true, draws short month/period labels on the X-axis. */
  readonly showLabels = input(false);

  protected readonly width = 560;
  protected readonly height = 180;
  protected readonly padX = 28;
  protected readonly padY = 16;
  protected readonly labelBand = 28;

  private static nextId = 0;
  protected readonly gradientId = `admin-area-fill-${AdminAreaChartComponent.nextId}`;
  protected readonly lineGradientId = `admin-area-line-${AdminAreaChartComponent.nextId++}`;

  private readonly normalized = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return [];
    const max = Math.max(1, ...pts.map((p) => p.value));
    const min = Math.min(...pts.map((p) => p.value));
    const range = max - min || 1;
    const bottomPad = this.showLabels() ? this.padY + this.labelBand : this.padY;
    const innerW = this.width - this.padX * 2;
    const innerH = this.height - this.padY - bottomPad;
    const step = pts.length <= 1 ? 0 : innerW / (pts.length - 1);

    return pts.map((point, index) => ({
      label: point.label,
      shortLabel: shortenAxisLabel(point.label),
      value: point.value,
      x: this.padX + index * step,
      y: this.padY + innerH - ((point.value - min) / range) * innerH
    }));
  });

  protected readonly nodes = computed(() => this.normalized());

  protected readonly linePath = computed(() => this.buildLine(this.normalized(), false));
  protected readonly areaPath = computed(() => {
    const nodes = this.normalized();
    if (nodes.length === 0) return null;
    const baseline = this.height - (this.showLabels() ? this.padY + this.labelBand : this.padY);
    const line = this.buildLine(nodes, false);
    const last = nodes[nodes.length - 1];
    const first = nodes[0];
    return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  });

  private buildLine(nodes: Array<{ x: number; y: number }>, closed: boolean): string {
    if (nodes.length === 0) return '';
    if (nodes.length === 1) return `M ${nodes[0].x} ${nodes[0].y}`;

    let path = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const cx = (prev.x + curr.x) / 2;
      path += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return closed ? `${path} Z` : path;
  }
}

/** Prefer month token for axis: "Févr. 2026" → "Févr." */
function shortenAxisLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && /^\d{4}$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join(' ');
  }
  return trimmed.length > 8 ? `${trimmed.slice(0, 7)}…` : trimmed;
}
