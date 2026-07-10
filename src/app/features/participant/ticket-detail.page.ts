import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Download,
  LucideAngularModule,
  MapPin,
  ScanLine,
  Sparkles,
  Ticket as TicketIcon
} from 'lucide-angular';

import { CategoryService } from '../../core/api/category.service';
import { EventService } from '../../core/api/event.service';
import { TicketService } from '../../core/api/ticket.service';
import { Category, Event, Ticket as TicketModel } from '../../core/models';
import { categoryColor } from '../../shared/participant/category-color';
import { TicketPdfService } from '../../shared/participant/ticket-pdf.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { QrCodeDisplayComponent } from '../../shared/ui/qr-code-display/qr-code-display.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ticketStatusBadge } from './utils/status-badges.util';

@Component({
  selector: 'app-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    QrCodeDisplayComponent,
    SkeletonComponent
  ],
  template: `
    <div class="participant-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4">
        <a routerLink="/app/mes-inscriptions" class="participant-quick-nav-chip self-start">
          <lucide-angular [img]="icons.ArrowLeft" [size]="14"></lucide-angular>
          Mes inscriptions
        </a>
        <div>
          <div class="participant-lounge-badge mb-3">
            <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
            <span>Mon billet</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Pass numérique</h1>
          <p class="mt-1 max-w-2xl text-base text-text-secondary">
            Présentez ce QR à l'entrée — votre accès est prêt.
          </p>
        </div>
      </header>

      @if (loading()) {
        <div class="flex flex-col gap-4">
          <app-ui-skeleton height="380px" rounded="2xl" />
          <app-ui-skeleton height="56px" rounded="2xl" />
          <app-ui-skeleton height="108px" rounded="2xl" />
        </div>
      } @else if (!ticket() || !event()) {
        <div class="participant-pass-empty">
          <div class="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal-light/20">
            <lucide-angular [img]="icons.Ticket" [size]="36" class="text-brand-teal"></lucide-angular>
          </div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">Billet introuvable</h3>
          <p class="mb-6 text-text-secondary">Ce billet n'existe pas ou ne vous appartient pas.</p>
          <a routerLink="/app/mes-inscriptions"><app-ui-button size="md">Retour aux inscriptions</app-ui-button></a>
        </div>
      } @else {
        <section class="participant-pass-hero" [style.--pass-accent]="accent()">
          <div
            class="participant-pass-stage"
            [class.participant-pass-stage--spent]="isSpent()"
            [class.ticket-valid-glow]="isValid()"
          >
            @if (event()!.coverImageUrl) {
              <div
                class="participant-pass-stage-cover"
                [style.background-image]="'url(' + event()!.coverImageUrl + ')'"
              ></div>
            }
            <div class="participant-pass-stage-scrim"></div>

            <div class="participant-pass-stage-grid">
              <div class="participant-pass-stage-body">
                <div>
                  <span class="participant-pass-live-pill">
                    @if (isValid()) {
                      <span class="participant-pass-live-dot" aria-hidden="true"></span>
                    }
                    {{ statusLabel() }}
                  </span>
                  @if (categoryName(); as cat) {
                    <span
                      class="participant-pass-live-pill ml-2"
                      [style.border-color]="'color-mix(in srgb, ' + accent() + ' 45%, transparent)'"
                      [style.background]="'color-mix(in srgb, ' + accent() + ' 18%, transparent)'"
                    >
                      {{ cat }}
                    </span>
                  }
                  <h2 class="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{{ event()!.title }}</h2>
                  <div class="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                    <span class="flex items-center gap-1.5">
                      <lucide-angular [img]="icons.CalendarDays" [size]="15" class="text-brand-teal-light"></lucide-angular>
                      {{ formatDateTime(event()!.startAt) }}
                    </span>
                    <span class="flex items-center gap-1.5">
                      <lucide-angular [img]="icons.MapPin" [size]="15" class="text-brand-teal-light"></lucide-angular>
                      {{ event()!.city }}
                    </span>
                  </div>
                  @if (ticket()!.seatLabel) {
                    <p class="mt-2 font-mono text-sm font-semibold text-white/85">Place {{ ticket()!.seatLabel }}</p>
                  }
                </div>

                @if (!isSpent() && countdown(); as cd) {
                  <div class="participant-pass-countdown">
                    @for (block of cd; track block.label) {
                      <div class="participant-pass-countdown-block">
                        <div class="participant-pass-countdown-value">{{ pad(block.value) }}</div>
                        <div class="participant-pass-countdown-label">{{ block.label }}</div>
                      </div>
                    }
                  </div>
                } @else if (!isSpent() && proximityTag()) {
                  <p class="font-mono text-lg font-semibold text-white">{{ proximityTag() }} — bon événement !</p>
                }
              </div>

              <div class="participant-pass-qr-deck">
                <div class="participant-pass-qr-ring">
                  <div class="qr-quiet-zone" [style.--qr-accent]="accent()">
                    <app-ui-qr-code [value]="ticket()!.qrCode" [size]="172" />
                  </div>
                </div>
                <p class="participant-ticket-ref">{{ shortTicketId() }}</p>
                <p class="text-center text-xs text-white/60">Émis le {{ formatDate(ticket()!.issuedAt) }}</p>
              </div>
            </div>
          </div>
        </section>

        <div class="participant-ticket-toolbar">
          <app-ui-button [loading]="pdfLoading()" [disabled]="!canDownloadPdf()" (click)="downloadPdf()">
            <lucide-angular [img]="icons.Download" [size]="15" class="mr-1.5"></lucide-angular>
            Télécharger le PDF
          </app-ui-button>
          @if (canRequestRefund()) {
            <button type="button" class="participant-quick-nav-chip cursor-pointer border-0" (click)="requestRefund()">
              <lucide-angular [img]="icons.Banknote" [size]="14"></lucide-angular>
              Demander un remboursement
            </button>
          }
          <span class="participant-ticket-scan-hint">
            <lucide-angular [img]="icons.ScanLine" [size]="14" class="text-brand-teal"></lucide-angular>
            Présentez ce code à l'entrée
          </span>
        </div>

        <section class="participant-pass-metrics">
          <article class="participant-pass-metric" [style.--pass-metric-accent]="accent()">
            <p class="participant-pass-metric-label">Statut</p>
            <p class="participant-pass-metric-value text-base leading-tight">{{ statusLabel() }}</p>
            <span class="participant-pass-metric-chip">billet numérique</span>
          </article>
          <article class="participant-pass-metric" style="--pass-metric-accent: #6366F1">
            <p class="participant-pass-metric-label">Référence</p>
            <p class="participant-pass-metric-value text-sm leading-tight">{{ shortTicketId() }}</p>
            <span class="participant-pass-metric-chip">identifiant unique</span>
          </article>
          <article class="participant-pass-metric" style="--pass-metric-accent: #8B5CF6">
            <p class="participant-pass-metric-label">Catégorie</p>
            <p class="participant-pass-metric-value text-base leading-tight">{{ categoryName() || 'Événement' }}</p>
            <span class="participant-pass-metric-chip">type d'accès</span>
          </article>
          <article class="participant-pass-metric" style="--pass-metric-accent: #F59E0B">
            <p class="participant-pass-metric-label">Émis le</p>
            <p class="participant-pass-metric-value text-base leading-tight">{{ formatDate(ticket()!.issuedAt) }}</p>
            <span class="participant-pass-metric-chip">date d'émission</span>
          </article>
        </section>
      }
    </div>
  `
})
export class TicketDetailPage {
  readonly id = input<string>('');

