import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-occupancy-arc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div
      class="relative inline-flex items-center justify-center"
      [style.width.px]="size()"
      [style.height.px]="size()"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      <svg [attr.width]="size()" [attr.height]="size()" class="block -rotate-90">
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke]="trackColor()"
          [attr.stroke-width]="stroke()"
        />
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke]="accentColor()"
          [attr.stroke-width]="stroke()"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="dashOffset()"
          class="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      @if (showLabel()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          @if (label()) {
            <span class="text-[10px] font-medium uppercase tracking-wider text-text-secondary">{{ label() }}</span>
          }
          <span
            class="font-mono font-semibold tabular-nums text-text-primary"
            [class.text-lg]="size() >= 120"
            [class.text-sm]="size() < 120"
          >
            {{ displayPercent() }}%
          </span>
          @if (showRatio()) {
            <span class="mt-0.5 font-mono text-[10px] tabular-nums text-text-secondary">
              {{ current() }} / {{ max() }}
            </span>
          }
        </div>
      }
    </div>
  `
})
export class OccupancyArcComponent {
  readonly current = input(0);
  readonly max = input(100);
  readonly size = input(160);
  readonly strokeWidth = input(8);
  readonly label = input<string | null>(null);
  readonly showLabel = input(true);
  readonly showRatio = input(false);
  readonly accent = input('#53B29A');
  readonly track = input('#E5E7EB');

  protected readonly stroke = computed(() => this.strokeWidth());
  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => this.size() / 2 - this.strokeWidth());
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());

  protected readonly percent = computed(() => {
    const max = Math.max(1, this.max());
    return Math.min(100, Math.round((this.current() / max) * 100));
  });

  protected readonly displayPercent = computed(() => this.percent());

  protected readonly dashOffset = computed(() => {
    const progress = this.percent() / 100;
    return this.circumference() * (1 - progress);
  });

  protected readonly accentColor = computed(() => this.accent());
  protected readonly trackColor = computed(() => this.track());

  protected ariaLabel(): string {
    return `Occupation ${this.current()} sur ${this.max()}, ${this.percent()} pour cent`;
  }
}
