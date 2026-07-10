import { Component, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-ui-qr-code',
  standalone: true,
  templateUrl: './qr-code-display.component.html'
})
export class QrCodeDisplayComponent {
  readonly value = input.required<string>();
  readonly size = input<number>(200);

  protected readonly dataUrl = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const text = this.value();
      const size = this.size();

      if (!text) {
        this.dataUrl.set(null);
        this.error.set(null);
        return;
      }

      import('qrcode')
        .then((QRCode) => QRCode.toDataURL(text, { width: size, margin: 1 }))
        .then((url) => {
          this.dataUrl.set(url);
          this.error.set(null);
        })
        .catch(() => {
          this.dataUrl.set(null);
          this.error.set('Impossible de générer le QR code');
        });
    });
  }
}
