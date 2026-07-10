import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, input, signal } from '@angular/core';

export type StatCardTone = 'teal' | 'forest' | 'amber' | 'blue';

const TONE_CLASSES: Record<StatCardTone, string> = {
  teal: 'from-brand-teal to-brand-teal-dark',
  forest: 'from-brand-forest-deep to-brand-forest',
  amber: 'from-amber-400 to-amber-600',
  blue: 'from-sky-400 to-sky-600'
};

@Component({
  selector: 'app-ui-stat-card',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './stat-card.component.html'
})
export class StatCardComponent implements OnInit {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly suffix = input<string>('');
  readonly durationMs = input<number>(900);
  readonly tone = input<StatCardTone>('teal');

  protected readonly toneClasses = computed(() => TONE_CLASSES[this.tone()]);

  protected readonly displayValue = signal(0);

  ngOnInit(): void {
    const target = this.value();
    const duration = this.durationMs();

    if (typeof requestAnimationFrame !== 'function' || duration <= 0) {
      this.displayValue.set(target);
      return;
    }

    const start = performance.now();

    const step = (now: number): void => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.displayValue.set(Math.round(target * eased));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }
}
