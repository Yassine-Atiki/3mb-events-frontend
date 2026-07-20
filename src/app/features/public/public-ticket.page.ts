import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { TicketInfo, TicketService } from '../../core/api/ticket.service';
import { QrCodeDisplayComponent } from '../../shared/ui/qr-code-display/qr-code-display.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { buildPublicTicketUrl, extractQrCode } from '../../shared/organizer/qr-payload.util';

@Component({
  selector: 'app-public-ticket-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, SkeletonComponent, QrCodeDisplayComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div class="mx-auto max-w-lg">
        @if (loading()) {
          <app-ui-skeleton class="mt-6" height="360px" rounded="2xl" />
        } @else if (error()) {
          <div class="mt-6 rounded-2xl border border-hairline bg-white p-8 text-center shadow-soft">
            <h1 class="text-xl font-bold text-text-primary">Billet introuvable</h1>
            <p class="mt-2 text-sm text-text-secondary">{{ error() }}</p>
          </div>
        } @else if (info(); as ticket) {
          <div class="mt-6 overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
            <div class="bg-slate-900 px-6 py-5 text-white">
              <p class="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/60">
                {{ ticket.mode === 'ORGANIZER_VIEW' ? 'Aperçu organisateur' : 'Votre billet' }}
              </p>
              <h1 class="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{{ ticket.eventTitle }}</h1>
              @if (ticket.city) {
                <p class="mt-1 text-sm text-white/70">{{ ticket.city }}</p>
              }
            </div>

            <div class="flex flex-col items-center gap-4 px-6 py-8">
              @if (qrValue()) {
                <app-ui-qr-code [value]="qrValue()!" [size]="200" />
              }
              <p class="text-center text-lg font-semibold text-text-primary">
                {{ ticket.participantFirstName }} {{ ticket.participantLastName }}
              </p>
              @if (ticket.ticketTypeName) {
                <p class="rounded-full border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {{ ticket.ticketTypeName }}
                </p>
              }
              <p
                class="rounded-lg px-3 py-2 text-center text-sm font-medium"
                [class.bg-emerald-50]="ticket.status === 'VALID'"
                [class.text-emerald-800]="ticket.status === 'VALID'"
                [class.bg-amber-50]="ticket.status === 'USED'"
                [class.text-amber-800]="ticket.status === 'USED'"
                [class.bg-rose-50]="ticket.status !== 'VALID' && ticket.status !== 'USED'"
                [class.text-rose-800]="ticket.status !== 'VALID' && ticket.status !== 'USED'"
              >
                {{ ticket.message }}
              </p>
              <dl class="mt-2 grid w-full grid-cols-2 gap-3 text-sm">
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Statut</dt>
                  <dd class="mt-0.5 font-medium text-text-primary">{{ statusLabel(ticket.status) }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Émis le</dt>
                  <dd class="mt-0.5 font-medium text-text-primary">{{ formatDate(ticket.issuedAt) }}</dd>
                </div>
                @if (ticket.eventStartAt) {
                  <div class="col-span-2">
                    <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Début</dt>
                    <dd class="mt-0.5 font-medium text-text-primary">{{ formatDate(ticket.eventStartAt) }}</dd>
                  </div>
                }
              </dl>

              @if (ticket.mode === 'ORGANIZER_VIEW') {
                <p class="mt-2 text-center text-xs text-text-secondary">
                  Mode lecture seule — pour valider l'entrée, utilisez le scanner organisateur.
                </p>
                @if (ticket.canValidate && ticket.eventId) {
                  <a
                    [routerLink]="['/organisateur/scan', ticket.eventId]"
                    class="mt-1 inline-flex rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white"
                  >
                    Ouvrir le scanner
                  </a>
                }
              } @else {
                <p class="mt-2 text-center text-xs leading-relaxed text-text-secondary">
                  Ce QR est en consultation uniquement. Seul le personnel à l'entrée peut le valider.
                </p>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class PublicTicketPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketService = inject(TicketService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<TicketInfo | null>(null);
  protected readonly qrValue = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const rawQr = params.get('qr') ?? '';
    const eventId = params.get('eventId') ?? '';
    const qrCode = extractQrCode(rawQr);

    if (!qrCode || !eventId) {
      this.loading.set(false);
      this.error.set(
        'Lien billet incomplet. Scannez le QR officiel (code + événement requis).'
      );
      return;
    }

    this.qrValue.set(buildPublicTicketUrl(qrCode, eventId));

    this.ticketService.getInfo(qrCode, eventId).subscribe({
      next: (info) => {
        this.info.set(info);
        this.qrValue.set(buildPublicTicketUrl(qrCode, info.eventId));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const apiError = err.error as { message?: string } | null;
        this.error.set(apiError?.message ?? 'Impossible de charger ce billet.');
        this.loading.set(false);
      }
    });
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      VALID: 'Valide',
      USED: 'Utilisé',
      CANCELLED: 'Annulé',
      EXPIRED: 'Expiré',
      REFUNDED: 'Remboursé'
    };
    return map[status] ?? status;
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }
}
