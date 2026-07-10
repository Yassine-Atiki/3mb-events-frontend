import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';

@Component({
  selector: 'app-side-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    @if (open()) {
      <button
        type="button"
        class="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Fermer le panneau"
        (click)="close.emit()"
      ></button>
      <aside
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-hairline bg-organizer-surface shadow-[0_0_40px_rgba(15,23,42,0.12)]"
        role="dialog"
        [attr.aria-label]="title()"
      >
        <header class="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 class="text-base font-semibold text-text-primary">{{ title() }}</h2>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-organizer-bg hover:text-text-primary"
            aria-label="Fermer"
            (click)="close.emit()"
          >
            <lucide-angular [img]="icons.X" [size]="18"></lucide-angular>
          </button>
        </header>
        <div class="flex-1 overflow-y-auto px-5 py-5">
          <ng-content />
        </div>
        @if (hasFooter()) {
          <footer class="border-t border-hairline px-5 py-4">
            <ng-content select="[drawerFooter]" />
          </footer>
        }
      </aside>
    }
  `
})
export class SideDrawerComponent {
  readonly open = input(false);
  readonly title = input('Détails');
  readonly hasFooter = input(false);

  readonly close = output<void>();

  protected readonly icons = { X };
}
