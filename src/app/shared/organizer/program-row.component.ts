import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OccupancyArcComponent } from './occupancy-arc.component';
import { StatusDotComponent } from './status-dot.component';
import { eventFunctionalStatus } from './functional-status';

@Component({
  selector: 'app-program-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, OccupancyArcComponent, StatusDotComponent],
  template: `
    <a
      [routerLink]="link()"
      class="group flex min-w-[280px] shrink-0 items-center gap-4 rounded-xl border border-hairline bg-organizer-surface px-4 py-3 transition-all duration-200 hover:border-brand-teal/25 hover:shadow-soft"
    >
      <div class="w-14 shrink-0 text-center">
        <div class="font-mono text-lg font-semibold tabular-nums leading-none text-text-primary">
          {{ day() }}
        </div>
        <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          {{ month() }}
        </div>
      </div>

      <div class="h-10 w-px shrink-0 bg-hairline" aria-hidden="true"></div>

      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-text-primary group-hover:text-brand-teal-dark">
          {{ title() }}
        </div>
        <div class="mt-0.5 truncate text-xs text-text-secondary">{{ subtitle() }}</div>
        <div class="mt-1.5">
          <app-status-dot [label]="statusLabel()" [tone]="statusTone()" />
        </div>
      </div>

      @if (showArc()) {
        <app-occupancy-arc
          [current]="occupied()"
          [max]="capacity()"
          [size]="52"
          [strokeWidth]="5"
          [showRatio]="false"
          class="shrink-0"
        />
      }
    </a>
  `
})
export class ProgramRowComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly dateIso = input.required<string>();
  readonly status = input.required<string>();
  readonly occupied = input(0);
  readonly capacity = input(100);
  readonly link = input<string[]>([]);
  readonly showArc = input(true);

  protected day(): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(new Date(this.dateIso()));
  }

  protected month(): string {
    return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(this.dateIso()));
  }

  protected statusLabel(): string {
    return eventFunctionalStatus(this.status()).label;
  }

  protected statusTone() {
    return eventFunctionalStatus(this.status()).tone;
  }
}
