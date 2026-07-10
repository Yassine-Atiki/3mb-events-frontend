import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Download, LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';

import { EventService } from '../../core/api/event.service';
import { RegistrationService } from '../../core/api/registration.service';
import { TicketService } from '../../core/api/ticket.service';
import { UserService } from '../../core/api/user.service';
import { Registration, RegistrationStatus } from '../../core/models';
import { registrationFunctionalStatus } from '../../shared/organizer/functional-status';
import { PillFilterComponent, PillOption } from '../../shared/organizer/pill-filter.component';
import { SideDrawerComponent } from '../../shared/organizer/side-drawer.component';
import { StatusDotComponent } from '../../shared/organizer/status-dot.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-organizer-event-registrations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PillFilterComponent,
    SideDrawerComponent,
    StatusDotComponent,
    AvatarComponent
  ],
  template: `
    <div class="organizer-page mx-auto max-w-6xl">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            routerLink="/organisateur/evenements"
            class="inline-flex items-center gap-1 text-xs font-medium text-brand-teal-dark hover:underline"
          >
            <lucide-angular [img]="icons.ArrowLeft" [size]="13"></lucide-angular>
            Retour
          </a>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-text-primary">Inscriptions</h1>
          <p class="mt-0.5 text-sm text-text-secondary">{{ eventTitle() }}</p>
        </div>
        <app-ui-button variant="secondary" (clicked)="exportCsv()">
          <lucide-angular [img]="icons.Download" [size]="16"></lucide-angular>
          Exporter CSV
        </app-ui-button>
      </header>

      <div class="mt-5">
        <app-pill-filter
          [options]="statusPills()"
          [value]="statusFilter()"
          (valueChange)="statusFilter.set($event)"
          ariaLabel="Filtrer par statut"
        />
      </div>

      <div class="mt-4">
        @if (loading()) {
          <app-ui-skeleton height="400px" rounded="2xl" />
        } @else if (filteredRegistrations().length === 0) {
          <app-ui-empty-state
            title="Aucune inscription"
            description="Les inscriptions apparaîtront ici dès qu'un participant réservera."
          />
        } @else {
          <div class="overflow-x-auto rounded-xl border border-hairline bg-organizer-surface shadow-soft">
            <table class="organizer-dense-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Billet</th>
                  <th>Qté</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRegistrations(); track row.id) {
                  <tr
                    class="cursor-pointer"
                    tabindex="0"
                    (click)="openDetail(row)"
                    (keydown.enter)="openDetail(row)"
                  >
                    <td>
                      <span class="flex items-center gap-2.5">
                        <app-ui-avatar [name]="participantName(row.userId)" size="sm" />
                        <span class="font-medium">{{ participantName(row.userId) }}</span>
                      </span>
                    </td>
                    <td class="text-text-secondary">{{ ticketTypeName(row.ticketTypeId) }}</td>
                    <td class="font-mono text-xs tabular-nums">{{ row.quantity }}</td>
                    <td class="font-mono text-xs tabular-nums">{{ row.totalPrice }} {{ row.currency }}</td>
                    <td>
                      <app-status-dot
                        [label]="statusFor(row.status).label"
                        [tone]="statusFor(row.status).tone"
                      />
                    </td>
                    <td class="font-mono text-xs tabular-nums text-text-secondary">
                      {{ formatDate(row.createdAt) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <app-side-drawer
        [open]="drawerOpen()"
        [title]="selectedRegistration() ? participantName(selectedRegistration()!.userId) : 'Inscription'"
        (close)="closeDrawer()"
      >
        @if (selectedRegistration(); as reg) {
          <dl class="space-y-4 text-sm">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Participant</dt>
              <dd class="mt-1 font-medium text-text-primary">{{ participantName(reg.userId) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Billet</dt>
              <dd class="mt-1 text-text-primary">{{ ticketTypeName(reg.ticketTypeId) }}</dd>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Quantité</dt>
                <dd class="mt-1 font-mono tabular-nums">{{ reg.quantity }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Total</dt>
                <dd class="mt-1 font-mono tabular-nums">{{ reg.totalPrice }} {{ reg.currency }}</dd>
              </div>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Statut</dt>
              <dd class="mt-1">
                <app-status-dot [label]="statusFor(reg.status).label" [tone]="statusFor(reg.status).tone" />
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Inscrit le</dt>
              <dd class="mt-1 text-text-secondary">{{ formatDate(reg.createdAt) }}</dd>
            </div>

            @if (reg.status === 'PENDING') {
              <div class="ui-modal-footer">
                <app-ui-button (clicked)="updateStatus(reg, 'CONFIRMED')">Valider</app-ui-button>
                <app-ui-button variant="secondary" (clicked)="updateStatus(reg, 'CANCELLED')">
                  Refuser
                </app-ui-button>
              </div>
            }
          </dl>
        }
      </app-side-drawer>
    </div>
  `
})
export class EventRegistrationsPage {
  readonly id = input<string>();

