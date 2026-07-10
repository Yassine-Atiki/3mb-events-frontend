import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowRight,
  CalendarDays,
  Download,
  LayoutDashboard,
  LucideAngularModule,
  MapPin,
  Sparkles,
  Ticket as TicketIcon
} from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CategoryService } from '../../core/api/category.service';
import { EventService } from '../../core/api/event.service';
import { RegistrationService } from '../../core/api/registration.service';
import { TicketService } from '../../core/api/ticket.service';
import { Category, Event, Registration, Ticket } from '../../core/models';
import { categoryColor } from '../../shared/participant/category-color';
import { TicketPdfService } from '../../shared/participant/ticket-pdf.service';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { QrCodeDisplayComponent } from '../../shared/ui/qr-code-display/qr-code-display.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { registrationStatusBadge, ticketStatusBadge } from './utils/status-badges.util';

type TabId = 'a-venir' | 'passees' | 'liste-attente' | 'annulees';

interface RegistrationItem {
  registration: Registration;
  event: Event | null;
  ticket: Ticket | null;
}

interface TabDef {
  id: TabId;
  label: string;
  accent: string;
}

const TABS: TabDef[] = [
  { id: 'a-venir', label: 'À venir', accent: '#53B29A' },
  { id: 'passees', label: 'Passées', accent: '#6366F1' },
  { id: 'liste-attente', label: "Liste d'attente", accent: '#F59E0B' },
  { id: 'annulees', label: 'Annulées', accent: '#94A3B8' }
];

