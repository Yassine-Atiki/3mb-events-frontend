import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Eye, EyeOff, LucideAngularModule, type LucideIconData } from 'lucide-angular';

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'search'
  | 'url'
  | 'date'
  | 'datetime-local';

const BASE_CLASSES =
  'w-full rounded-xl border bg-surface-white px-4 py-2.5 text-sm text-text-primary ' +
  'placeholder:text-text-secondary/60 transition-all duration-200 focus:outline-none ' +
  'focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60';

const VALID_CLASSES = 'border-gray-200 focus:border-brand-teal focus:ring-brand-teal/15 focus:bg-white';
const ERROR_CLASSES = 'border-red-400 focus:border-red-400 focus:ring-red-400/15';

let nextInputId = 0;

@Component({
  selector: 'app-ui-input',
  standalone: true,
  imports: [LucideAngularModule],
  host: {
    class: 'block'
  },
  templateUrl: './input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  styles: [
    `
      .ui-input-native::-ms-reveal,
      .ui-input-native::-ms-clear {
        display: none;
      }
    `
  ]
})
export class InputComponent implements ControlValueAccessor {
  readonly label = input<string | undefined>(undefined);
  readonly type = input<InputType>('text');
  readonly placeholder = input('');
  readonly leadingIcon = input<LucideIconData | undefined>(undefined);
  readonly error = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);

  protected readonly icons = { Eye, EyeOff };
  protected readonly inputId = `app-ui-input-${nextInputId++}`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly passwordVisible = signal(false);

  protected readonly isPasswordField = computed(() => this.type() === 'password');

  protected readonly resolvedType = computed<InputType>(() =>
    this.isPasswordField() ? (this.passwordVisible() ? 'text' : 'password') : this.type()
  );

  protected readonly inputClasses = computed(() => {
    const trailingPad = this.isPasswordField() ? ' pr-11' : '';
    const leadingPad = this.leadingIcon() ? ' pl-10' : '';
    return `${BASE_CLASSES} ${this.error() ? ERROR_CLASSES : VALID_CLASSES}${leadingPad}${trailingPad}`;
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
  }

  protected handleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected handleBlur(): void {
    this.onTouched();
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }
}
