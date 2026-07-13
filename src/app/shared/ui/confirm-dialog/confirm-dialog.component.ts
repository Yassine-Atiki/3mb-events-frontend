import { Component, computed, inject } from '@angular/core';
import { AlertTriangle, LogOut, LucideAngularModule, Trash2 } from 'lucide-angular';

import { ButtonComponent } from '../button/button.component';
import { ConfirmDialogService, ConfirmDialogTone } from './confirm-dialog.service';

@Component({
  selector: 'app-ui-confirm-dialog',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent],
  template: `
    @if (dialog(); as d) {
      <div
        class="confirm-dialog-root"
        role="presentation"
        (keydown.escape)="onEscape($event)"
      >
        <div class="confirm-dialog-backdrop" (click)="dismiss()"></div>

        <div
          class="confirm-dialog-panel"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-dialog-title-' + d.id"
          [attr.aria-describedby]="'confirm-dialog-message-' + d.id"
          tabindex="-1"
        >
          <div class="confirm-dialog-icon" [class]="iconToneClass()">
            <lucide-angular [img]="icon()" [size]="22"></lucide-angular>
          </div>

          <h2 class="confirm-dialog-title" [id]="'confirm-dialog-title-' + d.id">{{ d.title }}</h2>
          <p class="confirm-dialog-message" [id]="'confirm-dialog-message-' + d.id">{{ d.message }}</p>

          <div class="confirm-dialog-actions">
            <app-ui-button variant="secondary" (clicked)="dismiss()">
              {{ d.cancelLabel }}
            </app-ui-button>
            <app-ui-button
              [variant]="confirmVariant()"
              [extraClass]="confirmExtraClass()"
              (clicked)="accept()"
            >
              {{ d.confirmLabel }}
            </app-ui-button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly dialog = this.confirmDialog.dialog;

  protected readonly icon = computed(() => {
    const tone = this.dialog()?.tone ?? 'danger';
    if (tone === 'neutral') return LogOut;
    if (tone === 'warning') return AlertTriangle;
    return Trash2;
  });

  protected readonly iconToneClass = computed(() => {
    const tone: ConfirmDialogTone = this.dialog()?.tone ?? 'danger';
    return `confirm-dialog-icon--${tone}`;
  });

  protected readonly confirmVariant = computed(() => {
    const tone = this.dialog()?.tone ?? 'danger';
    return tone === 'danger' ? 'danger' : 'primary';
  });

  protected readonly confirmExtraClass = computed(() => {
    const tone = this.dialog()?.tone ?? 'danger';
    return tone === 'danger' ? 'confirm-dialog-btn-danger' : '';
  });

  protected accept(): void {
    this.confirmDialog.accept();
  }

  protected dismiss(): void {
    this.confirmDialog.dismiss();
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismiss();
  }
}
