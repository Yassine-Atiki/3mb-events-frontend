import { Injectable, signal } from '@angular/core';

export type ConfirmDialogTone = 'danger' | 'warning' | 'neutral';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  id: number;
  resolve: (confirmed: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private nextId = 0;
  private readonly _dialog = signal<ConfirmDialogState | null>(null);

  readonly dialog = this._dialog.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const current = this._dialog();
      if (current) {
        current.resolve(false);
      }

      this._dialog.set({
        id: ++this.nextId,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmer',
        cancelLabel: options.cancelLabel ?? 'Annuler',
        tone: options.tone ?? 'danger',
        resolve
      });
    });
  }

  accept(): void {
    const current = this._dialog();
    if (!current) return;
    this._dialog.set(null);
    current.resolve(true);
  }

  dismiss(): void {
    const current = this._dialog();
    if (!current) return;
    this._dialog.set(null);
    current.resolve(false);
  }
}
