import { Component, computed, input } from '@angular/core';

export type BadgeTone = 'teal' | 'gray' | 'amber' | 'red' | 'blue' | 'green';

const BASE_CLASSES = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset';

const TONE_CLASSES: Record<BadgeTone, string> = {
  teal: 'bg-brand-teal/12 text-brand-teal-dark ring-brand-teal/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  red: 'bg-rose-100 text-rose-700 ring-rose-200',
  blue: 'bg-sky-100 text-sky-700 ring-sky-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200'
};

@Component({
  selector: 'app-ui-badge',
  standalone: true,
  templateUrl: './badge.component.html'
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('teal');

  protected readonly badgeClasses = computed(() => `${BASE_CLASSES} ${TONE_CLASSES[this.tone()]}`);
}
