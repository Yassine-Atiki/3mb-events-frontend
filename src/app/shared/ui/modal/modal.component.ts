import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-ui-modal',
  standalone: true,
  templateUrl: './modal.component.html'
})
export class ModalComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string | undefined>(undefined);

  readonly close = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLDivElement>>('dialog');

  constructor() {
    effect(() => {
      if (this.open()) {
        queueMicrotask(() => this.dialog()?.nativeElement.focus());
      }
    });
  }

  protected onBackdropClick(): void {
    this.close.emit();
  }

  protected onEscape(event: Event): void {
    if ((event as KeyboardEvent).key === 'Escape') {
      this.close.emit();
    }
  }
}
