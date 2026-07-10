import { Component, computed, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

const BASE_CLASSES =
  'relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-teal/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed ' +
  'disabled:pointer-events-none disabled:opacity-50';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[2.25rem] px-4 py-2 text-sm',
  md: 'min-h-[2.5rem] px-5 py-2.5 text-sm',
  lg: 'min-h-[3rem] px-6 py-3 text-base'
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border border-brand-teal bg-brand-teal text-white shadow-sm hover:border-brand-teal-dark hover:bg-brand-teal-dark',
  secondary:
    'border border-hairline bg-surface-white text-text-primary shadow-sm hover:border-brand-teal/30 hover:bg-surface-light',
  ghost: 'border border-transparent bg-transparent text-text-primary hover:bg-surface-muted',
  danger:
    'border border-rose-200 bg-surface-white text-rose-700 shadow-sm hover:border-rose-300 hover:bg-rose-50'
};

@Component({
  selector: 'app-ui-button',
  standalone: true,
  templateUrl: './button.component.html'
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<ButtonType>('button');
  readonly fullWidth = input(false);
  readonly extraClass = input<string>('');

  readonly clicked = output<MouseEvent>();

  protected readonly buttonClasses = computed(() => {
    const widthClass = this.fullWidth() ? 'w-full' : '';
    const extra = this.extraClass().trim();
    return `${BASE_CLASSES} ${SIZE_CLASSES[this.size()]} ${VARIANT_CLASSES[this.variant()]} ${widthClass} ${extra}`.trim();
  });

  protected onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) return;
    this.clicked.emit(event);
  }
}
