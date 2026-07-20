import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Copy, Download, FileSpreadsheet, Link2, LucideAngularModule, Mail, Plus, Search, Trash2, UserPlus } from 'lucide-angular';
import { catchError, concatMap, from, of, toArray } from 'rxjs';

import { EventService } from '../../core/api/event.service';
import { RegistrationService } from '../../core/api/registration.service';
import { TicketService } from '../../core/api/ticket.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';
import { Event as AppEvent, Registration, RegistrationStatus, TicketType } from '../../core/models';
import { registrationFunctionalStatus } from '../../shared/organizer/functional-status';
import {
  downloadParticipantImportTemplate,
  downloadRegistrationsCsv,
  matchTicketTypeId,
  ParsedParticipantRow,
  parseParticipantSpreadsheet,
  validateImportTicketTypes
} from '../../shared/organizer/participant-import.util';
import { PillFilterComponent, PillOption } from '../../shared/organizer/pill-filter.component';
import { SideDrawerComponent } from '../../shared/organizer/side-drawer.component';
import { StatusDotComponent } from '../../shared/organizer/status-dot.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-organizer-event-registrations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    PillFilterComponent,
    SideDrawerComponent,
    StatusDotComponent,
    AvatarComponent,
    InputComponent,
    SelectComponent
  ],
  template: `
    <div class="organizer-page mx-auto max-w-6xl">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
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
        <div class="flex shrink-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto">
          <app-ui-button variant="secondary" (clicked)="downloadImportTemplate()">
            <lucide-angular [img]="icons.Download" [size]="16"></lucide-angular>
            Modèle Excel
          </app-ui-button>
          <app-ui-button variant="secondary" (clicked)="openImportPicker()">
            <lucide-angular [img]="icons.FileSpreadsheet" [size]="16"></lucide-angular>
            Importer Excel
          </app-ui-button>
          <app-ui-button (clicked)="openAddDrawer()">
            <lucide-angular [img]="icons.UserPlus" [size]="16"></lucide-angular>
            Ajouter un participant
          </app-ui-button>
          <app-ui-button variant="secondary" (clicked)="exportCsv()">
            <lucide-angular [img]="icons.Download" [size]="16"></lucide-angular>
            Exporter CSV
          </app-ui-button>
          <app-ui-button
            variant="secondary"
            [disabled]="sendingAll() || filteredRegistrations().length === 0"
            (clicked)="sendAllTickets()"
          >
            <lucide-angular [img]="icons.Mail" [size]="16"></lucide-angular>
            {{ sendingAll() ? 'Envoi…' : 'Envoyer tous les billets' }}
          </app-ui-button>
        </div>
      </header>

      <input
        #importFileInput
        type="file"
        class="sr-only"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        (change)="onImportFileSelected($event)"
      />
      <section class="organizer-panel mt-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="organizer-panel-eyebrow">Inscription publique</p>
            <h2 class="organizer-panel-title">Lien d'inscription</h2>
            <p class="organizer-panel-subtitle">
              Partagez ce lien pour permettre aux participants de s'inscrire sans compte.
            </p>
          </div>
          @if (publicLinkLoading()) {
            <span class="text-xs text-text-secondary">Chargement…</span>
          } @else if (event()?.publicRegistrationEnabled && event()?.publicRegistrationToken) {
            <app-ui-button variant="secondary" size="sm" (clicked)="revokePublicLink()">
              Révoquer le lien
            </app-ui-button>
          } @else {
            <app-ui-button size="sm" (clicked)="enablePublicLink()">
              <lucide-angular [img]="icons.Link2" [size]="14"></lucide-angular>
              Activer le lien
            </app-ui-button>
          }
        </div>

        @if (event()?.publicRegistrationEnabled && event()?.publicRegistrationToken) {
          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              readonly
              class="min-w-0 flex-1 rounded-xl border border-hairline bg-white px-3 py-2 font-mono text-xs text-text-primary"
              [value]="publicRegistrationUrl()"
            />
            <app-ui-button variant="secondary" size="sm" (clicked)="copyPublicLink()">
              <lucide-angular [img]="icons.Copy" [size]="14"></lucide-angular>
              Copier
            </app-ui-button>
          </div>
        } @else {
          <p class="mt-4 rounded-xl border border-dashed border-hairline bg-white/60 px-4 py-3 text-sm text-text-secondary">
            Aucun lien public actif. Activez-le pour permettre les inscriptions en ligne.
          </p>
        }
      </section>

      <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <app-pill-filter
          class="shrink-0"
          [options]="statusPills()"
          [value]="statusFilter()"
          (valueChange)="statusFilter.set($event)"
          ariaLabel="Filtrer par statut"
        />
        <app-ui-input
          class="min-w-0 flex-1"
          type="search"
          placeholder="Rechercher par nom…"
          [leadingIcon]="icons.Search"
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
      </div>

      <div class="mt-4">
        @if (loading()) {
          <app-ui-skeleton height="400px" rounded="2xl" />
        } @else if (filteredRegistrations().length === 0) {
          <app-ui-empty-state
            title="Aucun participant"
            description="Ajoutez un participant manuellement ou partagez le lien d'inscription public."
          >
            <app-ui-button (clicked)="openAddDrawer()">
              <lucide-angular icon [img]="icons.Plus" [size]="16"></lucide-angular>
              Ajouter un participant
            </app-ui-button>
          </app-ui-empty-state>
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
                  <th class="w-28 text-right">Actions</th>
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
                        <app-ui-avatar [name]="participantName(row)" size="sm" />
                        <span>
                          <span class="block font-medium">{{ participantName(row) }}</span>
                          <span class="block text-xs text-text-secondary">{{ row.participantEmail }}</span>
                        </span>
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
                    <td class="text-right" (click)="$event.stopPropagation()">
                      <div class="organizer-row-actions inline-flex justify-end gap-1">
                        <app-ui-button
                          size="sm"
                          [disabled]="sendingRegistrationId() === row.id || !canSendTicket(row)"
                          (clicked)="sendTicket(row)"
                        >
                          <lucide-angular [img]="icons.Mail" [size]="14"></lucide-angular>
                          {{ sendingRegistrationId() === row.id ? 'Envoi…' : 'E-mail' }}
                        </app-ui-button>
                        <app-ui-button
                          size="sm"
                          variant="danger"
                          [disabled]="deletingId() === row.id"
                          (clicked)="deleteRegistration(row)"
                        >
                          <lucide-angular [img]="icons.Trash2" [size]="14"></lucide-angular>
                        </app-ui-button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <app-side-drawer
        [open]="addDrawerOpen()"
        title="Ajouter un participant"
        (close)="closeAddDrawer()"
      >
        <form class="space-y-4" (ngSubmit)="submitAddParticipant()">
          <app-ui-input
            label="Prénom"
            placeholder="Prénom"
            [ngModel]="addForm.firstName"
            (ngModelChange)="updateAddForm('firstName', $event)"
            name="firstName"
            required
          />
          <app-ui-input
            label="Nom"
            placeholder="Nom"
            [ngModel]="addForm.lastName"
            (ngModelChange)="updateAddForm('lastName', $event)"
            name="lastName"
            required
          />
          <app-ui-input
            label="E-mail"
            type="email"
            placeholder="participant@exemple.com"
            [ngModel]="addForm.email"
            (ngModelChange)="updateAddForm('email', $event)"
            name="email"
            required
          />
          <app-ui-input
            label="Téléphone (optionnel)"
            type="tel"
            placeholder="+212 6 00 00 00 00"
            [ngModel]="addForm.phone"
            (ngModelChange)="updateAddForm('phone', $event)"
            name="phone"
          />
          <app-ui-select
            label="Type de billet"
            [options]="ticketTypeOptions()"
            placeholder="Choisir un billet"
            [ngModel]="addForm.ticketTypeId"
            (ngModelChange)="updateAddForm('ticketTypeId', $event)"
            name="ticketTypeId"
          />
          <app-ui-input
            label="Quantité"
            type="number"
            [ngModel]="addForm.quantity"
            (ngModelChange)="updateAddForm('quantity', $event)"
            name="quantity"
          />
          <div class="ui-modal-footer">
            <app-ui-button type="submit" [loading]="addSubmitting()">Inscrire</app-ui-button>
            <app-ui-button variant="secondary" type="button" (clicked)="closeAddDrawer()">
              Annuler
            </app-ui-button>
          </div>
        </form>
      </app-side-drawer>

      <app-side-drawer
        [open]="importDrawerOpen()"
        title="Importer des participants"
        (close)="closeImportDrawer()"
      >
        <div class="space-y-4 text-sm">
          <p class="text-text-secondary">
            Colonnes attendues : <strong>Prénom</strong>, <strong>Nom</strong>, <strong>Email</strong>.
            Optionnel : Téléphone, Quantité, Billet (nom du type).
          </p>

          @if (importFileName()) {
            <p class="rounded-xl border border-hairline bg-white px-3 py-2 text-xs text-text-secondary">
              Fichier : <span class="font-medium text-text-primary">{{ importFileName() }}</span>
            </p>
          }

          @if (importNeedsDefaultTicketType()) {
            <app-ui-select
              label="Type de billet par défaut"
              [options]="ticketTypeOptions()"
              placeholder="Choisir un billet"
              [ngModel]="importDefaultTicketTypeId()"
              (ngModelChange)="importDefaultTicketTypeId.set($event)"
              name="importTicketTypeId"
            />
            <p class="text-xs text-text-secondary">
              Utilisé uniquement pour les lignes sans colonne « Billet ».
            </p>
          } @else if (importRows().length > 0) {
            <p class="rounded-xl border border-hairline bg-brand-teal/5 px-3 py-2 text-xs text-brand-teal-dark">
              Les types de billet seront lus depuis la colonne « Billet » du fichier.
            </p>
          }

          @if (importRows().length > 0) {
            <div class="rounded-xl border border-hairline bg-white px-3 py-2 text-xs">
              <p>
                <span class="font-semibold text-text-primary">{{ importValidCount() }}</span> lignes valides ·
                <span class="font-semibold text-rose-600">{{ importErrorCount() }}</span> erreurs
              </p>
            </div>
            <div class="max-h-64 overflow-y-auto rounded-xl border border-hairline">
              <table class="organizer-dense-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Participant</th>
                    <th>Billet</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of importRowsValidated().slice(0, 40); track row.rowNumber) {
                    <tr>
                      <td class="font-mono text-xs">{{ row.rowNumber }}</td>
                      <td>
                        <span class="block font-medium">{{ row.firstName }} {{ row.lastName }}</span>
                        <span class="block text-xs text-text-secondary">{{ row.email }}</span>
                      </td>
                      <td class="text-xs text-text-secondary">{{ row.ticketTypeName || '—' }}</td>
                      <td class="text-xs" [class.text-rose-600]="row.error" [class.text-brand-teal-dark]="!row.error">
                        {{ row.error || 'OK' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (importRows().length > 40) {
              <p class="text-xs text-text-secondary">Aperçu limité aux 40 premières lignes.</p>
            }
          }

          <div class="ui-modal-footer flex flex-wrap gap-2">
            <app-ui-button
              [loading]="importSubmitting()"
              [disabled]="!importCanSubmit()"
              (clicked)="confirmImport()"
            >
              Importer {{ importValidCount() }} participant(s)
            </app-ui-button>
            <app-ui-button variant="secondary" type="button" (clicked)="openImportPicker()">
              Choisir un autre fichier
            </app-ui-button>
            <app-ui-button variant="secondary" type="button" (clicked)="closeImportDrawer()">
              Annuler
            </app-ui-button>
          </div>
        </div>
      </app-side-drawer>

      <app-side-drawer
        [open]="drawerOpen()"
        [title]="selectedRegistration() ? participantName(selectedRegistration()!) : 'Inscription'"
        (close)="closeDrawer()"
      >
        @if (selectedRegistration(); as reg) {
          <dl class="space-y-4 text-sm">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Participant</dt>
              <dd class="mt-1 font-medium text-text-primary">{{ participantName(reg) }}</dd>
              <dd class="text-text-secondary">{{ reg.participantEmail }}</dd>
              @if (reg.participantPhone) {
                <dd class="text-text-secondary">{{ reg.participantPhone }}</dd>
              }
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Billet</dt>
              <dd class="mt-2">
                <app-ui-select
                  [options]="ticketTypeOptions()"
                  placeholder="Choisir un billet"
                  [ngModel]="editTicketTypeId()"
                  (ngModelChange)="editTicketTypeId.set($event)"
                  name="editTicketTypeId"
                />
              </dd>
              @if (editTicketTypeId() && editTicketTypeId() !== reg.ticketTypeId) {
                <div class="mt-2">
                  <app-ui-button size="sm" [loading]="ticketTypeSubmitting()" (clicked)="saveTicketType(reg)">
                    Enregistrer le type de billet
                  </app-ui-button>
                </div>
              }
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
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly icons = { ArrowLeft, Download, UserPlus, Plus, Link2, Copy, FileSpreadsheet, Mail, Search, Trash2 };

  private readonly importFileInput = viewChild<ElementRef<HTMLInputElement>>('importFileInput');

  protected readonly loading = signal(true);
  protected readonly publicLinkLoading = signal(false);
  protected readonly eventTitle = signal('');
  protected readonly event = signal<AppEvent | null>(null);
  protected readonly registrations = signal<Registration[]>([]);
  protected readonly ticketTypes = signal<TicketType[]>([]);
  protected readonly ticketTypeNames = signal<Record<string, string>>({});
  protected readonly statusFilter = signal('all');
  protected readonly searchQuery = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly addDrawerOpen = signal(false);
  protected readonly importDrawerOpen = signal(false);
  protected readonly addSubmitting = signal(false);
  protected readonly importSubmitting = signal(false);
  protected readonly ticketTypeSubmitting = signal(false);
  protected readonly selectedRegistration = signal<Registration | null>(null);
  protected readonly editTicketTypeId = signal('');
  protected readonly importFileName = signal('');
  protected readonly importRows = signal<ParsedParticipantRow[]>([]);
  protected readonly importDefaultTicketTypeId = signal('');
  protected readonly sendingRegistrationId = signal<string | null>(null);
  protected readonly sendingAll = signal(false);

  protected readonly importValidCount = computed(() => this.importRowsValidated().filter((r) => !r.error).length);
  protected readonly importErrorCount = computed(() => this.importRowsValidated().filter((r) => !!r.error).length);
  protected readonly importNeedsDefaultTicketType = computed(() =>
    this.importRows().some((row) => !row.ticketTypeName?.trim())
  );
  protected readonly importCanSubmit = computed(() => {
    if (this.importValidCount() === 0) return false;
    if (this.importNeedsDefaultTicketType() && !this.importDefaultTicketTypeId()) return false;
    return true;
  });

  protected readonly importRowsValidated = computed(() =>
    validateImportTicketTypes(
      this.importRows(),
      this.ticketTypes().map((type) => ({ id: type.id, name: type.name })),
      this.importDefaultTicketTypeId() || undefined
    )
  );

  protected addForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    ticketTypeId: '',
    quantity: 1
  };

  protected readonly filteredRegistrations = computed(() => {
    const filter = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();
    return this.registrations().filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (query) {
        const name = `${r.participantFirstName} ${r.participantLastName}`.toLowerCase();
        if (!name.includes(query)) return false;
      }
      return true;
    });
  });

  protected readonly ticketTypeOptions = computed<SelectOption[]>(() =>
    this.ticketTypes().map((type) => ({
      value: type.id,
      label: `${type.name} — ${type.price} ${type.currency}`
    }))
  );

  protected readonly publicRegistrationUrl = computed(() => {
    const token = this.event()?.publicRegistrationToken;
    if (!token || typeof window === 'undefined') return '';
    return `${window.location.origin}/inscription/${token}`;
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

  protected participantName(registration: Registration): string {
    return `${registration.participantFirstName} ${registration.participantLastName}`.trim();
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
    this.editTicketTypeId.set(registration.ticketTypeId);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedRegistration.set(null);
    this.editTicketTypeId.set('');
  }

  protected openAddDrawer(): void {
    this.resetAddForm();
    this.addDrawerOpen.set(true);
  }

  protected closeAddDrawer(): void {
    this.addDrawerOpen.set(false);
    this.resetAddForm();
  }

  protected updateAddForm(field: keyof typeof this.addForm, value: string | number): void {
    if (field === 'quantity') {
      const qty = Number(value);
      this.addForm.quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
      return;
    }
    this.addForm[field] = String(value);
  }

  protected exportCsv(): void {
    const rows = this.filteredRegistrations();
    if (rows.length === 0) {
      this.toast.info('Aucune inscription à exporter.');
      return;
    }

    downloadRegistrationsCsv(rows, {
      ticketTypeNames: this.ticketTypeNames(),
      eventTitle: this.eventTitle(),
      statusLabel: (status) => registrationFunctionalStatus(status).label
    });
    this.toast.success(`${rows.length} inscription(s) exportée(s).`);
  }

  protected canSendTicket(row: Registration): boolean {
    return row.status === 'CONFIRMED' || row.status === 'ATTENDED' || row.status === 'WAITLIST';
  }

  protected sendTicket(row: Registration): void {
    if (!this.canSendTicket(row) || this.sendingRegistrationId()) return;
    this.sendingRegistrationId.set(row.id);
    this.registrationService.sendTicketEmail(row.id).subscribe({
      next: (res) => {
        this.toast.success(res.message || `Billet envoyé à ${row.participantEmail}`);
        this.sendingRegistrationId.set(null);
      },
      error: (err) => {
        const message =
          (err?.error as { message?: string } | null)?.message ?? "Impossible d'envoyer le billet.";
        this.toast.error(message);
        this.sendingRegistrationId.set(null);
      }
    });
  }

  protected sendAllTickets(): void {
    const eventId = this.id();
    if (!eventId || this.sendingAll()) return;
    this.sendingAll.set(true);
    this.eventService.sendTicketsEmail(eventId).subscribe({
      next: (res) => {
        this.toast.success(res.message || `${res.sent} email(s) envoyé(s)`);
        this.sendingAll.set(false);
      },
      error: (err) => {
        const message =
          (err?.error as { message?: string } | null)?.message ?? "Impossible d'envoyer les billets.";
        this.toast.error(message);
        this.sendingAll.set(false);
      }
    });
  }

  protected downloadImportTemplate(): void {
    downloadParticipantImportTemplate();
    this.toast.success('Modèle Excel téléchargé.');
  }

  protected openImportPicker(): void {
    const input = this.importFileInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  protected closeImportDrawer(): void {
    this.importDrawerOpen.set(false);
    this.importRows.set([]);
    this.importFileName.set('');
  }

  protected async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await parseParticipantSpreadsheet(file);
      this.importFileName.set(file.name);
      this.importRows.set(result.rows);
      const needsDefault = result.rows.some((row) => !row.ticketTypeName?.trim());
      this.importDefaultTicketTypeId.set(
        needsDefault
          ? this.importDefaultTicketTypeId() || this.ticketTypes()[0]?.id || this.addForm.ticketTypeId || ''
          : ''
      );
      this.importDrawerOpen.set(true);
      if (result.rows.length === 0) {
        this.toast.error('Le fichier ne contient aucune ligne.');
      } else {
        this.toast.info(`${result.validCount} ligne(s) valide(s), ${result.errorCount} erreur(s).`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de lire le fichier.';
      this.toast.error(message);
    }
  }

  protected confirmImport(): void {
    const eventId = this.id();
    const defaultTicketTypeId = this.importDefaultTicketTypeId() || undefined;
    const validRows = this.importRowsValidated().filter((row) => !row.error);
    if (!eventId || !this.importCanSubmit() || validRows.length === 0) {
      this.toast.error('Corrigez les erreurs du fichier avant import.');
      return;
    }

    const ticketTypes = this.ticketTypes();
    this.importSubmitting.set(true);

    from(validRows)
      .pipe(
        concatMap((row) => {
          const ticketTypeId = matchTicketTypeId(
            row.ticketTypeName,
            ticketTypes.map((t) => ({ id: t.id, name: t.name })),
            defaultTicketTypeId
          );
          if (!ticketTypeId) {
            return of(null);
          }
          return this.registrationService
            .create({
              eventId,
              ticketTypeId,
              quantity: row.quantity,
              participantFirstName: row.firstName,
              participantLastName: row.lastName,
              participantEmail: row.email,
              participantPhone: row.phone
            })
            .pipe(catchError(() => of(null)));
        }),
        toArray()
      )
      .subscribe({
        next: (created) => {
          const ok = created.filter((item): item is Registration => !!item);
          const failed = created.length - ok.length;
          this.registrations.update((list) => [...ok, ...list]);
          this.importSubmitting.set(false);
          this.closeImportDrawer();
          if (failed === 0) {
            this.toast.success(`${ok.length} participant(s) importé(s).`);
          } else {
            this.toast.info(`${ok.length} importé(s), ${failed} échec(s).`);
          }
        },
        error: () => {
          this.importSubmitting.set(false);
          this.toast.error("L'import a échoué.");
        }
      });
  }

  protected enablePublicLink(): void {
    const eventId = this.id();
    if (!eventId) return;
    this.publicLinkLoading.set(true);
    this.eventService.enablePublicRegistration(eventId).subscribe({
      next: (updated) => {
        this.event.set(updated);
        this.publicLinkLoading.set(false);
        this.toast.success("Lien d'inscription public activé.");
      },
      error: () => {
        this.publicLinkLoading.set(false);
        this.toast.error("Impossible d'activer le lien public.");
      }
    });
  }

  protected revokePublicLink(): void {
    const eventId = this.id();
    if (!eventId) return;
    this.publicLinkLoading.set(true);
    this.eventService.revokePublicRegistration(eventId).subscribe({
      next: (updated) => {
        this.event.set(updated);
        this.publicLinkLoading.set(false);
        this.toast.success("Lien d'inscription public révoqué.");
      },
      error: () => {
        this.publicLinkLoading.set(false);
        this.toast.error('Impossible de révoquer le lien public.');
      }
    });
  }

  protected async copyPublicLink(): Promise<void> {
    const url = this.publicRegistrationUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Lien copié dans le presse-papiers.');
    } catch {
      this.toast.error('Impossible de copier le lien.');
    }
  }

  protected submitAddParticipant(): void {
    const eventId = this.id();
    const firstName = this.addForm.firstName.trim();
    const lastName = this.addForm.lastName.trim();
    const email = this.addForm.email.trim();
    const ticketTypeId = this.addForm.ticketTypeId;

    if (!eventId || !firstName || !lastName || !email || !ticketTypeId) {
      this.toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.addSubmitting.set(true);
    this.registrationService
      .create({
        eventId,
        ticketTypeId,
        quantity: this.addForm.quantity,
        participantFirstName: firstName,
        participantLastName: lastName,
        participantEmail: email,
        participantPhone: this.addForm.phone.trim() || undefined
      })
      .subscribe({
        next: (created) => {
          this.addSubmitting.set(false);
          this.registrations.update((list) => [created, ...list]);
          this.closeAddDrawer();
          this.toast.success('Participant inscrit avec succès.');
        },
        error: () => {
          this.addSubmitting.set(false);
          this.toast.error("Impossible d'inscrire ce participant.");
        }
      });
  }

  protected async deleteRegistration(row: Registration): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Supprimer ce participant ?',
      message: `« ${this.participantName(row)} » sera définitivement retiré de la liste. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.deletingId.set(row.id);
    this.registrationService.delete(row.id).subscribe({
      next: () => {
        this.registrations.update((list) => list.filter((r) => r.id !== row.id));
        this.deletingId.set(null);
        this.toast.success('Participant supprimé.');
      },
      error: () => {
        this.deletingId.set(null);
        this.toast.error('Impossible de supprimer ce participant.');
      }
    });
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

  protected saveTicketType(registration: Registration): void {
    const ticketTypeId = this.editTicketTypeId();
    if (!ticketTypeId || ticketTypeId === registration.ticketTypeId) return;

    this.ticketTypeSubmitting.set(true);
    this.registrationService.changeTicketType(registration.id, ticketTypeId).subscribe({
      next: (updated) => {
        this.registrations.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.selectedRegistration.set(updated);
        this.editTicketTypeId.set(updated.ticketTypeId);
        this.ticketTypeSubmitting.set(false);
        this.toast.success('Type de billet mis à jour.');
      },
      error: () => {
        this.ticketTypeSubmitting.set(false);
        this.toast.error('Impossible de changer le type de billet.');
      }
    });
  }

  private load(eventId: string): void {
    this.loading.set(true);

    this.eventService.getById(eventId).subscribe({
      next: (event) => {
        this.event.set(event);
        this.eventTitle.set(event.title);
      },
      error: () => {
        this.event.set(null);
        this.eventTitle.set('');
      }
    });

    this.ticketService.getTicketTypesByEvent(eventId).subscribe((types) => {
      this.ticketTypes.set(types);
      const map: Record<string, string> = {};
      types.forEach((type) => (map[type.id] = type.name));
      this.ticketTypeNames.set(map);
      if (!this.addForm.ticketTypeId && types.length > 0) {
        this.addForm.ticketTypeId = types[0].id;
      }
    });

    this.registrationService.search({ eventId, page: 0, size: 200 }).subscribe({
      next: (res) => {
        this.registrations.set(res.content);
        this.loading.set(false);
      },
      error: () => {
        this.registrations.set([]);
        this.loading.set(false);
      }
    });
  }

  private resetAddForm(): void {
    this.addForm = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      ticketTypeId: this.ticketTypes()[0]?.id ?? '',
      quantity: 1
    };
  }
}
