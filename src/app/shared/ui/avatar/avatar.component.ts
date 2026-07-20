import { Component, computed, effect, input, signal } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg'
};

@Component({
  selector: 'app-ui-avatar',
  standalone: true,
  templateUrl: './avatar.component.html'
})
export class AvatarComponent {
  readonly name = input<string | undefined>(undefined);
  readonly url = input<string | undefined>(undefined);
  readonly size = input<AvatarSize>('md');

  /** True when the remote/data image failed to load — fall back to initials. */
  protected readonly imageFailed = signal(false);

  protected readonly sizeClasses = computed(() => SIZE_CLASSES[this.size()]);

  protected readonly showImage = computed(() => {
    const src = this.url()?.trim();
    return !!src && !this.imageFailed();
  });

  protected readonly initials = computed(() => {
    const value = this.name();
    if (!value) return '?';
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
    const result = `${first}${last}`.toUpperCase();
    return result || '?';
  });

  constructor() {
    effect(() => {
      this.url();
      this.imageFailed.set(false);
    });
  }

  protected onImageError(): void {
    this.imageFailed.set(true);
  }
}
