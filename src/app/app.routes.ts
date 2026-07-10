import { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./shared/layouts/public-shell/public-shell.component').then((m) => m.PublicShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/marketing/landing/landing-page.component').then((m) => m.LandingPageComponent)
      },
      {
        path: 'evenements',
        loadComponent: () => import('./features/catalog/event-list.page').then((m) => m.EventListPage)
      },
      {
        path: 'evenements/:slug',
        loadComponent: () => import('./features/catalog/event-detail.page').then((m) => m.EventDetailPage)
      }
    ]
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./shared/layouts/auth-shell/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      { path: '', redirectTo: 'connexion', pathMatch: 'full' },
      {
        path: 'inscription/organisateur',
        loadComponent: () => import('./features/auth/register-organizer.page').then((m) => m.RegisterOrganizerPage)
      },
      {
        path: 'inscription/participant',
        loadComponent: () =>
          import('./features/auth/register-participant.page').then((m) => m.RegisterParticipantPage)
      },
      {
        path: 'connexion',
        loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage)
      },
      {
        path: 'mot-de-passe-oublie',
        loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage)
      },
      {
        path: 'reinitialiser/:token',
        loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage)
      }
    ]
  },
  {
    path: 'app',
    canActivate: [authGuard, roleGuard('PARTICIPANT')],
    loadComponent: () => import('./shared/layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
      {
        path: 'decouvrir',
        loadComponent: () => import('./features/catalog/event-list.page').then((m) => m.EventListPage)
      },
      {
        path: 'decouvrir/:slug',
        loadComponent: () => import('./features/catalog/event-detail.page').then((m) => m.EventDetailPage)
      },
      {
        path: 'tableau-de-bord',
        loadComponent: () => import('./features/participant/dashboard.page').then((m) => m.DashboardPage)
      },
      {
        path: 'mes-inscriptions',
        loadComponent: () =>
          import('./features/participant/my-registrations.page').then((m) => m.MyRegistrationsPage)
      },
      {
        path: 'billets/:id',
        loadComponent: () => import('./features/participant/ticket-detail.page').then((m) => m.TicketDetailPage)
      },
      {
        path: 'reservation/:eventId',
        loadComponent: () => import('./features/participant/reservation.page').then((m) => m.ReservationPage)
      },
      {
        path: 'profil',
        loadComponent: () => import('./features/participant/profile.page').then((m) => m.ProfilePage)
      },
      {
        path: 'remboursements',
        loadComponent: () => import('./features/participant/refunds.page').then((m) => m.RefundsPage)
      }
    ]
  },
  {
    path: 'organisateur',
    canActivate: [authGuard, roleGuard('ORGANIZER')],
    loadComponent: () => import('./shared/layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
      {
        path: 'tableau-de-bord',
        loadComponent: () => import('./features/organizer/dashboard.page').then((m) => m.OrganizerDashboardPage)
      },
      {
        path: 'evenements',
        loadComponent: () =>
          import('./features/organizer/events-list.page').then((m) => m.OrganizerEventsListPage)
      },
      {
        path: 'evenements/nouveau',
        loadComponent: () => import('./features/organizer/event-wizard.page').then((m) => m.EventWizardPage)
      },
      {
        path: 'evenements/:id/modifier',
        loadComponent: () => import('./features/organizer/event-wizard.page').then((m) => m.EventWizardPage)
      },
      {
        path: 'evenements/:id/inscriptions',
        loadComponent: () =>
          import('./features/organizer/event-registrations.page').then((m) => m.EventRegistrationsPage)
      },
      {
        path: 'evenements/:id/billetterie',
        loadComponent: () =>
          import('./features/organizer/event-tickets.page').then((m) => m.EventTicketsPage)
      },
      {
        path: 'evenements/:id/statistiques',
        loadComponent: () => import('./features/organizer/event-stats.page').then((m) => m.EventStatsPage)
      },
      // Legacy alias kept for backward compatibility with previously bookmarked links.
      { path: 'mes-evenements', redirectTo: 'evenements', pathMatch: 'full' },
      {
        path: 'scanner',
        loadComponent: () =>
          import('./features/organizer/scanner-picker.page').then((m) => m.ScannerPickerPage)
      },
      {
        path: 'scan/:eventId',
        loadComponent: () => import('./features/organizer/scan.page').then((m) => m.ScanPage)
      },
      {
        path: 'remboursements',
        loadComponent: () => import('./features/organizer/refunds.page').then((m) => m.OrganizerRefundsPage)
      }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () => import('./shared/layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
      {
        path: 'tableau-de-bord',
        loadComponent: () => import('./features/admin/dashboard.page').then((m) => m.AdminDashboardPage)
      },
      {
        path: 'utilisateurs',
        loadComponent: () => import('./features/admin/users.page').then((m) => m.AdminUsersPage)
      },
      {
        path: 'moderation',
        loadComponent: () => import('./features/admin/moderation.page').then((m) => m.AdminModerationPage)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/admin/categories.page').then((m) => m.AdminCategoriesPage)
      },
      {
        path: 'lieux',
        loadComponent: () => import('./features/admin/venues.page').then((m) => m.AdminVenuesPage)
      },
      {
        path: 'journal',
        loadComponent: () => import('./features/admin/audit-log.page').then((m) => m.AdminAuditLogPage)
      },
      {
        path: 'remboursements',
        loadComponent: () => import('./features/admin/refunds.page').then((m) => m.AdminRefundsPage)
      },
      {
        path: 'rapports',
        loadComponent: () => import('./features/admin/reports.page').then((m) => m.AdminReportsPage)
      }
    ]
  },
  {
    path: '403',
    loadComponent: () => import('./features/system/forbidden.page').then((m) => m.ForbiddenPage)
  },
  {
    path: '404',
    loadComponent: () => import('./features/system/not-found.page').then((m) => m.NotFoundPage)
  },
  {
    path: '**',
    loadComponent: () => import('./features/system/not-found.page').then((m) => m.NotFoundPage)
  }
];
