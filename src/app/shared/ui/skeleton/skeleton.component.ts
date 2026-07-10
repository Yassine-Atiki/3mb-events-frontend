import { Component, computed, input } from '@angular/core';

export type SkeletonRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const ROUNDED_CLASSES: Record<SkeletonRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full'
};

@Component({
  selector: 'app-ui-skeleton',
  standalone: true,
  templateUrl: './skeleton.component.html'
})
export class SkeletonComponent {
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
  readonly rounded = input<SkeletonRounded>('md');

  protected readonly skeletonClasses = computed(
    () => `animate-pulse bg-surface-light ${ROUNDED_CLASSES[this.rounded()]}`
  );
}
