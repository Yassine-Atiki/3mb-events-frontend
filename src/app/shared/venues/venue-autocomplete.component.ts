import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  HostListener,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule, MapPin, Plus, Search, X } from 'lucide-angular';

import { Venue } from '../../core/models';

interface DropdownBox {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

@Component({
  selector: 'app-venue-autocomplete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VenueAutocompleteComponent),
      multi: true
    }
  ],
  host: {
    class: 'block',
    '[class.is-open]': 'open()'
  },
  styles: [
    `
      :host {
        display: block;
        position: relative;
        z-index: 1;
      }

      :host(.is-open) {
        z-index: 50;
      }

      .vac-field {
        position: relative;
      }

      .vac-icon {
        pointer-events: none;
        position: absolute;
        left: 0.9rem;
        top: 50%;
        z-index: 2;
        transform: translateY(-50%);
        color: var(--color-brand-teal-dark);
        opacity: 0.85;
      }

      .vac-input {
        width: 100%;
        border-radius: 0.85rem;
        border: 1px solid var(--color-hairline);
        background: #fff;
        padding: 0.65rem 2.5rem 0.65rem 2.65rem;
        font-size: 0.875rem;
        color: var(--color-text-primary);
        outline: none;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }

      .vac-input::placeholder {
        color: color-mix(in srgb, var(--color-text-secondary) 65%, transparent);
      }

      .vac-input:focus {
        border-color: var(--color-brand-teal);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-brand-teal) 15%, transparent);
      }

      .vac-input.is-invalid {
        border-color: #f87171;
      }

      .vac-input.is-invalid:focus {
        border-color: #f87171;
        box-shadow: 0 0 0 4px color-mix(in srgb, #f87171 15%, transparent);
      }

      .vac-input:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .vac-clear {
        position: absolute;
        right: 0.55rem;
        top: 50%;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 1.5rem;
        height: 1.5rem;
        transform: translateY(-50%);
        border: 0;
        border-radius: 9999px;
        background: var(--color-surface-light);
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      /* Fixed so parent overflow:hidden (e.g. .organizer-panel) cannot clip it. */
      .vac-dropdown {
        position: fixed;
        z-index: 1200;
        margin: 0;
        overflow-x: hidden;
        overflow-y: auto;
        border-radius: 0.85rem;
        border: 1px solid var(--color-hairline);
        background: #fff;
        box-shadow: 0 14px 32px rgba(19, 26, 23, 0.16);
      }

      .vac-list {
        margin: 0;
        padding: 0.4rem;
        list-style: none;
      }

      .vac-option {
        display: flex;
        width: 100%;
        align-items: flex-start;
        gap: 0.55rem;
        border: 0;
        border-radius: 0.6rem;
        background: transparent;
        padding: 0.55rem 0.65rem;
        text-align: left;
        color: var(--color-text-primary);
        cursor: pointer;
      }

      .vac-option:hover {
        background: color-mix(in srgb, var(--color-brand-teal) 10%, white);
      }

      .vac-option-title {
        display: block;
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1.35;
      }

      .vac-option-meta {
        display: block;
        margin-top: 0.15rem;
        font-size: 0.75rem;
        line-height: 1.35;
        color: var(--color-text-secondary);
      }

      .vac-create {
        display: flex;
        width: 100%;
        align-items: flex-start;
        gap: 0.55rem;
        border: 0;
        background: transparent;
        padding: 0.85rem 0.9rem;
        text-align: left;
        color: var(--color-brand-teal-dark);
        cursor: pointer;
      }

      .vac-create:hover {
        background: color-mix(in srgb, var(--color-brand-teal) 10%, white);
      }

      .vac-error {
        margin: 0;
        font-size: 0.75rem;
        color: #ef4444;
      }
    `
  ],
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <label class="text-sm font-medium text-text-primary" [attr.for]="inputId">{{ label() }}</label>
      }

      <div class="vac-field" #anchor>
        <lucide-angular [img]="icons.Search" [size]="15" class="vac-icon"></lucide-angular>
        <input
          #inputEl
          [id]="inputId"
          type="text"
          role="combobox"
          [attr.aria-expanded]="open()"
          aria-autocomplete="list"
          autocomplete="off"
          class="vac-input"
          [class.is-invalid]="!!error()"
          [placeholder]="placeholder()"
          [value]="query()"
          [disabled]="disabled()"
          (input)="onQueryInput($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
        />
        @if (query()) {
          <button
            type="button"
            class="vac-clear"
            aria-label="Effacer"
            (mousedown)="$event.preventDefault()"
            (click)="clear()"
          >
            <lucide-angular [img]="icons.X" [size]="14"></lucide-angular>
          </button>
        }
      </div>

      @if (open() && dropdownBox(); as box) {
        <div
          class="vac-dropdown"
          role="listbox"
          [style.top.px]="box.top"
          [style.left.px]="box.left"
          [style.width.px]="box.width"
          [style.maxHeight.px]="box.maxHeight"
        >
          @if (matches().length > 0) {
            <ul class="vac-list">
              @for (venue of matches(); track venue.id) {
                <li>
                  <button
                    type="button"
                    role="option"
                    class="vac-option"
                    (mousedown)="$event.preventDefault()"
                    (click)="selectVenue(venue)"
                  >
                    <lucide-angular
                      [img]="icons.MapPin"
                      [size]="14"
                      class="mt-0.5 shrink-0 text-brand-teal-dark"
                    ></lucide-angular>
                    <span class="min-w-0 flex-1">
                      <span class="vac-option-title">{{ venue.name }}</span>
                      <span class="vac-option-meta"
                        >{{ venue.city }}{{ venue.address ? ' · ' + venue.address : '' }}</span
                      >
                    </span>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <button
              type="button"
              class="vac-create"
              (mousedown)="$event.preventDefault()"
              (click)="requestCreate()"
            >
              <lucide-angular [img]="icons.Plus" [size]="15" class="mt-0.5 shrink-0"></lucide-angular>
              <span class="min-w-0 leading-snug">
                <span class="font-medium">Le lieu n'existe pas dans la liste ?</span>
                <span class="mt-0.5 block text-brand-teal">→ Ajouter un nouveau lieu</span>
              </span>
            </button>
          }
        </div>
      }

      @if (error() && !open()) {
        <p class="vac-error">{{ error() }}</p>
      }
    </div>
  `
})
export class VenueAutocompleteComponent implements ControlValueAccessor {
  readonly label = input<string | undefined>('Lieu');
  readonly placeholder = input('Rechercher un lieu…');
  readonly error = input<string | undefined>(undefined);
  readonly venues = input<Venue[]>([]);

  readonly createRequested = output<void>();

  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');

  protected readonly icons = { Search, MapPin, Plus, X };
  protected readonly inputId = `venue-ac-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  protected readonly selectedId = signal<string>('');
  protected readonly dropdownBox = signal<DropdownBox | null>(null);

  protected readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.venues();
    if (!q) return list.slice(0, 50);
    return list.filter((venue) => {
      const haystack = `${venue.name} ${venue.city} ${venue.address}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private skipQuerySync = false;

  constructor() {
    effect(() => {
      const id = this.selectedId();
      const venues = this.venues();
      if (this.skipQuerySync) return;
      if (!id) return;
      const venue = venues.find((v) => v.id === id);
      if (venue) {
        this.query.set(`${venue.name} — ${venue.city}`);
      }
    });
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onViewportChange(): void {
    if (this.open()) {
      this.updateDropdownPosition();
    }
  }

  writeValue(value: string | null): void {
    const id = value ?? '';
    this.selectedId.set(id);
    if (!id) {
      this.query.set('');
      return;
    }
    const venue = this.venues().find((v) => v.id === id);
    if (venue) {
      this.query.set(`${venue.name} — ${venue.city}`);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  selectCreated(venue: Venue): void {
    this.skipQuerySync = true;
    this.selectedId.set(venue.id);
    this.query.set(`${venue.name} — ${venue.city}`);
    this.open.set(false);
    this.dropdownBox.set(null);
    this.onChange(venue.id);
    this.onTouched();
    this.skipQuerySync = false;
  }

  protected onFocus(): void {
    this.open.set(true);
    queueMicrotask(() => this.updateDropdownPosition());
  }

  protected onBlur(): void {
    window.setTimeout(() => {
      this.open.set(false);
      this.dropdownBox.set(null);
      this.onTouched();
      this.reconcileQueryWithSelection();
    }, 150);
  }

  protected onQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.open.set(true);
    queueMicrotask(() => this.updateDropdownPosition());
    if (this.selectedId()) {
      this.selectedId.set('');
      this.onChange('');
    }
  }

  protected clear(): void {
    this.query.set('');
    this.selectedId.set('');
    this.onChange('');
    this.open.set(true);
    queueMicrotask(() => this.updateDropdownPosition());
  }

  protected selectVenue(venue: Venue): void {
    this.skipQuerySync = true;
    this.selectedId.set(venue.id);
    this.query.set(`${venue.name} — ${venue.city}`);
    this.open.set(false);
    this.dropdownBox.set(null);
    this.onChange(venue.id);
    this.onTouched();
    this.skipQuerySync = false;
  }

  protected requestCreate(): void {
    this.open.set(false);
    this.dropdownBox.set(null);
    this.createRequested.emit();
  }

  private updateDropdownPosition(): void {
    const el = this.anchor()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const maxHeight = Math.max(140, Math.min(280, spaceBelow));
    this.dropdownBox.set({
      top: rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight
    });
  }

  private reconcileQueryWithSelection(): void {
    const id = this.selectedId();
    if (!id) return;
    const venue = this.venues().find((v) => v.id === id);
    if (venue) {
      this.query.set(`${venue.name} — ${venue.city}`);
    }
  }
}
