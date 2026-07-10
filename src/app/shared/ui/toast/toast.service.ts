import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly lastId = signal(0);
  private readonly _toasts = signal<ToastMessage[]>([]);

  readonly toasts = this._toasts.asReadonly();

  success(message: string, durationMs = 4000): number {
    return this.push('success', message, durationMs);
  }

  error(message: string, durationMs = 5000): number {
    return this.push('error', message, durationMs);
  }

  info(message: string, durationMs = 4000): number {
    return this.push('info', message, durationMs);
  }

  dismiss(id: number): void {
    this._toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }

  private push(type: ToastType, message: string, durationMs: number): number {
    const id = this.lastId() + 1;
    this.lastId.set(id);
    this._toasts.update((toasts) => [...toasts, { id, type, message, durationMs }]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }

    return id;
  }
}
