import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Banknote,
  Building2,
  CalendarDays,
  ChartColumn,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  LucideAngularModule,
  type LucideIconData,
  QrCode,
  Receipt,
  ScanLine,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Ticket,
  UserCog,
  Users
} from 'lucide-angular';

import { ButtonComponent } from '../button/button.component';
import { BadgeComponent } from '../badge/badge.component';

const ICONS: Record<string, LucideIconData> = {
  'layout-dashboard': LayoutDashboard,
  'list-checks': ListChecks,
  'qr-code': QrCode,
  ticket: Ticket,
  'user-cog': UserCog,
  receipt: Receipt,
  banknote: Banknote,
  'calendar-days': CalendarDays,
  'scan-line': ScanLine,
  users: Users,
  'shield-alert': ShieldAlert,
  'folder-tree': FolderTree,
  'building-2': Building2,
  'scroll-text': ScrollText,
  'chart-column': ChartColumn,
  sparkles: Sparkles
};

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent, BadgeComponent, RouterLink],
  templateUrl: './placeholder-page.component.html'
})
export class PlaceholderPageComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('Cette fonctionnalité est en cours de finalisation.');
  readonly icon = input<string>('sparkles');
  readonly id = input<string>();
  readonly eventId = input<string>();

  protected readonly iconRef = computed<LucideIconData>(() => ICONS[this.icon()] ?? Sparkles);
  protected readonly reference = computed<string | undefined>(() => this.id() ?? this.eventId());
}
