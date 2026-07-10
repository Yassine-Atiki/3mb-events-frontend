import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FunctionalStatusTone, statusColor } from './functional-status';

@Component({
  selector: 'app-status-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-2">
      <span
        class="h-2 w-2 shrink-0 rounded-full"
        [style.background-color]="dotColor()"
        aria-hidden="true"
      ></span>
      <span class="text-sm text-text-secondary">{{ label() }}</span>
    </span>
  `
})
export class StatusDotComponent {
  readonly label = input.required<string>();
  readonly tone = input<FunctionalStatusTone>('draft');

  protected readonly dotColor = computed(() => statusColor(this.tone()));
}
