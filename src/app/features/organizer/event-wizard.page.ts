import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Download, FileSpreadsheet, LucideAngularModule, Plus, Sparkles, Trash2 } from 'lucide-angular';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { CategoryService } from '../../core/api/category.service';
import { CreateEventRequest, EventService, UpdateEventRequest } from '../../core/api/event.service';
import { RegistrationService } from '../../core/api/registration.service';
import { CreateTicketTypeRequest, TicketService } from '../../core/api/ticket.service';
import { VenueService } from '../../core/api/venue.service';
import { EventStatus, EventVisibility, TicketType, TicketTypeKind, Venue } from '../../core/models';
import { EventCardPreviewComponent } from '../../shared/organizer/event-card-preview.component';
import { eventFunctionalStatus } from '../../shared/organizer/functional-status';
import {
  downloadParticipantImportTemplate,
  matchTicketTypeId,
  parseParticipantSpreadsheet
} from '../../shared/organizer/participant-import.util';
import { StatusDotComponent } from '../../shared/organizer/status-dot.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { PageBackLinkComponent } from '../../shared/ui/page-back/page-back.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { coverImageUrlValidator, isDirectImageUrl } from '../../shared/utils/validators';
import { VenueAutocompleteComponent } from '../../shared/venues/venue-autocomplete.component';
import { VenueEditorModalComponent } from '../../shared/venues/venue-editor-modal.component';

interface WizardStep {
  id: string;
  label: string;
  hint: string;
}

interface DraftTicketType {
  tempId: string;
  persisted: boolean;
  id?: string;
  name: string;
  kind: TicketTypeKind;
  price: number;
  quantityTotal: number;
  maxPerOrder?: number;
  description?: string;
}

interface DraftParticipant {
  tempId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  ticketTypeTempId: string;
  quantity: number;
}

const VISIBILITY_OPTIONS: SelectOption[] = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Privé' },
  { value: 'UNLISTED', label: 'Non listé (lien direct uniquement)' }
];

const TICKET_KIND_OPTIONS: SelectOption[] = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'VIP', label: 'VIP' },
  { value: 'GRATUIT', label: 'Gratuit' },
  { value: 'EARLY_BIRD', label: 'Early Bird' },
  { value: 'GROUPE', label: 'Groupe' }
];

const TICKET_KIND_LABELS: Record<TicketTypeKind, string> = {
  STANDARD: 'Standard',
  VIP: 'VIP',
  GRATUIT: 'Gratuit',
  EARLY_BIRD: 'Early Bird',
  GROUPE: 'Groupe'
};

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return value ? new Date(value).toISOString() : '';
}

