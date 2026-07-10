import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarDays, Download, LucideAngularModule, MapPin } from 'lucide-angular';

import { TicketStatus } from '../../core/models';
import { BadgeComponent, BadgeTone } from '../ui/badge/badge.component';
import { QrCodeDisplayComponent } from '../ui/qr-code-display/qr-code-display.component';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: { class: 'ticket-card-host' },
  imports: [RouterLink, LucideAngularModule, BadgeComponent, QrCodeDisplayComponent],
  template: `
    <div
      class="ticket-card grid grid-cols-1 sm:grid-cols-[1.4fr_1fr]"
      [class.is-stacked]="stacked()"
      [class.ticket-valid-glow]="glow()"
      [class.ticket-spent]="spent()"
    >
      <!-- Left: event info -->
      <div class="flex flex-col justify-between gap-4 p-5">
        <div>
          <h3 class="text-base font-bold leading-snug text-text-primary">{{ title() }}</h3>
          <div class="mt-2 flex flex-col gap-1.5 text-sm text-text-secondary">
            <span class="flex items-center gap-1.5">
              <lucide-angular [img]="icons.CalendarDays" [size]="14" class="text-brand-teal"></lucide-angular>
              {{ dateLabel() }}
            </span>
            @if (city()) {
              <span class="flex items-center gap-1.5">
                <lucide-angular [img]="icons.MapPin" [size]="14" class="text-brand-teal"></lucide-angular>
                {{ city() }}
              </span>
            }
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span
            class="inline-flex h-6 items-center gap-1.5 rounded-md px-2 font-mono text-xs font-semibold tabular-nums"
            [style.background-color]="accentSoft()"
            [style.color]="accent()"
          >
            {{ quantity() }} × billet
          </span>
          @if (price() !== null) {
            <span class="font-mono text-sm font-semibold tabular-nums text-text-primary">
              {{ price() === 0 ? 'Gratuit' : price() + ' ' + currency() }}
            </span>
          }
        </div>
      </div>

      <!-- Perforation + Right: QR + status -->
      <div class="ticket-perforation relative flex flex-col items-center justify-center gap-3 border-t border-dashed border-hairline p-5 sm:border-t-0 sm:py-6">
        @if (!stacked()) {
          <span class="ticket-notch left-1/2 hidden -translate-x-1/2 sm:block" style="top: -11px"></span>
          <span class="ticket-notch left-1/2 hidden -translate-x-1/2 sm:block" style="bottom: -11px"></span>
        }

        @if (qrValue()) {
          <div class="qr-quiet-zone" [style.--qr-accent]="accent()">
            <app-ui-qr-code [value]="qrValue()!" [size]="qrSize()" />
          </div>
        } @else {
          <div
            class="flex items-center justify-center rounded-xl border border-dashed border-hairline text-center text-xs text-text-secondary"
            [style.width.px]="qrSize() + 20"
            [style.height.px]="qrSize() + 20"
          >
            Billet non émis
          </div>
        }

        <app-ui-badge [tone]="statusTone()">{{ statusLabel() }}</app-ui-badge>

        @if (detailLink().length > 0 && qrValue()) {
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a
              [routerLink]="detailLink()"
              class="text-xs font-semibold text-brand-teal-dark hover:underline"
            >
              Ouvrir le billet
            </a>
            @if (showPdfDownload()) {
              <button
                type="button"
                class="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-teal-dark transition-colors hover:text-brand-teal hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="pdfDownloading()"
                (click)="onPdfDownload($event)"
              >
                <lucide-angular [img]="icons.Download" [size]="12"></lucide-angular>
                {{ pdfDownloading() ? 'Génération…' : 'Télécharger le PDF' }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class TicketCardComponent {
  readonly title = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly city = input('');
  readonly quantity = input(1);
  readonly price = input<number | null>(null);
  readonly currency = input('MAD');
  readonly qrValue = input<string | null>(null);
  readonly statusLabel = input.required<string>();
  readonly statusTone = input<BadgeTone>('gray');
  readonly accent = input('#53B29A');
  readonly detailLink = input<string[]>([]);
  readonly ticketStatus = input<TicketStatus | null>(null);
  readonly qrSize = input(120);
  readonly showPdfDownload = input(false);
  readonly pdfDownloading = input(false);
  /** When true, hides external notches (for stacked lists). */
  readonly stacked = input(false);

  readonly pdfDownload = output<void>();

  protected readonly icons = { CalendarDays, MapPin, Download };

  protected readonly glow = computed(() => this.ticketStatus() === 'VALID');
  protected readonly spent = computed(
    () => this.ticketStatus() === 'USED' || this.ticketStatus() === 'CANCELLED' || this.ticketStatus() === 'EXPIRED'
  );

  protected readonly accentSoft = computed(() => `color-mix(in srgb, ${this.accent()} 12%, white)`);

  protected onPdfDownload(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.pdfDownloading()) return;
    this.pdfDownload.emit();
  }
}
