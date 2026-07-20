import { Routes } from '@angular/router';

import {
  authGuard,
  guestGuard,
  organizationRequiredGuard,
  organizationSetupGuard,
  roleGuard
} from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'inscription/:token',
    loadComponent: () =>
      import('./features/public/public-registration.page').then((m) => m.PublicRegistrationPage)
  },
  {
    path: 'billet',
    loadComponent: () =>
      import('./features/public/public-ticket.page').then((m) => m.PublicTicketPage)
  },
  { path: '', redirectTo: 'auth/connexion', pathMatch: 'full' },
  {
    path: 'auth',
    loadComponent: () =>
      import('./shared/layouts/auth-shell/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      { path: '', redirectTo: 'connexion', pathMatch: 'full' },
      {
        path: 'organisation-requise',
        canActivate: [authGuard, organizationSetupGuard],
        loadComponent: () =>
          import('./features/auth/organization-required.page').then((m) => m.OrganizationRequiredPage)
      },
      {
        path: '',
        canActivate: [guestGuard],
        children: [
          {
            path: 'inscription/organisation',
            loadComponent: () =>
              import('./features/auth/register-organization.page').then((m) => m.RegisterOrganizationPage)
          },
          {
            path: 'connexion',
            loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage)
          },
          {
            path: '2fa',
            loadComponent: () => import('./features/auth/two-factor.page').then((m) => m.TwoFactorPage)
          },
          {
            path: 'mot-de-passe-oublie',
            loadComponent: () =>
              import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage)
          },
          {
            path: 'reinitialiser/:token',
            loadComponent: () =>
              import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage)
          }
        ]
      }
    ]
  },
  {
    path: 'organisateur',
    canActivate: [authGuard, roleGuard('ORGANIZER'), organizationRequiredGuard],
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
      },
      {
        path: 'lieux',
        loadComponent: () => import('./features/organizer/venues.page').then((m) => m.OrganizerVenuesPage)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/organizer/categories.page').then((m) => m.OrganizerCategoriesPage)
      },
      {
        path: 'profil',
        loadComponent: () => import('./features/account/profile/profile.page').then((m) => m.ProfilePage)
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
        path: 'journal',
        loadComponent: () => import('./features/admin/audit-log.page').then((m) => m.AdminAuditLogPage)
      },
      {
        path: 'rapports',
        loadComponent: () => import('./features/admin/reports.page').then((m) => m.AdminReportsPage)
      },
      {
        path: 'profil',
        loadComponent: () => import('./features/account/profile/profile.page').then((m) => m.ProfilePage)
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
