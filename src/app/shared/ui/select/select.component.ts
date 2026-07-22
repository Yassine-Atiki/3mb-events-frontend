import { NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Check, ChevronDown, LucideAngularModule } from 'lucide-angular';

export interface SelectOption {
  value: string;
  label: string;
}

const TRIGGER_BASE =
  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-surface-white px-4 py-2.5 text-left text-sm ' +
  'transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const TRIGGER_VALID =
  'border-gray-200 hover:border-brand-teal/35 hover:bg-surface-light/40 focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/15';

const TRIGGER_ERROR = 'border-red-400 focus:border-red-400 focus:ring-4 focus:ring-red-400/15';

const TRIGGER_OPEN = 'border-brand-teal ring-4 ring-brand-teal/15';

let nextSelectId = 0;

@Component({
  selector: 'app-ui-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle, LucideAngularModule],
  host: { class: 'block' },
  templateUrl: './select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ]
})
export class SelectComponent implements ControlValueAccessor {
  readonly label = input<string | undefined>(undefined);
  readonly options = input<SelectOption[]>([]);
  readonly placeholder = input('Sélectionner...');
  readonly error = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  /** When false, the placeholder cannot be chosen from the list (display only). */
  readonly clearable = input(true);

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly icons = { ChevronDown, Check };
  protected readonly selectId = `app-ui-select-${nextSelectId++}`;
  protected readonly listboxId = `${this.selectId}-listbox`;

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly highlightedIndex = signal(-1);
  protected readonly panelStyle = signal<Record<string, string>>({});

  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.value === this.value()) ?? null
  );

  protected readonly displayLabel = computed(() => this.selectedOption()?.label ?? this.placeholder());

  protected readonly hasSelection = computed(() => Boolean(this.selectedOption()));

  protected readonly triggerClasses = computed(() => {
    const classes = [TRIGGER_BASE, this.error() ? TRIGGER_ERROR : TRIGGER_VALID];
    if (this.open()) classes.push(TRIGGER_OPEN);
    return classes.join(' ');
  });

  protected readonly menuEntries = computed(() => {
    const entries: Array<{ value: string; label: string; placeholder?: boolean }> = [];
    if (this.clearable()) {
      entries.push({ value: '', label: this.placeholder(), placeholder: true });
    }
    entries.push(...this.options());
    return entries;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.open()) this.updatePanelPosition();
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    this.syncHighlightedIndex();
    this.updatePanelPosition();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.open.set(true);
          this.syncHighlightedIndex();
          this.updatePanelPosition();
        } else {
          this.moveHighlight(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) {
          this.open.set(true);
          this.syncHighlightedIndex();
          this.updatePanelPosition();
        } else {
          this.moveHighlight(-1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.open()) {
          this.selectHighlighted();
        } else {
          this.toggle();
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Home':
        if (this.open()) {
          event.preventDefault();
          this.highlightedIndex.set(0);
        }
        break;
      case 'End':
        if (this.open()) {
          event.preventDefault();
          this.highlightedIndex.set(this.menuEntries().length - 1);
        }
        break;
    }
  }

  protected selectOption(value: string): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
    this.close();
    this.triggerRef()?.nativeElement.focus();
  }

  protected isSelected(value: string): boolean {
    return this.value() === value;
  }

  protected isHighlighted(index: number): boolean {
    return this.highlightedIndex() === index;
  }

  protected handleBlur(): void {
    this.onTouched();
  }

  private close(): void {
    this.open.set(false);
    this.highlightedIndex.set(-1);
  }

  private syncHighlightedIndex(): void {
    const current = this.value();
    const index = this.menuEntries().findIndex((entry) => entry.value === current);
    this.highlightedIndex.set(index >= 0 ? index : 0);
  }

  private moveHighlight(delta: number): void {
    const entries = this.menuEntries();
    if (entries.length === 0) return;
    const next = (this.highlightedIndex() + delta + entries.length) % entries.length;
    this.highlightedIndex.set(next);
  }

  private selectHighlighted(): void {
    const entry = this.menuEntries()[this.highlightedIndex()];
    if (entry) this.selectOption(entry.value);
  }

  private updatePanelPosition(): void {
    const trigger = this.triggerRef()?.nativeElement;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelMaxHeight = 256;
    const gap = 6;
    const minPanelHeight = 96;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < minPanelHeight + gap && spaceAbove > spaceBelow;

    // Absolute within the trigger wrapper — avoids broken fixed coords when an
    // ancestor has transform (e.g. page enter animations).
    if (openUp) {
      this.panelStyle.set({
        position: 'absolute',
        left: '0',
        width: '100%',
        top: 'auto',
        bottom: `${trigger.offsetHeight + gap}px`,
        'max-height': `${Math.max(minPanelHeight, Math.min(panelMaxHeight, spaceAbove - gap - 8))}px`,
        'z-index': '1200'
      });
    } else {
      this.panelStyle.set({
        position: 'absolute',
        left: '0',
        width: '100%',
        top: `${trigger.offsetHeight + gap}px`,
        bottom: 'auto',
        'max-height': `${Math.max(minPanelHeight, Math.min(panelMaxHeight, spaceBelow - gap - 8))}px`,
        'z-index': '1200'
      });
    }
  }
}
