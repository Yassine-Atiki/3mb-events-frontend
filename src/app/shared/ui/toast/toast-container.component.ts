import { Component, inject } from '@angular/core';
import { ToastService, ToastType } from './toast.service';

const TONE_CLASSES: Record<ToastType, string> = {
  success: 'border-brand-teal/30 bg-brand-teal/10 text-brand-teal-dark',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700'
};

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ'
};

@Component({
  selector: 'app-ui-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html'
})
export class ToastContainerComponent {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  protected toastClasses(type: ToastType): string {
    return TONE_CLASSES[type];
  }

  protected toastIcon(type: ToastType): string {
    return ICONS[type];
  }
}