@Component({
  selector: 'app-organizer-event-wizard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    SelectComponent,
    EventCardPreviewComponent,
    StatusDotComponent,
    VenueAutocompleteComponent,
    VenueEditorModalComponent,
    PageBackLinkComponent
  ],
  template: `
    <div class="organizer-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <app-page-back
            class="mb-3"
            link="/organisateur/evenements"
            label="Retour aux événements"
          />
          <div class="organizer-studio-badge mb-3">
            <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
            <span>Atelier de création</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {{ isEditMode() ? "Modifier l'événement" : 'Nouvel événement' }}
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Composez votre fiche publique étape par étape — l'aperçu catalogue se met à jour en direct.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @if (currentStatus(); as status) {
            <app-status-dot [label]="statusFor(status).label" [tone]="statusFor(status).tone" />
          }
          <span class="rounded-full border border-hairline bg-white px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-brand-teal-dark">
            {{ previewCompleteness() }}% complété
          </span>
        </div>
      </header>

      <section class="organizer-wizard-progress">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="organizer-panel-eyebrow">Étape {{ currentStep() + 1 }} / {{ steps.length }}</p>
            <p class="organizer-panel-title">{{ steps[currentStep()].label }}</p>
            <p class="organizer-panel-subtitle">{{ steps[currentStep()].hint }}</p>
          </div>
          <p class="font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">{{ stepProgressPercent() }}%</p>
        </div>
        <div class="organizer-wizard-progress-track mt-3">
          <div class="organizer-wizard-progress-fill" [style.width.%]="stepProgressPercent()"></div>
        </div>
      </section>

      <div class="organizer-wizard-layout">
        <aside class="organizer-wizard-rail">
          <nav aria-label="Étapes de création">
            @for (step of steps; track step.id; let i = $index) {
              <button
                type="button"
                class="organizer-wizard-step"
                [class.organizer-wizard-step--active]="currentStep() === i"
                [class.organizer-wizard-step--done]="currentStep() > i"
                [class.organizer-wizard-step--locked]="i > currentStep()"
                [disabled]="i > currentStep()"
                (click)="goToStep(i)"
              >
                <div class="flex items-center gap-2.5">
                  <span class="organizer-wizard-step-index">{{ i + 1 }}</span>
                  <span class="text-sm font-semibold text-text-primary">{{ step.label }}</span>
                </div>
                <p class="mt-1 pl-8 text-[11px] leading-relaxed text-text-secondary">{{ step.hint }}</p>
              </button>
            }
          </nav>
        </aside>

        <div class="organizer-panel organizer-wizard-form">
          @if (currentStep() === 0) {
            <form [formGroup]="infoForm" class="flex flex-col gap-4">
              <div>
                <p class="organizer-panel-eyebrow">Étape 1</p>
                <h2 class="organizer-panel-title">Informations générales</h2>
              </div>
              <app-ui-input
                label="Titre de l'événement"
                placeholder="Ex : Conférence Intelligence Artificielle 2026"
                formControlName="title"
                [error]="invalid(infoForm.controls.title) ? 'Titre requis (5 caractères minimum).' : undefined"
              />
              <app-ui-input
                label="Description courte"
                placeholder="Résumé affiché dans le catalogue (160 caractères max)"
                formControlName="shortDescription"
                [error]="invalid(infoForm.controls.shortDescription) ? 'Requis, 10 à 160 caractères.' : undefined"
              />
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-text-primary">Description complète</label>
                <textarea
                  formControlName="description"
                  rows="5"
                  placeholder="Décrivez votre événement en détail..."
                  class="w-full rounded-xl border border-hairline bg-surface-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-brand-teal focus:outline-none focus:ring-4 focus:ring-brand-teal/15"
                ></textarea>
                @if (invalid(infoForm.controls.description)) {
                  <span class="text-xs text-red-500">Description requise (20 caractères minimum).</span>
                }
              </div>
              <app-ui-select
                label="Catégorie"
                placeholder="Choisir une catégorie"
                [options]="categoryOptions()"
                formControlName="categoryId"
                [error]="invalid(infoForm.controls.categoryId) ? 'Catégorie requise.' : undefined"
              />
              <app-ui-input
                label="Image de couverture (URL)"
                placeholder="https://images.unsplash.com/photo-..."
                hint="Collez le lien direct de l'image (.jpg, .png). Les pages de galerie (Vecteezy, Pinterest…) ne fonctionnent pas."
                formControlName="coverImageUrl"
                [error]="coverImageError()"
              />
            </form>
          }

          @if (currentStep() === 1) {
            <form [formGroup]="dateVenueForm" class="flex flex-col gap-4">
              <div>
                <p class="organizer-panel-eyebrow">Étape 2</p>
                <h2 class="organizer-panel-title">Date &amp; lieu</h2>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <app-ui-input
                  label="Début"
                  type="datetime-local"
                  formControlName="startAt"
                  [error]="invalid(dateVenueForm.controls.startAt) ? 'Date de début requise.' : undefined"
                />
                <app-ui-input
                  label="Fin"
                  type="datetime-local"
                  formControlName="endAt"
                  [error]="
                    invalid(dateVenueForm.controls.endAt)
                      ? dateVenueForm.controls.endAt.errors?.['beforeStart']
                        ? 'La fin doit être après le début.'
                        : 'Date de fin requise.'
                      : undefined
                  "
                />
              </div>
              <app-ui-input
                label="Ville"
                placeholder="Ex : Casablanca"
                formControlName="city"
                [error]="invalid(dateVenueForm.controls.city) ? 'Ville requise.' : undefined"
              />
              <app-venue-autocomplete
                label="Lieu"
                placeholder="Rechercher un lieu…"
                [venues]="venues()"
                formControlName="venueId"
                [error]="invalid(dateVenueForm.controls.venueId) ? 'Lieu requis.' : undefined"
                (createRequested)="openVenueCreateModal()"
              />
            </form>
          }

          @if (currentStep() === 2) {
            <form [formGroup]="capacityForm" class="flex flex-col gap-4">
              <div>
                <p class="organizer-panel-eyebrow">Étape 3</p>
                <h2 class="organizer-panel-title">Capacité &amp; visibilité</h2>
              </div>
              <app-ui-input
                label="Capacité totale"
                type="number"
                formControlName="capacity"
                [error]="invalid(capacityForm.controls.capacity) ? 'Capacité requise (minimum 1).' : undefined"
              />
              <app-ui-select
                label="Visibilité"
                [options]="visibilityOptions"
                formControlName="visibility"
                [error]="invalid(capacityForm.controls.visibility) ? 'Visibilité requise.' : undefined"
              />
              <label class="flex items-center gap-2.5 rounded-xl border border-hairline bg-organizer-bg px-3 py-2.5 text-sm text-text-primary">
                <input
                  type="checkbox"
                  formControlName="isFree"
                  class="h-4 w-4 rounded border-hairline text-brand-teal focus:ring-brand-teal/30"
                />
                Cet événement est gratuit
              </label>
            </form>
          }

          @if (currentStep() === 3) {
            <div class="flex flex-col gap-5">
              <div>
                <p class="organizer-panel-eyebrow">Étape 4</p>
                <h2 class="organizer-panel-title">Types de billets</h2>
                <p class="organizer-panel-subtitle">Ajoutez au moins un tarif avant de publier</p>
              </div>

              <form [formGroup]="ticketForm" class="organizer-wizard-ticket-form grid gap-3 sm:grid-cols-2">
                <app-ui-select label="Type" [options]="ticketKindOptions" formControlName="kind" />
                <app-ui-input label="Nom" placeholder="Ex : Standard, VIP..." formControlName="name" />
                <app-ui-input
                  label="Prix (MAD)"
                  type="number"
                  formControlName="price"
                  [hint]="ticketKind() === 'GRATUIT' ? 'Automatiquement fixé à 0.' : undefined"
                />
                <app-ui-input label="Quantité disponible" type="number" formControlName="quantityTotal" />
                <app-ui-input label="Max par commande" type="number" hint="Optionnel" formControlName="maxPerOrder" />
                <app-ui-input label="Description" hint="Optionnel" formControlName="description" />
                <div class="sm:col-span-2">
                  <app-ui-button type="button" variant="secondary" (clicked)="addTicketType()">
                    <lucide-angular [img]="icons.Plus" [size]="15"></lucide-angular>
                    Ajouter ce type de billet
                  </app-ui-button>
                </div>
              </form>

              @if (ticketTypesDraft().length === 0) {
                <p class="text-sm text-text-secondary">Aucun type de billet ajouté pour le moment.</p>
              } @else {
                <ul class="flex flex-col gap-2">
                  @for (tt of ticketTypesDraft(); track tt.tempId) {
                    <li class="organizer-wizard-ticket-item">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-semibold text-text-primary">{{ tt.name }}</span>
                          <span class="rounded-md border border-brand-teal/20 bg-brand-teal/10 px-2 py-0.5 text-xs font-semibold text-brand-teal-dark">
                            {{ kindLabel(tt.kind) }}
                          </span>
                          @if (tt.persisted) {
                            <span class="rounded-md border border-hairline bg-white px-2 py-0.5 text-xs font-medium text-text-secondary">Existant</span>
                          }
                        </div>
                        <div class="mt-1 text-xs text-text-secondary">
                          {{ tt.price === 0 ? 'Gratuit' : tt.price + ' MAD' }} · {{ tt.quantityTotal }} places
                          @if (tt.maxPerOrder) {
                            · max {{ tt.maxPerOrder }}/commande
                          }
                        </div>
                      </div>
                      @if (!tt.persisted) {
                        <button
                          type="button"
                          class="rounded-lg border border-hairline p-2 text-text-secondary transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Supprimer"
                          (click)="removeTicketType(tt.tempId)"
                        >
                          <lucide-angular [img]="icons.Trash2" [size]="15"></lucide-angular>
                        </button>
                      }
                    </li>
                  }
                </ul>
              }
              @if (isEditMode()) {
                <p class="text-xs text-text-secondary">
                  Pour modifier ou supprimer un type de billet existant, rendez-vous dans l'onglet
                  <a [routerLink]="['/organisateur/evenements', id(), 'billetterie']" class="font-semibold text-brand-teal-dark hover:underline">
                    Billetterie
                  </a>.
                </p>
              }
            </div>
          }

          @if (currentStep() === 4) {
            <div class="flex flex-col gap-5">
              <div>
                <p class="organizer-panel-eyebrow">Étape 5</p>
                <h2 class="organizer-panel-title">Participants</h2>
                <p class="organizer-panel-subtitle">
                  Ajoutez des invités maintenant (optionnel) — ils seront inscrits à la création de l'événement.
                </p>
              </div>

              <form [formGroup]="participantForm" class="grid gap-3 sm:grid-cols-2">
                <app-ui-input label="Prénom" formControlName="firstName" />
                <app-ui-input label="Nom" formControlName="lastName" />
                <app-ui-input label="Email" type="email" formControlName="email" />
                <app-ui-input label="Téléphone" hint="Optionnel" formControlName="phone" />
                <app-ui-select label="Type de billet" [options]="participantTicketOptions()" formControlName="ticketTypeTempId" />
                <app-ui-input label="Quantité" type="number" formControlName="quantity" />
                <div class="sm:col-span-2">
                  <app-ui-button type="button" variant="secondary" (clicked)="addParticipant()">
                    <lucide-angular [img]="icons.Plus" [size]="15"></lucide-angular>
                    Ajouter ce participant
                  </app-ui-button>
                </div>
                <div class="sm:col-span-2 flex flex-wrap gap-2">
                  <app-ui-button type="button" variant="secondary" (clicked)="downloadImportTemplate()">
                    <lucide-angular [img]="icons.Download" [size]="15"></lucide-angular>
                    Modèle Excel
                  </app-ui-button>
                  <app-ui-button type="button" variant="secondary" (clicked)="openImportPicker()">
                    <lucide-angular [img]="icons.FileSpreadsheet" [size]="15"></lucide-angular>
                    Importer Excel / CSV
                  </app-ui-button>
                  <input
                    #wizardImportInput
                    type="file"
                    class="sr-only"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    (change)="onWizardImportFileSelected($event)"
                  />
                </div>
              </form>

              @if (importSummary()) {
                <p class="rounded-xl border border-hairline bg-white px-3 py-2 text-xs text-text-secondary">
                  {{ importSummary() }}
                </p>
              }
              @if (participantsDraft().length === 0) {
                <p class="text-sm text-text-secondary">Aucun participant pour l'instant — vous pourrez en ajouter après publication.</p>
              } @else {
                <ul class="flex flex-col gap-2">
                  @for (guest of participantsDraft(); track guest.tempId) {
                    <li class="organizer-wizard-ticket-item">
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-text-primary">
                          {{ guest.firstName }} {{ guest.lastName }}
                        </p>
                        <p class="mt-0.5 text-xs text-text-secondary">
                          {{ guest.email }}
                          @if (guest.phone) {
                            · {{ guest.phone }}
                          }
                          · {{ ticketDraftLabel(guest.ticketTypeTempId) }} × {{ guest.quantity }}
                        </p>
                      </div>
                      <button
                        type="button"
                        class="rounded-lg border border-hairline p-2 text-text-secondary transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Supprimer"
                        (click)="removeParticipant(guest.tempId)"
                      >
                        <lucide-angular [img]="icons.Trash2" [size]="15"></lucide-angular>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          @if (currentStep() === 5) {
            <div class="flex flex-col gap-5">
              <div>
                <p class="organizer-panel-eyebrow">Étape 6</p>
                <h2 class="organizer-panel-title">Récapitulatif &amp; publication</h2>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="organizer-wizard-recap-card">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Informations</p>
                  <p class="mt-2 text-sm font-bold text-text-primary">{{ infoForm.controls.title.value }}</p>
                  <p class="mt-1 line-clamp-3 text-xs text-text-secondary">{{ infoForm.controls.shortDescription.value }}</p>
                  <p class="mt-1 text-xs text-text-secondary">Catégorie : {{ categoryName() }}</p>
                </div>
                <div class="organizer-wizard-recap-card">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Date &amp; lieu</p>
                  <p class="mt-2 text-xs text-text-secondary">Début : {{ formatRecapDate(dateVenueForm.controls.startAt.value) }}</p>
                  <p class="text-xs text-text-secondary">Fin : {{ formatRecapDate(dateVenueForm.controls.endAt.value) }}</p>
                  <p class="text-xs text-text-secondary">{{ venueName() }}, {{ dateVenueForm.controls.city.value }}</p>
                </div>
                <div class="organizer-wizard-recap-card">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Capacité</p>
                  <p class="mt-2 text-xs text-text-secondary">{{ capacityForm.controls.capacity.value }} places</p>
                  <p class="text-xs text-text-secondary">{{ visibilityLabel() }}</p>
                  <p class="text-xs text-text-secondary">{{ capacityForm.controls.isFree.value ? 'Gratuit' : 'Payant' }}</p>
                </div>
                <div class="organizer-wizard-recap-card">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Billetterie</p>
                  <p class="mt-2 text-xs text-text-secondary">{{ ticketTypesDraft().length }} type(s) de billet</p>
                  @for (tt of ticketTypesDraft(); track tt.tempId) {
                    <p class="text-xs text-text-secondary">• {{ tt.name }} — {{ tt.price === 0 ? 'Gratuit' : tt.price + ' MAD' }}</p>
                  }
                </div>
                <div class="organizer-wizard-recap-card sm:col-span-2">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Participants</p>
                  <p class="mt-2 text-xs text-text-secondary">
                    {{ participantsDraft().length === 0 ? 'Aucun ajouté à la création' : participantsDraft().length + ' participant(s) à inscrire' }}
                  </p>
                </div>
              </div>

              <div class="organizer-wizard-publish">
                <p class="text-sm text-text-secondary">
                  Enregistrez en brouillon ou publiez directement votre événement.
                </p>
                <div class="organizer-wizard-publish-actions mt-4">
                  <app-ui-button type="button" variant="secondary" [loading]="saving()" (clicked)="saveAsDraft()">
                    Brouillon
                  </app-ui-button>
                  <app-ui-button type="button" [loading]="saving()" (clicked)="publishNow()">Publier</app-ui-button>
                </div>
              </div>
            </div>
          }

          @if (currentStep() < steps.length - 1) {
            <div class="organizer-wizard-footer">
              <app-ui-button type="button" variant="secondary" [disabled]="currentStep() === 0" (clicked)="goPrev()">
                Précédent
              </app-ui-button>
              <app-ui-button type="button" (clicked)="goNext()">Continuer</app-ui-button>
            </div>
          }
        </div>

        <aside class="organizer-wizard-preview-sticky">
          <p class="organizer-panel-eyebrow">Aperçu catalogue</p>
          <p class="organizer-panel-subtitle mb-3">Rendu public en temps réel</p>
          <app-event-card-preview [data]="previewData()" [completeness]="previewCompleteness()" />
        </aside>
      </div>

      <app-venue-editor-modal
        [open]="venueModalOpen()"
        (close)="venueModalOpen.set(false)"
        (saved)="onVenueCreated($event)"
      />
    </div>
  `
})
export class EventWizardPage {
  readonly id = input<string>();

  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly ticketService = inject(TicketService);
  private readonly registrationService = inject(RegistrationService);
  private readonly categoryService = inject(CategoryService);
  private readonly venueService = inject(VenueService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly venueAutocomplete = viewChild(VenueAutocompleteComponent);
  private readonly wizardImportInput = viewChild<ElementRef<HTMLInputElement>>('wizardImportInput');

  protected readonly icons = { Plus, Trash2, Sparkles, Download, FileSpreadsheet };

  protected readonly stepProgressPercent = computed(() =>
    Math.round(((this.currentStep() + 1) / this.steps.length) * 100)
  );

  protected readonly steps: WizardStep[] = [
    { id: 'info', label: 'Infos générales', hint: 'Titre, description, catégorie' },
    { id: 'date-venue', label: 'Date & lieu', hint: 'Quand et où' },
    { id: 'capacity', label: 'Capacité', hint: 'Places et visibilité' },
    { id: 'tickets', label: 'Billetterie', hint: 'Types de billets' },
    { id: 'participants', label: 'Participants', hint: 'Invités à inscrire (optionnel)' },
    { id: 'recap', label: 'Publication', hint: 'Valider et publier' }
  ];

  protected readonly visibilityOptions = VISIBILITY_OPTIONS;
  protected readonly ticketKindOptions = TICKET_KIND_OPTIONS;

  protected readonly currentStep = signal(0);
  protected readonly saving = signal(false);
  protected readonly currentStatus = signal<EventStatus | null>(null);

  protected readonly categoryOptions = signal<SelectOption[]>([]);
  protected readonly venues = signal<Venue[]>([]);
  protected readonly venueModalOpen = signal(false);
  protected readonly ticketTypesDraft = signal<DraftTicketType[]>([]);
  protected readonly participantsDraft = signal<DraftParticipant[]>([]);
  protected readonly importSummary = signal('');
  protected readonly ticketKind = signal<TicketTypeKind>('STANDARD');
  private readonly formVersion = signal(0);

  protected readonly isEditMode = computed(() => !!this.id());

  protected readonly infoForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    shortDescription: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    categoryId: ['', [Validators.required]],
    coverImageUrl: ['', [coverImageUrlValidator()]]
  });

  protected readonly dateVenueForm = this.fb.nonNullable.group({
    startAt: ['', [Validators.required]],
    endAt: ['', [Validators.required]],
    city: ['', [Validators.required]],
    venueId: ['', [Validators.required]]
  });

  protected readonly capacityForm = this.fb.nonNullable.group({
    capacity: [50, [Validators.required, Validators.min(1)]],
    visibility: ['PUBLIC', [Validators.required]],
    isFree: [false]
  });

  protected readonly ticketForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    kind: ['STANDARD', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    quantityTotal: [50, [Validators.required, Validators.min(1)]],
    maxPerOrder: [5],
    description: ['']
  });

  protected readonly participantForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    ticketTypeTempId: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  protected readonly participantTicketOptions = computed<SelectOption[]>(() =>
    this.ticketTypesDraft().map((tt) => ({
      value: tt.tempId,
      label: `${tt.name} (${tt.price === 0 ? 'Gratuit' : tt.price + ' MAD'})`
    }))
  );

  protected readonly categoryName = computed(() => {
    this.formVersion();
    return this.categoryOptions().find((c) => c.value === this.infoForm.controls.categoryId.value)?.label ?? '—';
  });

  protected readonly venueName = computed(() => {
    this.formVersion();
    return this.venues().find((v) => v.id === this.dateVenueForm.controls.venueId.value)?.name ?? '—';
  });

  protected readonly visibilityLabel = computed(() => {
    this.formVersion();
    return this.visibilityOptions.find((v) => v.value === this.capacityForm.controls.visibility.value)?.label ?? '—';
  });

  protected readonly previewData = computed(() => {
    this.formVersion();
    const info = this.infoForm.getRawValue();
    const dateVenue = this.dateVenueForm.getRawValue();
    const capacity = this.capacityForm.getRawValue();
    const drafts = this.ticketTypesDraft();
    const minPrice = drafts.length > 0 ? Math.min(...drafts.map((t) => t.price)) : 0;

    return {
      title: info.title || undefined,
      shortDescription: info.shortDescription || undefined,
      coverImageUrl: this.resolvedCoverUrl(info.coverImageUrl),
      city: dateVenue.city || undefined,
      venueName: this.venueName(),
      startAt: dateVenue.startAt ? fromDatetimeLocalValue(dateVenue.startAt) : undefined,
      priceFrom: capacity.isFree ? 0 : minPrice,
      isFree: capacity.isFree,
      capacity: capacity.capacity,
      categoryName: this.resolveCategoryLabel(info.categoryId),
      ticketCount: drafts.length
    };
  });

  protected readonly previewCompleteness = computed(() => {
    this.formVersion();
    let score = 0;
    const info = this.infoForm.getRawValue();
    const dateVenue = this.dateVenueForm.getRawValue();
    const capacity = this.capacityForm.getRawValue();

    if (info.title && info.title.length >= 5) score += 20;
    if (info.shortDescription) score += 15;
    if (info.categoryId) score += 10;
    if (this.resolvedCoverUrl(info.coverImageUrl)) score += 5;
    if (dateVenue.startAt && dateVenue.endAt) score += 20;
    if (dateVenue.city && dateVenue.venueId) score += 15;
    if (capacity.capacity > 0) score += 10;
    if (this.ticketTypesDraft().length > 0) score += 5;

    return Math.min(100, score);
  });

  protected statusFor(status: EventStatus) {
    return eventFunctionalStatus(status);
  }

  protected goToStep(index: number): void {
    if (index <= this.currentStep()) {
      this.currentStep.set(index);
    }
  }

  constructor() {
    const bump = () => this.formVersion.update((v) => v + 1);
    this.infoForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(bump);
    this.dateVenueForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(bump);
    this.capacityForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(bump);

    this.categoryService
      .getAll()
      .subscribe((categories) => this.categoryOptions.set(categories.map((c) => ({ value: c.id, label: c.name }))));

    this.venueService.getAll().subscribe((venues) => {
      this.venues.set(venues);
    });

    this.ticketForm.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((kind) => {
      const typedKind = kind as TicketTypeKind;
      this.ticketKind.set(typedKind);
      if (typedKind === 'GRATUIT') {
        this.ticketForm.controls.price.setValue(0);
        this.ticketForm.controls.price.disable({ emitEvent: false });
      } else {
        this.ticketForm.controls.price.enable({ emitEvent: false });
      }
    });

    effect(() => {
      const id = this.id();
      if (id) {
        this.loadEvent(id);
      }
    });
  }

  protected invalid(control: AbstractControl | null | undefined): boolean {
    return !!control && control.invalid && control.touched;
  }

  protected openVenueCreateModal(): void {
    this.venueModalOpen.set(true);
  }

  protected onVenueCreated(venue: Venue): void {
    this.venues.update((list) => {
      if (list.some((v) => v.id === venue.id)) {
        return list.map((v) => (v.id === venue.id ? venue : v));
      }
      return [venue, ...list];
    });
    this.dateVenueForm.controls.venueId.setValue(venue.id);
    queueMicrotask(() => this.venueAutocomplete()?.selectCreated(venue));
    this.venueModalOpen.set(false);
  }

  protected coverImageError(): string | undefined {
    const control = this.infoForm.controls.coverImageUrl;
    if (!this.invalid(control)) return undefined;
    const message = control.errors?.['coverImageUrl'];
    return typeof message === 'string' ? message : undefined;
  }

  private resolvedCoverUrl(url: string): string | undefined {
    return isDirectImageUrl(url) ? url.trim() : undefined;
  }

  private resolveCategoryLabel(categoryId: string): string | undefined {
    if (!categoryId) return undefined;
    return this.categoryOptions().find((category) => category.value === categoryId)?.label;
  }

  protected kindLabel(kind: TicketTypeKind): string {
    return TICKET_KIND_LABELS[kind];
  }

  protected formatRecapDate(value: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  protected addTicketType(): void {
    this.ticketForm.markAllAsTouched();
    if (this.ticketForm.invalid) return;

    const value = this.ticketForm.getRawValue();
    this.ticketTypesDraft.update((list) => [
      ...list,
      {
        tempId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        persisted: false,
        name: value.name,
        kind: value.kind as TicketTypeKind,
        price: value.kind === 'GRATUIT' ? 0 : value.price,
        quantityTotal: value.quantityTotal,
        maxPerOrder: value.maxPerOrder || undefined,
        description: value.description || undefined
      }
    ]);
    this.formVersion.update((v) => v + 1);

    this.ticketForm.reset({ name: '', kind: 'STANDARD', price: 0, quantityTotal: 50, maxPerOrder: 5, description: '' });
  }

  protected removeTicketType(tempId: string): void {
    this.ticketTypesDraft.update((list) => list.filter((t) => t.tempId !== tempId));
    this.participantsDraft.update((list) => list.filter((p) => p.ticketTypeTempId !== tempId));
    this.formVersion.update((v) => v + 1);
  }

  protected ticketDraftLabel(tempId: string): string {
    return this.ticketTypesDraft().find((t) => t.tempId === tempId)?.name ?? 'Billet';
  }

  protected addParticipant(): void {
    this.participantForm.markAllAsTouched();
    if (this.participantForm.invalid) return;
    if (this.ticketTypesDraft().length === 0) {
      this.toast.error('Ajoutez d’abord un type de billet.');
      return;
    }

    const value = this.participantForm.getRawValue();
    this.participantsDraft.update((list) => [
      ...list,
      {
        tempId: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: value.email.trim(),
        phone: value.phone.trim() || undefined,
        ticketTypeTempId: value.ticketTypeTempId,
        quantity: Number(value.quantity) || 1
      }
    ]);

    const defaultTicket =
      this.ticketTypesDraft().find((t) => t.kind === 'STANDARD')?.tempId ?? this.ticketTypesDraft()[0]?.tempId ?? '';
    this.participantForm.reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      ticketTypeTempId: defaultTicket,
      quantity: 1
    });
  }

  protected removeParticipant(tempId: string): void {
    this.participantsDraft.update((list) => list.filter((p) => p.tempId !== tempId));
  }

  protected downloadImportTemplate(): void {
    downloadParticipantImportTemplate();
    this.toast.success('Modèle Excel téléchargé.');
  }

  protected openImportPicker(): void {
    const input = this.wizardImportInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  protected async onWizardImportFileSelected(domEvent: Event): Promise<void> {
    const input = domEvent.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.ticketTypesDraft().length === 0) {
      this.toast.error('Ajoutez d’abord au moins un type de billet.');
      return;
    }

    try {
      const result = await parseParticipantSpreadsheet(file);
      const defaultTicket =
        this.ticketTypesDraft().find((t) => t.kind === 'STANDARD')?.tempId ?? this.ticketTypesDraft()[0]?.tempId;
      if (!defaultTicket) return;

      const ticketTypes = this.ticketTypesDraft().map((t) => ({
        id: t.id ?? t.tempId,
        tempId: t.tempId,
        name: t.name
      }));

      const guests = result.rows
        .filter((row) => !row.error)
        .map((row) => ({
          tempId: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${row.rowNumber}`,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          ticketTypeTempId: matchTicketTypeId(row.ticketTypeName, ticketTypes, defaultTicket) ?? defaultTicket,
          quantity: row.quantity
        }));

      this.participantsDraft.update((list) => [...list, ...guests]);
      this.importSummary.set(
        `Import « ${file.name} » : ${guests.length} ajouté(s)` +
          (result.errorCount > 0 ? `, ${result.errorCount} ligne(s) ignorée(s)` : '')
      );
      this.toast.success(`${guests.length} participant(s) ajouté(s) à la liste.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de lire le fichier.';
      this.toast.error(message);
    }
  }

  protected goNext(): void {
    if (!this.validateCurrentStep()) return;
    this.currentStep.update((i) => Math.min(i + 1, this.steps.length - 1));
  }

  protected goPrev(): void {
    this.currentStep.update((i) => Math.max(i - 1, 0));
  }

  protected saveAsDraft(): void {
    this.save('BROUILLON');
  }

  protected publishNow(): void {
    this.save('PUBLIE');
  }

  private validateCurrentStep(): boolean {
    const index = this.currentStep();

    if (index === 0) {
      this.infoForm.markAllAsTouched();
      return this.infoForm.valid;
    }

    if (index === 1) {
      this.dateVenueForm.markAllAsTouched();
      if (this.dateVenueForm.invalid) return false;
      const { startAt, endAt } = this.dateVenueForm.getRawValue();
      if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        this.dateVenueForm.controls.endAt.setErrors({ beforeStart: true });
        return false;
      }
      return true;
    }

    if (index === 2) {
      this.capacityForm.markAllAsTouched();
      return this.capacityForm.valid;
    }

    if (index === 3) {
      if (this.ticketTypesDraft().length === 0) {
        this.toast.error('Ajoutez au moins un type de billet avant de continuer.');
        return false;
      }
      const defaultTicket =
        this.ticketTypesDraft().find((t) => t.kind === 'STANDARD')?.tempId ?? this.ticketTypesDraft()[0]?.tempId ?? '';
      if (!this.participantForm.controls.ticketTypeTempId.value) {
        this.participantForm.controls.ticketTypeTempId.setValue(defaultTicket);
      }
      return true;
    }

    if (index === 4) {
      // Participants are optional at creation time.
      return true;
    }

    return true;
  }

  private buildEventPayload(status?: EventStatus): CreateEventRequest {
    const info = this.infoForm.getRawValue();
    const dateVenue = this.dateVenueForm.getRawValue();
    const capacity = this.capacityForm.getRawValue();
    const drafts = this.ticketTypesDraft();
    const minTicketPrice = drafts.length > 0 ? Math.min(...drafts.map((t) => t.price)) : 0;

    return {
      title: info.title,
      description: info.description,
      shortDescription: info.shortDescription,
      coverImageUrl: this.resolvedCoverUrl(info.coverImageUrl),
      categoryId: info.categoryId,
      venueId: dateVenue.venueId,
      startAt: fromDatetimeLocalValue(dateVenue.startAt),
      endAt: fromDatetimeLocalValue(dateVenue.endAt),
      city: dateVenue.city,
      capacity: capacity.capacity,
      visibility: capacity.visibility as EventVisibility,
      isFree: capacity.isFree,
      priceFrom: capacity.isFree ? 0 : minTicketPrice,
      ...(status === 'PUBLIE' || status === 'BROUILLON' ? { status } : {})
    };
  }

  private save(status: EventStatus): void {
    if (this.saving()) return;
    this.saving.set(true);

    const payload = this.buildEventPayload(status);
    const pendingTicketTypes = this.ticketTypesDraft().filter((t) => !t.persisted);
    const guests = this.participantsDraft();

    const finalize = (eventId: string, currentStatus: EventStatus) => {
      const navigateToEvent = () => {
        this.saving.set(false);
        this.router.navigate(['/organisateur/evenements', eventId, 'inscriptions']);
      };

      if (currentStatus === status) {
        this.toast.success(
          status === 'PUBLIE'
            ? 'Événement publié.'
            : this.isEditMode()
              ? 'Événement mis à jour avec succès.'
              : 'Brouillon enregistré.'
        );
        navigateToEvent();
        return;
      }

      this.eventService.updateStatus(eventId, status).subscribe({
        next: () => {
          this.toast.success(status === 'PUBLIE' ? 'Événement publié.' : 'Statut mis à jour.');
          navigateToEvent();
        },
        error: () => {
          this.saving.set(false);
          this.toast.error(
            status === 'PUBLIE'
              ? "L'événement a été enregistré, mais la publication a échoué. Réessayez depuis l'édition."
              : 'Impossible de mettre à jour le statut.'
          );
          this.router.navigate(['/organisateur/evenements', eventId, 'modifier']);
        }
      });
    };

    const createTicketTypes = (eventId: string): Observable<TicketType[]> => {
      if (pendingTicketTypes.length === 0) return of([]);
      const requests = pendingTicketTypes.map((draft) => {
        const ticketPayload: CreateTicketTypeRequest = {
          eventId,
          name: draft.name,
          kind: draft.kind,
          price: draft.price,
          currency: 'MAD',
          quantityTotal: draft.quantityTotal,
          maxPerOrder: draft.maxPerOrder,
          description: draft.description
        };
        return this.ticketService.createTicketType(eventId, ticketPayload);
      });
      return forkJoin(requests);
    };

    const resolveTicketTypeIdMap = (created: TicketType[]): Record<string, string> => {
      const mapIds: Record<string, string> = {};
      for (const draft of this.ticketTypesDraft()) {
        if (draft.persisted && draft.id) {
          mapIds[draft.tempId] = draft.id;
        }
      }
      pendingTicketTypes.forEach((draft, index) => {
        const createdType = created[index];
        if (createdType) {
          mapIds[draft.tempId] = createdType.id;
        }
      });
      return mapIds;
    };

    const createParticipants = (eventId: string, ticketTypeIdByTempId: Record<string, string>): Observable<null> => {
      if (guests.length === 0) return of(null);
      const requests = guests.map((guest) => {
        const ticketTypeId = ticketTypeIdByTempId[guest.ticketTypeTempId];
        if (!ticketTypeId) {
          return of(null);
        }
        return this.registrationService.create({
          eventId,
          ticketTypeId,
          quantity: guest.quantity,
          participantFirstName: guest.firstName,
          participantLastName: guest.lastName,
          participantEmail: guest.email,
          participantPhone: guest.phone
        });
      });
      return forkJoin(requests).pipe(map(() => null));
    };

    const afterEventSaved = (eventId: string, currentStatus: EventStatus) => {
      createTicketTypes(eventId)
        .pipe(switchMap((created) => createParticipants(eventId, resolveTicketTypeIdMap(created))))
        .subscribe({
          next: () => finalize(eventId, currentStatus),
          error: () => {
            this.toast.error('Événement enregistré, mais certains participants n’ont pas pu être inscrits.');
            finalize(eventId, currentStatus);
          }
        });
    };

    const currentId = this.id();

    if (this.isEditMode() && currentId) {
      const { status: _ignoredStatus, ...updatePayload } = payload;
      this.eventService.update(currentId, updatePayload as UpdateEventRequest).subscribe({
        next: (event) => afterEventSaved(event.id, event.status),
        error: () => {
          this.saving.set(false);
          this.toast.error("Impossible d'enregistrer les modifications.");
        }
      });
    } else {
      this.eventService.create(payload).subscribe({
        next: (event) => afterEventSaved(event.id, event.status),
        error: () => {
          this.saving.set(false);
          this.toast.error("Impossible de créer l'événement.");
        }
      });
    }
  }

  private loadEvent(id: string): void {
    this.eventService.getById(id).subscribe({
      next: (event) => {
        this.currentStatus.set(event.status);
        this.infoForm.patchValue({
          title: event.title,
          shortDescription: event.shortDescription,
          description: event.description,
          categoryId: event.categoryId,
          coverImageUrl: event.coverImageUrl
        });
        this.dateVenueForm.patchValue({
          startAt: toDatetimeLocalValue(event.startAt),
          endAt: toDatetimeLocalValue(event.endAt),
          city: event.city,
          venueId: event.venueId
        });
        this.capacityForm.patchValue({
          capacity: event.capacity,
          visibility: event.visibility,
          isFree: event.isFree
        });
      },
      error: () => {
        this.toast.error('Événement introuvable.');
        this.router.navigate(['/organisateur/evenements']);
      }
    });

    this.ticketService.getTicketTypesByEvent(id).subscribe((types) => {
      this.ticketTypesDraft.set(
        types.map((t) => ({
          tempId: t.id,
          persisted: true,
          id: t.id,
          name: t.name,
          kind: t.kind,
          price: t.price,
          quantityTotal: t.quantityTotal,
          maxPerOrder: t.maxPerOrder,
          description: t.description
        }))
      );
    });
  }
}
