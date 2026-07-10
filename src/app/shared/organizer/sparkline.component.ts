import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
  <svg
    [attr.width]="width()"
    [attr.height]="height()"
    class="block overflow-visible"
    role="img"
    [attr.aria-label]="ariaLabel()"
  >
    <polyline
      [attr.points]="points()"
      fill="none"
      [attr.stroke]="color()"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    @if (values().length > 0) {
      <circle
        [attr.cx]="lastX()"
        [attr.cy]="lastY()"
        r="2.5"
        [attr.fill]="color()"
      />
    }
  </svg>
  `
})
export class SparklineComponent {
  readonly values = input<number[]>([]);
  readonly width = input(72);
  readonly height = input(28);
  readonly color = input('#53B29A');
  readonly ariaLabel = input('Tendance');

  private readonly normalized = computed(() => {
    const vals = this.values();
    if (vals.length === 0) return [];
    const max = Math.max(1, ...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    return vals.map((v) => (v - min) / range);
  });

  protected readonly points = computed(() => {
    const norm = this.normalized();
    if (norm.length === 0) return '';
    const w = this.width();
    const h = this.height();
    const pad = 2;
    const innerH = h - pad * 2;
    const step = norm.length <= 1 ? 0 : w / (norm.length - 1);
    return norm
      .map((v, i) => {
        const x = i * step;
        const y = pad + innerH - v * innerH;
        return `${x},${y}`;
      })
      .join(' ');
  });

  protected readonly lastX = computed(() => {
    const norm = this.normalized();
    if (norm.length === 0) return 0;
    const w = this.width();
    return norm.length <= 1 ? w / 2 : w;
  });

  protected readonly lastY = computed(() => {
    const norm = this.normalized();
    if (norm.length === 0) return 0;
    const h = this.height();
    const pad = 2;
    const innerH = h - pad * 2;
    const v = norm[norm.length - 1];
    return pad + innerH - v * innerH;
  });
}
