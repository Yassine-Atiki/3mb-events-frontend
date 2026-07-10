import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-mono-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <span
      class="inline-flex items-center font-mono font-semibold tabular-nums leading-none text-text-primary"
      [class]="sizeClass()"
      role="status"
      [attr.aria-label]="value()"
    >
      @for (digit of digits(); track digit.index) {
        <span
          class="relative inline-block overflow-hidden"
          [style.width]="'0.62em'"
          [style.height]="'1em'"
        >
          <span
            class="absolute left-0 top-0 flex flex-col items-center transition-transform duration-500"
            [style.transform]="'translateY(' + -digit.value * 10 + '%)'"
            [style.transition-timing-function]="'cubic-bezier(0.4, 0.9, 0.3, 1)'"
          >
            @for (n of ladder; track n) {
              <span class="flex h-[1em] items-center justify-center">{{ n }}</span>
            }
          </span>
        </span>
      }
      @if (suffix()) {
        <span class="ml-1">{{ suffix() }}</span>
      }
    </span>
  `
})
export class MonoCounterComponent {
  readonly value = input(0);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('lg');
  readonly suffix = input('');
  readonly minDigits = input(1);

  protected readonly ladder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  protected readonly digits = computed(() => {
    const raw = Math.max(0, Math.round(this.value()));
    const str = String(raw).padStart(this.minDigits(), '0');
    return str.split('').map((char, index) => ({ index, value: Number(char) }));
  });

  protected sizeClass(): string {
    const map = {
      sm: 'text-sm',
      md: 'text-xl',
      lg: 'text-3xl',
      xl: 'text-5xl'
    };
    return map[this.size()];
  }
}
