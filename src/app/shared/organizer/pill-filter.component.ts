import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface PillOption {
  value: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'app-pill-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="flex flex-wrap gap-2" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="tab"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200"
          [class.border-brand-teal]="value() === option.value"
          [class.bg-brand-teal]="value() === option.value"
          [class.text-white]="value() === option.value"
          [class.border-hairline]="value() !== option.value"
          [class.bg-organizer-surface]="value() !== option.value"
          [class.text-text-secondary]="value() !== option.value"
          [class.hover:border-brand-teal/40]="value() !== option.value"
          [attr.aria-selected]="value() === option.value"
          (click)="valueChange.emit(option.value)"
        >
          {{ option.label }}
          @if (option.count !== undefined) {
            <span
              class="font-mono text-[10px] tabular-nums"
              [class.text-white/80]="value() === option.value"
              [class.text-text-secondary]="value() !== option.value"
            >
              {{ option.count }}
            </span>
          }
        </button>
      }
    </div>
  `
})
export class PillFilterComponent {
  readonly options = input.required<PillOption[]>();
  readonly value = input('all');
  readonly ariaLabel = input('Filtrer');

  readonly valueChange = output<string>();
}