@Component({
  selector: 'app-my-registrations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    SkeletonComponent,
    BadgeComponent,
    QrCodeDisplayComponent
  ],
  template: `
    <div class="participant-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="participant-lounge-badge mb-3">
            <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
            <span>Portefeuille</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Mes inscriptions</h1>
          <p class="mt-1 max-w-2xl text-base text-text-secondary">
            Tous vos billets, classés par statut — prêts à ouvrir ou à télécharger.
          </p>
        </div>
        <a routerLink="/app" class="participant-quick-nav-chip">
          <lucide-angular [img]="icons.LayoutDashboard" [size]="14"></lucide-angular>
          Tableau de bord
        </a>
      </header>

      <section class="participant-reg-metrics" role="tablist" aria-label="Filtrer les inscriptions">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            role="tab"
            class="participant-reg-metric"
            [class.participant-reg-metric--active]="activeTab() === tab.id"
            [style.--pass-metric-accent]="tab.accent"
            [attr.aria-selected]="activeTab() === tab.id"
            (click)="activeTab.set(tab.id)"
          >
            <span class="participant-reg-metric-label">{{ tab.label }}</span>
            <span class="participant-reg-metric-value">{{ countFor(tab.id) }}</span>
          </button>
        }
      </section>

      @if (loading()) {
        <div class="participant-wallet-stack">
          @for (i of skeletonRange; track i) {
            <app-ui-skeleton height="196px" rounded="2xl" />
          }
        </div>
      } @else if (currentItems().length === 0) {
        <div class="participant-pass-empty">
          <div class="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal-light/20">
            <lucide-angular [img]="icons.Sparkles" [size]="36" class="text-brand-teal"></lucide-angular>
          </div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">Aucune inscription</h3>
          <p class="mb-6 text-text-secondary">{{ emptyDescription() }}</p>
          @if (activeTab() === 'a-venir' || activeTab() === 'liste-attente') {
            <a routerLink="/app/decouvrir"><app-ui-button size="md">Découvrir des événements</app-ui-button></a>
          }
        </div>
      } @else {
        <div class="participant-wallet-stack" role="tabpanel">
          @for (item of currentItems(); track item.registration.id) {
            <article
              class="participant-wallet-pass"
              [class.participant-wallet-pass--spent]="isSpent(item)"
              [class.ticket-valid-glow]="item.ticket?.status === 'VALID' && !isSpent(item)"
              [style.--pass-accent]="accentFor(item.event)"
            >
              <div class="participant-wallet-pass-cover">
                <span class="participant-wallet-pass-accent" aria-hidden="true"></span>
                @if (item.event?.coverImageUrl) {
                  <img [src]="item.event!.coverImageUrl" alt="" />
                }
              </div>

              <div class="participant-wallet-pass-main">
                <div class="participant-wallet-pass-badges">
                  <app-ui-badge [tone]="statusConfig(item.registration).tone">
                    {{ statusConfig(item.registration).label }}
                  </app-ui-badge>
                  @if (item.ticket; as ticket) {
                    <app-ui-badge [tone]="ticketStatusConfig(ticket.status).tone">
                      {{ ticketStatusConfig(ticket.status).label }}
                    </app-ui-badge>
                  }
                </div>

                <h2 class="participant-wallet-pass-title">
                  {{ item.event?.title ?? 'Événement introuvable' }}
                </h2>

                <div class="participant-wallet-pass-meta">
                  <span class="flex items-center gap-1.5">
                    <lucide-angular [img]="icons.CalendarDays" [size]="14" [style.color]="accentFor(item.event)"></lucide-angular>
                    {{ item.event ? formatDate(item.event.startAt) : '—' }}
                  </span>
                  @if (item.event?.city) {
                    <span class="flex items-center gap-1.5">
                      <lucide-angular [img]="icons.MapPin" [size]="14" [style.color]="accentFor(item.event)"></lucide-angular>
                      {{ item.event!.city }}
                    </span>
                  }
                </div>

                <div class="participant-wallet-pass-chips">
                  <span class="participant-wallet-pass-chip">
                    {{ item.registration.quantity }} billet{{ item.registration.quantity > 1 ? 's' : '' }}
                  </span>
                  <span class="participant-wallet-pass-chip">
                    {{
                      item.registration.totalPrice === 0
                        ? 'Gratuit'
                        : item.registration.totalPrice + ' ' + item.registration.currency
                    }}
                  </span>
                </div>

                @if (item.ticket?.qrCode) {
                  <div class="participant-wallet-pass-actions">
                    <a [routerLink]="['/app/billets', item.ticket!.id]" class="participant-wallet-pass-action">
                      Ouvrir le billet
                      <lucide-angular [img]="icons.ArrowRight" [size]="13"></lucide-angular>
                    </a>
                    <button
                      type="button"
                      class="participant-wallet-pass-action cursor-pointer border-0 bg-transparent p-0"
                      [disabled]="pdfLoadingId() === item.ticket!.id"
                      (click)="downloadPdf(item)"
                    >
                      <lucide-angular [img]="icons.Download" [size]="13"></lucide-angular>
                      {{ pdfLoadingId() === item.ticket!.id ? 'Génération…' : 'PDF' }}
                    </button>
                  </div>
                }
              </div>

              <div class="participant-wallet-pass-ticket">
                @if (item.ticket?.qrCode; as qr) {
                  <div class="qr-quiet-zone" [style.--qr-accent]="accentFor(item.event)">
                    <app-ui-qr-code [value]="qr" [size]="108" />
                  </div>
                  <a
                    [routerLink]="['/app/billets', item.ticket!.id]"
                    class="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal-dark hover:text-brand-teal"
                  >
                    <lucide-angular [img]="icons.Ticket" [size]="13"></lucide-angular>
                    Voir le pass
                  </a>
                } @else {
                  <div class="participant-wallet-pass-qr-placeholder">
                    Billet non émis
                  </div>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>
  `
})
export class MyRegistrationsPage {
  private readonly registrationService = inject(RegistrationService);
  private readonly eventService = inject(EventService);
  private readonly ticketService = inject(TicketService);
  private readonly categoryService = inject(CategoryService);
  private readonly ticketPdf = inject(TicketPdfService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { Sparkles, CalendarDays, MapPin, ArrowRight, Download, Ticket: TicketIcon, LayoutDashboard };
  protected readonly tabs = TABS;
  protected readonly skeletonRange = Array.from({ length: 3 }, (_, i) => i);

  protected readonly activeTab = signal<TabId>('a-venir');
  protected readonly loading = signal(true);
  protected readonly pdfLoadingId = signal<string | null>(null);
  protected readonly registrations = signal<Registration[]>([]);
  protected readonly eventsById = signal<Record<string, Event>>({});
  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly categoriesById = signal<Record<string, Category>>({});

  private readonly items = computed<RegistrationItem[]>(() => {
    const eventsById = this.eventsById();
    const tickets = this.tickets();
    return this.registrations().map((registration) => ({
      registration,
      event: eventsById[registration.eventId] ?? null,
      ticket: tickets.find((t) => t.registrationId === registration.id) ?? null
    }));
  });

  protected readonly currentItems = computed<RegistrationItem[]>(() => this.itemsForTab(this.activeTab()));

  constructor() {
    this.load();
  }

  protected accentFor(event: Event | null): string {
    if (!event) return '#53B29A';
    return categoryColor(this.categoriesById()[event.categoryId]?.slug);
  }

  protected countFor(tab: TabId): number {
    return this.itemsForTab(tab).length;
  }

  protected isSpent(item: RegistrationItem): boolean {
    const status = item.registration.status;
    if (status === 'CANCELLED' || status === 'REFUNDED') return true;
    if (this.activeTab() === 'passees') return true;
    const ticketStatus = item.ticket?.status;
    return ticketStatus === 'USED' || ticketStatus === 'EXPIRED' || ticketStatus === 'CANCELLED';
  }

  private itemsForTab(tab: TabId): RegistrationItem[] {
    const now = Date.now();
    return this.items()
      .filter((item) => {
        const startAt = item.event ? new Date(item.event.startAt).getTime() : null;
        switch (tab) {
          case 'a-venir':
            return (
              (item.registration.status === 'PENDING' || item.registration.status === 'CONFIRMED') &&
              (startAt === null || startAt > now)
            );
          case 'passees':
            return (
              (item.registration.status === 'CONFIRMED' || item.registration.status === 'ATTENDED') &&
              startAt !== null &&
              startAt <= now
            );
          case 'liste-attente':
            return item.registration.status === 'WAITLIST';
          case 'annulees':
            return item.registration.status === 'CANCELLED' || item.registration.status === 'REFUNDED';
          default:
            return false;
        }
      })
      .sort((a, b) => b.registration.createdAt.localeCompare(a.registration.createdAt));
  }

  protected emptyDescription(): string {
    switch (this.activeTab()) {
      case 'a-venir':
        return "Vous n'avez aucune inscription à venir pour le moment.";
      case 'passees':
        return "Vous n'avez pas encore participé à un événement.";
      case 'liste-attente':
        return "Vous n'êtes sur aucune liste d'attente.";
      case 'annulees':
        return "Vous n'avez aucune inscription annulée.";
      default:
        return 'Aucune inscription trouvée.';
    }
  }

  protected statusConfig(registration: Registration) {
    return registrationStatusBadge(registration.status);
  }

  protected ticketStatusConfig(status: Ticket['status']) {
    return ticketStatusBadge(status);
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  protected async downloadPdf(item: RegistrationItem): Promise<void> {
    const ticket = item.ticket;
    const event = item.event;
    if (!ticket?.qrCode || !event || this.pdfLoadingId()) return;

    this.pdfLoadingId.set(ticket.id);
    try {
      const category = this.categoriesById()[event.categoryId];
      await this.ticketPdf.download({
        ticket,
        event,
        categoryName: category?.name,
        statusLabel: ticketStatusBadge(ticket.status).label
      });
      this.toast.success('Billet téléchargé');
    } catch {
      this.toast.error('Impossible de générer le PDF');
    } finally {
      this.pdfLoadingId.set(null);
    }
  }

  private load(): void {
    this.loading.set(true);

    this.categoryService.getAll().subscribe((categories) => {
      const map: Record<string, Category> = {};
      categories.forEach((c) => (map[c.id] = c));
      this.categoriesById.set(map);
    });

    this.ticketService.getMyTickets().subscribe((tickets) => this.tickets.set(tickets));

    this.registrationService.getMine().subscribe({
      next: (registrations) => {
        this.registrations.set(registrations);
        const eventIds = [...new Set(registrations.map((r) => r.eventId))];
        if (eventIds.length === 0) {
          this.loading.set(false);
          return;
        }
        forkJoin(eventIds.map((id) => this.eventService.getById(id).pipe(catchError(() => of(null))))).subscribe(
          (events) => {
            const map: Record<string, Event> = {};
            events.forEach((event) => {
              if (event) map[event.id] = event;
            });
            this.eventsById.set(map);
            this.loading.set(false);
          }
        );
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Impossible de charger vos inscriptions.');
      }
    });
  }
}
