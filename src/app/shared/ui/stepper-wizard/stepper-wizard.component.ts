import { Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

export interface StepItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-ui-stepper',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './stepper-wizard.component.html'
})
export class StepperWizardComponent {
  readonly steps = input<StepItem[]>([]);
  readonly currentIndex = input<number>(0);

  readonly next = output<void>();
  readonly prev = output<void>();

  protected readonly isFirst = computed(() => this.currentIndex() === 0);
  protected readonly isLast = computed(() => this.currentIndex() >= this.steps().length - 1);

  protected circleClasses(index: number): string {
    if (index < this.currentIndex()) return 'bg-brand-teal text-white';
    if (index === this.currentIndex()) return 'bg-brand-teal/15 text-brand-teal-dark ring-2 ring-brand-teal';
    return 'bg-surface-light text-text-secondary';
  }
}
