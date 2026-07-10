import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Plus, Trash2 } from 'lucide-angular';

import { EventService } from '../../core/api/event.service';
import { CreateTicketTypeRequest, TicketService, UpdateTicketTypeRequest } from '../../core/api/ticket.service';
import { TicketType, TicketTypeKind } from '../../core/models';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

const KIND_OPTIONS: SelectOption[] = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'VIP', label: 'VIP' },
  { value: 'GRATUIT', label: 'Gratuit' },
  { value: 'EARLY_BIRD', label: 'Early Bird' },
  { value: 'GROUPE', label: 'Groupe' }
];

const KIND_LABELS: Record<TicketTypeKind, string> = {
  STANDARD: 'Standard',
  VIP: 'VIP',
  GRATUIT: 'Gratuit',
  EARLY_BIRD: 'Early Bird',
  GROUPE: 'Groupe'
};

@Component({
  selector: 'app-organizer-event-tickets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    SelectComponent,
    EmptyStateComponent,
    SkeletonComponent,
    OccupancyArcComponent
  ],
  template: `
    <div class="organizer-page mx-auto max-w-4xl">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            routerLink="/organisateur/evenements"
            class="inline-flex items-center gap-1 text-xs font-medium text-brand-teal-dark hover:underline"
          >
            <lucide-angular [img]="icons.ArrowLeft" [size]="13"></lucide-angular>
            Retour
          </a>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-text-primary">Types de billets</h1>
          <p class="mt-0.5 text-sm text-text-secondary">{{ eventTitle() }} — configurez vos stubs visuels</p>
        </div>
        <app-ui-button (clicked)="startCreate()">
          <lucide-angular [img]="icons.Plus" [size]="16"></lucide-angular>
          Nouveau type
        </app-ui-button>
      </header>

      <div class="stacked-card-list mt-6">
        @if (loading()) {
          <app-ui-skeleton height="200px" rounded="2xl" />
        } @else if (ticketTypes().length === 0 && !creating()) {
          <app-ui-empty-state
            title="Aucun type de billet"
            description="Créez votre premier stub de billet pour ouvrir les réservations."
          />
        } @else {
          @for (ticket of ticketTypes(); track ticket.id) {
            @if (editingId() === ticket.id) {
              <div class="ticket-stub p-5">
                <ng-container *ngTemplateOutlet="stubForm" />
              </div>
            } @else {
              <div
                class="ticket-stub ticket-stub-erosion flex items-center gap-4 p-5"
                [style.--erosion]="erosionFor(ticket)"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="text-base font-semibold text-text-primary">{{ ticket.name }}</h3>
                    <span class="rounded-md bg-organizer-bg px-2 py-0.5 text-[10px] font-semibold uppercase text-text-secondary">
                      {{ kindLabel(ticket.kind) }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-text-secondary">
                    {{ ticket.price === 0 ? 'Gratuit' : ticket.price + ' ' + ticket.currency }}
                    @if (ticket.description) {
                      · {{ ticket.description }}
                    }
                  </p>
                  <p class="mt-2 font-mono text-sm tabular-nums text-brand-teal-dark">
                    {{ ticket.quantitySold }} / {{ ticket.quantityTotal }} vendus
                  </p>
                </div>
                <app-occupancy-arc
                  [current]="ticket.quantitySold"
                  [max]="ticket.quantityTotal"
                  [size]="72"
                  [strokeWidth]="6"
                  [showRatio]="false"
                />
                <div class="flex flex-col gap-1">
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-teal-dark hover:bg-brand-teal/10"
                    (click)="openEdit(ticket)"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-organizer-bg hover:text-status-cancelled"
                    (click)="deleteTicketType(ticket)"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            }
          }

          @if (creating()) {
            <div class="ticket-stub p-5">
              <p class="mb-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">Nouveau billet</p>
              <ng-container *ngTemplateOutlet="stubForm" />
            </div>
          }
        }
      </div>

      <ng-template #stubForm>
        <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2">
          <app-ui-select label="Type" [options]="kindOptions" formControlName="kind" />
          <app-ui-input label="Nom" formControlName="name" [error]="invalid('name') ? 'Requis' : undefined" />
          <app-ui-input label="Prix (MAD)" type="number" formControlName="price" />
          <app-ui-input label="Quantité totale" type="number" formControlName="quantityTotal" />
          <app-ui-input label="Max / commande" type="number" formControlName="maxPerOrder" />
          <app-ui-input label="Description" formControlName="description" class="sm:col-span-2" />
          <div class="ui-modal-footer sm:col-span-2">
            <app-ui-button type="submit" [loading]="saving()">Enregistrer</app-ui-button>
            <app-ui-button type="button" variant="secondary" (clicked)="cancelEdit()">Annuler</app-ui-button>
          </div>
        </form>
      </ng-template>
    </div>
  `
})
export class EventTicketsPage {
  readonly id = input<string>();

  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly ticketService = inject(TicketService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { ArrowLeft, Plus, Trash2 };
  protected readonly kindOptions = KIND_OPTIONS;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly eventTitle = signal('');
  protected readonly ticketTypes = signal<TicketType[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected readonly creating = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    kind: ['STANDARD', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    quantityTotal: [50, [Validators.required, Validators.min(1)]],
    maxPerOrder: [5],
    description: ['']
  });

  constructor() {
    effect(() => {
      const eventId = this.id();
      if (eventId) this.load(eventId);
    });
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected kindLabel(kind: TicketTypeKind): string {
    return KIND_LABELS[kind];
  }

  protected erosionFor(ticket: TicketType): number {
    if (ticket.quantityTotal <= 0) return 0;
    return Math.min(1, ticket.quantitySold / ticket.quantityTotal);
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.creating.set(true);
    this.form.reset({ name: '', kind: 'STANDARD', price: 0, quantityTotal: 50, maxPerOrder: 5, description: '' });
  }

  protected openEdit(ticket: TicketType): void {
    this.creating.set(false);
    this.editingId.set(ticket.id);
    this.form.reset({
      name: ticket.name,
      kind: ticket.kind,
      price: ticket.price,
      quantityTotal: ticket.quantityTotal,
      maxPerOrder: ticket.maxPerOrder ?? 5,
      description: ticket.description ?? ''
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.creating.set(false);
  }

  protected deleteTicketType(ticket: TicketType): void {
    const confirmed = typeof window === 'undefined' || window.confirm(`Supprimer "${ticket.name}" ?`);
    if (!confirmed) return;

    this.ticketService.deleteTicketType(ticket.id).subscribe({
      next: () => {
        this.ticketTypes.update((list) => list.filter((tt) => tt.id !== ticket.id));
        this.toast.success('Type de billet supprimé.');
      },
      error: () => this.toast.error('Impossible de supprimer ce type de billet.')
    });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const eventId = this.id();
    if (!eventId) return;

    const value = this.form.getRawValue();
    this.saving.set(true);
    const editingId = this.editingId();

    if (editingId) {
      const payload: UpdateTicketTypeRequest = {
        name: value.name,
        kind: value.kind as TicketTypeKind,
        price: value.price,
        quantityTotal: value.quantityTotal,
        maxPerOrder: value.maxPerOrder || undefined,
        description: value.description || undefined
      };
      this.ticketService.updateTicketType(editingId, payload).subscribe({
        next: (updated) => {
          this.ticketTypes.update((list) => list.map((tt) => (tt.id === updated.id ? updated : tt)));
          this.saving.set(false);
          this.cancelEdit();
          this.toast.success('Billet mis à jour.');
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Impossible de mettre à jour.');
        }
      });
    } else {
      const payload: CreateTicketTypeRequest = {
        eventId,
        name: value.name,
        kind: value.kind as TicketTypeKind,
        price: value.price,
        currency: 'MAD',
        quantityTotal: value.quantityTotal,
        maxPerOrder: value.maxPerOrder || undefined,
        description: value.description || undefined
      };
      this.ticketService.createTicketType(eventId, payload).subscribe({
        next: (created) => {
          this.ticketTypes.update((list) => [...list, created]);
          this.saving.set(false);
          this.cancelEdit();
          this.toast.success('Billet ajouté.');
        },
        error: () => {
          this.saving.set(false);
          this.toast.error("Impossible d'ajouter le billet.");
        }
      });
    }
  }

  private load(eventId: string): void {
    this.loading.set(true);

    this.eventService.getById(eventId).subscribe({
      next: (event) => this.eventTitle.set(event.title),
      error: () => this.eventTitle.set('')
    });

    this.ticketService.getTicketTypesByEvent(eventId).subscribe({
      next: (types) => {
        this.ticketTypes.set(types);
        this.loading.set(false);
      },
      error: () => {
        this.ticketTypes.set([]);
        this.loading.set(false);
      }
    });
  }
}