  private readonly eventService = inject(EventService);
  private readonly registrationService = inject(RegistrationService);
  private readonly ticketService = inject(TicketService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { ArrowLeft, Download };

  protected readonly loading = signal(true);
  protected readonly eventTitle = signal('');
  protected readonly registrations = signal<Registration[]>([]);
  protected readonly userNames = signal<Record<string, string>>({});
  protected readonly ticketTypeNames = signal<Record<string, string>>({});
  protected readonly statusFilter = signal('all');
  protected readonly drawerOpen = signal(false);
  protected readonly selectedRegistration = signal<Registration | null>(null);

  protected readonly filteredRegistrations = computed(() => {
    const filter = this.statusFilter();
    return this.registrations().filter((r) => (filter === 'all' ? true : r.status === filter));
  });

  protected readonly statusPills = computed<PillOption[]>(() => {
    const all = this.registrations();
    const count = (status: RegistrationStatus | 'all') =>
      status === 'all' ? all.length : all.filter((r) => r.status === status).length;

    return [
      { value: 'all', label: 'Tous', count: count('all') },
      { value: 'PENDING', label: 'En attente', count: count('PENDING') },
      { value: 'CONFIRMED', label: 'Confirmées', count: count('CONFIRMED') },
      { value: 'CANCELLED', label: 'Annulées', count: count('CANCELLED') },
      { value: 'ATTENDED', label: 'Présents', count: count('ATTENDED') }
    ];
  });

  constructor() {
    effect(() => {
      const eventId = this.id();
      if (eventId) this.load(eventId);
    });
  }

  protected statusFor(status: string) {
    return registrationFunctionalStatus(status);
  }

  protected participantName(userId: string): string {
    return this.userNames()[userId] ?? userId;
  }

  protected ticketTypeName(ticketTypeId: string): string {
    return this.ticketTypeNames()[ticketTypeId] ?? '—';
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  protected openDetail(registration: Registration): void {
    this.selectedRegistration.set(registration);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedRegistration.set(null);
  }

  protected exportCsv(): void {
    this.toast.info('Export CSV en cours — vous recevrez un e-mail avec le fichier.');
  }

  protected updateStatus(row: Registration, status: RegistrationStatus): void {
    this.registrationService.updateStatus(row.id, status).subscribe({
      next: (updated) => {
        this.registrations.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.selectedRegistration.set(updated);
        this.toast.success(status === 'CONFIRMED' ? 'Inscription validée.' : 'Inscription refusée.');
      },
      error: () => this.toast.error('Une erreur est survenue.')
    });
  }

  private load(eventId: string): void {
    this.loading.set(true);

    this.eventService.getById(eventId).subscribe({
      next: (event) => this.eventTitle.set(event.title),
      error: () => this.eventTitle.set('')
    });

    this.ticketService.getTicketTypesByEvent(eventId).subscribe((types) => {
      const map: Record<string, string> = {};
      types.forEach((type) => (map[type.id] = type.name));
      this.ticketTypeNames.set(map);
    });

    this.registrationService.search({ eventId, page: 0, size: 200 }).subscribe({
      next: (res) => {
        this.registrations.set(res.content);
        this.loading.set(false);
        this.loadUserNames(res.content);
      },
      error: () => {
        this.registrations.set([]);
        this.loading.set(false);
      }
    });
  }

  private loadUserNames(registrations: Registration[]): void {
    const uniqueIds = Array.from(new Set(registrations.map((registration) => registration.userId)));
    if (uniqueIds.length === 0) return;

    forkJoin(uniqueIds.map((id) => this.userService.getById(id).pipe(catchError(() => of(null))))).subscribe(
      (users) => {
        const map: Record<string, string> = {};
        users.forEach((user, index) => {
          if (user) map[uniqueIds[index]] = `${user.firstName} ${user.lastName}`;
        });
        this.userNames.set(map);
      }
    );
  }
}
