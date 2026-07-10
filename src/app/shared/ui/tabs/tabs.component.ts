import { Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
}

const BASE_TAB_CLASSES = 'rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200';
const ACTIVE_TAB_CLASSES = 'bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white shadow-glow-teal';
const INACTIVE_TAB_CLASSES = 'text-text-secondary hover:bg-white hover:text-brand-teal-dark';

@Component({
  selector: 'app-ui-tabs',
  standalone: true,
  templateUrl: './tabs.component.html'
})
export class TabsComponent {
  readonly tabs = input<TabItem[]>([]);
  readonly activeId = model<string>('');

  protected selectTab(id: string): void {
    this.activeId.set(id);
  }

  protected tabClasses(id: string): string {
    return `${BASE_TAB_CLASSES} ${id === this.activeId() ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES}`;
  }
}
