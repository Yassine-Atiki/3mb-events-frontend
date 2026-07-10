import { Component, computed, input, output, signal } from '@angular/core';

export interface DataTableColumn<T = unknown> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => string;
}

export interface RowActionEvent<T = unknown> {
  action: string;
  row: T;
}

export interface RowActionDef {
  label: string;
  action: string;
  tone?: 'default' | 'primary' | 'danger';
}

type SortDirection = 'asc' | 'desc';

const DEFAULT_ROW_ACTIONS: RowActionDef[] = [{ label: 'Voir', action: 'view' }];

const ACTION_TONE_CLASSES: Record<NonNullable<RowActionDef['tone']>, string> = {
  default: 'text-brand-teal-dark hover:bg-brand-teal/10',
  primary: 'bg-brand-teal text-white hover:bg-brand-teal-dark',
  danger: 'text-red-600 hover:bg-red-50'
};

@Component({
  selector: 'app-ui-data-table',
  standalone: true,
  templateUrl: './data-table.component.html'
})
export class DataTableComponent<T = unknown> {
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly searchable = input(true);
  readonly pageSize = input(10);
  readonly emptyMessage = input('Aucune donnée à afficher');
  readonly rowActions = input<((row: T) => RowActionDef[]) | null>(null);

  readonly rowAction = output<RowActionEvent<T>>();

  protected readonly searchTerm = signal('');
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDirection = signal<SortDirection>('asc');
  protected readonly currentPage = signal(1);

  protected readonly filteredRows = computed<T[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const cols = this.columns();
    let result = this.rows();

    if (term) {
      result = result.filter((row) =>
        cols.some((col) => this.cellValue(row, col).toLowerCase().includes(term))
      );
    }

    const key = this.sortKey();
    if (key) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = this.rawValue(a, key);
        const bv = this.rawValue(b, key);
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        const left = av as number | string;
        const right = bv as number | string;
        if (left > right) return dir;
        if (left < right) return -dir;
        return 0;
      });
    }

    return result;
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize()))
  );

  protected readonly pagedRows = computed<T[]>(() => {
    const size = this.pageSize();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * size;
    return this.filteredRows().slice(start, start + size);
  });

  protected cellValue(row: T, col: DataTableColumn<T>): string {
    if (col.render) return col.render(row);
    const value = this.rawValue(row, col.key);
    return value == null ? '' : String(value);
  }

  protected onSearch(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  protected toggleSort(col: DataTableColumn<T>): void {
    if (!col.sortable) return;
    if (this.sortKey() === col.key) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(col.key);
      this.sortDirection.set('asc');
    }
  }

  protected goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  protected emitAction(action: string, row: T): void {
    this.rowAction.emit({ action, row });
  }

  protected actionsFor(row: T): RowActionDef[] {
    const fn = this.rowActions();
    return fn ? fn(row) : DEFAULT_ROW_ACTIONS;
  }

  protected actionClasses(tone: RowActionDef['tone']): string {
    return ACTION_TONE_CLASSES[tone ?? 'default'];
  }

  private rawValue(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }
}
