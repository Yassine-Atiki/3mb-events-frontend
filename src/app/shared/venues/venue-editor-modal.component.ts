import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, MapPin } from 'lucide-angular';

import { ResolvedAddress } from '../../core/api/nominatim.service';
import { CreateVenueRequest, UpdateVenueRequest, VenueService } from '../../core/api/venue.service';
import { Venue } from '../../core/models';
import {
  MapCoordinates,
  MapLocationComponent
} from '../map/map-location.component';
import { ButtonComponent } from '../ui/button/button.component';
import { ConfirmDialogService } from '../ui/confirm-dialog/confirm-dialog.service';
import { InputComponent } from '../ui/input/input.component';
import { ModalComponent } from '../ui/modal/modal.component';
import { ToastService } from '../ui/toast/toast.service';

interface VenueForm {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  capacity: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
}

const EMPTY_FORM: VenueForm = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Maroc',
  capacity: '',
  description: '',
  latitude: null,
  longitude: null
};

/**
 * Shared “Nouveau lieu / Modifier le lieu” modal (map picker included).
 * Used by Admin → Lieux and the organizer event wizard.
 */
@Component({
  selector: 'app-venue-editor-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ButtonComponent, InputComponent, ModalComponent, MapLocationComponent],
  template: `
    <app-ui-modal
      [open]="open()"
      size="lg"
      [title]="editing() ? 'Modifier le lieu' : 'Nouveau lieu'"
      (close)="close.emit()"
    >
      <div class="flex flex-col gap-4">
        @if (form().name.trim() && form().city.trim()) {
          <div class="admin-modal-hero">
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
              <lucide-angular [img]="icons.MapPin" [size]="13"></lucide-angular>
              {{ form().city }}{{ form().country ? ', ' + form().country : '' }}
            </span>
            <p class="mt-2 text-lg font-semibold text-white">{{ form().name }}</p>
            @if (form().capacity) {
              <p class="mt-1 font-mono text-sm text-brand-teal-light">{{ form().capacity }} places</p>
            }
          </div>
        }

        <app-ui-input
          label="Nom"
          placeholder="Ex. Palais des Congrès"
          [ngModel]="form().name"
          (ngModelChange)="updateForm('name', $event)"
        />

        @if (open()) {
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-text-primary">Position sur la carte</label>
            <app-map-location
              mode="edit"
              [latitude]="form().latitude"
              [longitude]="form().longitude"
              (coordinatesChange)="onMapCoordinates($event)"
              (addressChange)="onMapAddress($event)"
            />
          </div>
        }

        <app-ui-input
          label="Adresse"
          placeholder="Adresse complète (ex. Morocco Mall, Boulevard de Biarritz, Casablanca…)"
          [ngModel]="form().address"
          (ngModelChange)="updateForm('address', $event)"
        />
        <div class="grid grid-cols-2 gap-3">
          <app-ui-input
            label="Ville"
            placeholder="Ex. Casablanca"
            [ngModel]="form().city"
            (ngModelChange)="updateForm('city', $event)"
          />
          <app-ui-input
            label="Code postal"
            placeholder="Ex. 20000"
            [ngModel]="form().postalCode"
            (ngModelChange)="updateForm('postalCode', $event)"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <app-ui-input
            label="Pays"
            placeholder="Ex. Maroc"
            [ngModel]="form().country"
            (ngModelChange)="updateForm('country', $event)"
          />
          <app-ui-input
            label="Capacité"
            type="number"
            placeholder="Ex. 500"
            [ngModel]="form().capacity"
            (ngModelChange)="updateForm('capacity', $event)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-text-primary">Description</label>
          <textarea
            rows="3"
            class="w-full rounded-xl border border-hairline bg-surface-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-4 focus:ring-brand-teal/15"
            placeholder="Description du lieu..."
            [ngModel]="form().description"
            (ngModelChange)="updateForm('description', $event)"
          ></textarea>
        </div>

        <div class="ui-modal-footer">
          @if (allowDelete() && editing()) {
            <app-ui-button variant="danger" [loading]="deleting()" (clicked)="deleteVenue()">
              Supprimer
            </app-ui-button>
          }
          <app-ui-button
            [disabled]="!form().name.trim() || !form().city.trim()"
            [loading]="saving()"
            (clicked)="save()"
          >
            {{ editing() ? 'Enregistrer' : 'Créer' }}
          </app-ui-button>
        </div>
      </div>
    </app-ui-modal>
  `
})
export class VenueEditorModalComponent {
  readonly open = input(false);
  /** When set, modal opens in edit mode for that venue. */
  readonly venue = input<Venue | null>(null);
  readonly allowDelete = input(false);

  readonly close = output<void>();
  readonly saved = output<Venue>();
  readonly deleted = output<Venue>();

  private readonly venueService = inject(VenueService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly icons = { MapPin };
  protected readonly form = signal<VenueForm>({ ...EMPTY_FORM });
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly editing = signal<Venue | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const venue = this.venue();
      this.editing.set(venue);
      if (venue) {
        this.form.set({
          name: venue.name,
          address: venue.address,
          city: venue.city,
          postalCode: venue.postalCode ?? '',
          country: venue.country,
          capacity: venue.capacity ? String(venue.capacity) : '',
          description: venue.description ?? '',
          latitude: venue.latitude ?? null,
          longitude: venue.longitude ?? null
        });
      } else {
        this.form.set({ ...EMPTY_FORM });
      }
    });
  }

  protected updateForm<K extends keyof VenueForm>(key: K, value: VenueForm[K]): void {
    this.form.update((form) => ({ ...form, [key]: value }));
  }

  protected onMapCoordinates(coords: MapCoordinates): void {
    this.form.update((form) => ({
      ...form,
      latitude: coords.latitude,
      longitude: coords.longitude
    }));
  }

  protected onMapAddress(address: ResolvedAddress): void {
    this.form.update((form) => ({
      ...form,
      address: address.address || form.address,
      city: address.city || form.city,
      postalCode: address.postalCode || form.postalCode,
      country: address.country || form.country
    }));
  }

  protected save(): void {
    const form = this.form();
    const name = form.name.trim();
    const city = form.city.trim();
    if (!name || !city) return;

    const payload: CreateVenueRequest | UpdateVenueRequest = {
      name,
      address: form.address.trim(),
      city,
      postalCode: form.postalCode.trim() || undefined,
      country: form.country.trim() || 'Maroc',
      capacity: form.capacity ? Number(form.capacity) : undefined,
      description: form.description.trim() || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined
    };

    this.saving.set(true);
    const editing = this.editing();
    const request = editing
      ? this.venueService.update(editing.id, payload)
      : this.venueService.create(payload as CreateVenueRequest);

    request.subscribe({
      next: (venue) => {
        this.saving.set(false);
        this.toast.success(editing ? 'Lieu mis à jour.' : 'Lieu créé.');
        this.saved.emit(venue);
        this.close.emit();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error("Impossible d'enregistrer ce lieu.");
      }
    });
  }

  protected async deleteVenue(): Promise<void> {
    const venue = this.editing();
    if (!venue) return;
    const confirmed = await this.confirmDialog.confirm({
      title: 'Supprimer ce lieu ?',
      message: `« ${venue.name} » sera définitivement retiré. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger'
    });
    if (!confirmed) return;

    this.deleting.set(true);
    this.venueService.delete(venue.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Lieu supprimé.');
        this.deleted.emit(venue);
        this.close.emit();
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('Impossible de supprimer ce lieu.');
      }
    });
  }
}