  private readonly ticketService = inject(TicketService);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly ticketPdf = inject(TicketPdfService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = { ArrowLeft, CalendarDays, MapPin, Download, Banknote, ScanLine, Ticket: TicketIcon, Sparkles };

  protected readonly loading = signal(true);
  protected readonly pdfLoading = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly ticket = signal<TicketModel | null>(null);
  protected readonly event = signal<Event | null>(null);
  protected readonly category = signal<Category | null>(null);

  protected readonly isValid = computed(() => this.ticket()?.status === 'VALID');
  protected readonly isSpent = computed(() => {
    const status = this.ticket()?.status;
    return status === 'USED' || status === 'CANCELLED' || status === 'EXPIRED' || status === 'REFUNDED';
  });
  protected readonly canRequestRefund = computed(() => this.isValid());
  protected readonly canDownloadPdf = computed(() => Boolean(this.ticket()?.qrCode) && !this.pdfLoading());

  protected readonly accent = computed(() => categoryColor(this.category()?.slug));
  protected readonly categoryName = computed(() => this.category()?.name ?? '');
  protected readonly statusLabel = computed(() =>
    this.ticket() ? ticketStatusBadge(this.ticket()!.status).label : ''
  );
  protected readonly shortTicketId = computed(() => {
    const id = this.ticket()?.id ?? '';
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  });

  protected readonly countdown = computed(() => {
    const event = this.event();
    if (!event || this.isSpent()) return null;
    const diff = new Date(event.startAt).getTime() - this.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return [
      { label: 'Jours', value: days },
      { label: 'Heures', value: hours },
      { label: 'Min', value: minutes }
    ];
  });

  protected readonly proximityTag = computed(() => {
    const event = this.event();
    if (!event) return '';
    const start = new Date(event.startAt);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const today = new Date(this.now());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dayDiff = Math.round((startDay - todayDay) / 86_400_000);
    if (dayDiff <= 0) return "C'est aujourd'hui";
    if (dayDiff === 1) return "C'est demain";
    return '';
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.load(id);
    });

    const intervalId = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  protected pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  protected formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  protected async downloadPdf(): Promise<void> {
    const ticket = this.ticket();
    const event = this.event();
    if (!ticket?.qrCode || !event || this.pdfLoading()) return;

    this.pdfLoading.set(true);
    try {
      await this.ticketPdf.download({
        ticket,
        event,
        categoryName: this.categoryName(),
        statusLabel: this.statusLabel()
      });
      this.toast.success('Billet téléchargé');
    } catch {
      this.toast.error('Impossible de générer le PDF');
    } finally {
      this.pdfLoading.set(false);
    }
  }

  protected requestRefund(): void {
    const ticket = this.ticket();
    if (!ticket) return;
    this.router.navigate(['/app/remboursements'], { queryParams: { registrationId: ticket.registrationId } });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.ticketService.getById(id).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.eventService.getById(ticket.eventId).subscribe({
          next: (event) => {
            this.event.set(event);
            this.loading.set(false);
            this.categoryService.getById(event.categoryId).subscribe({
              next: (category) => this.category.set(category),
              error: () => this.category.set(null)
            });
          },
          error: () => {
            this.event.set(null);
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.ticket.set(null);
        this.loading.set(false);
      }
    });
  }
}
