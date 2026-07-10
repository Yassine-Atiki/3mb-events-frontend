import { Component, computed, input } from '@angular/core';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8'
};

@Component({
  selector: 'app-ui-card',
  standalone: true,
  templateUrl: './card.component.html'
})
export class CardComponent {
  readonly padding = input<CardPadding>('md');
  readonly title = input<string | undefined>(undefined);
  readonly hover = input(false);

  protected readonly cardClasses = computed(
    () =>
      `rounded-2xl border border-brand-teal/10 bg-surface-white shadow-card ${PADDING_CLASSES[this.padding()]} ` +
      (this.hover() ? 'card-hover-lift' : '')
  );
}
