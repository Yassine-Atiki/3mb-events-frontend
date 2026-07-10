import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html'
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
}
