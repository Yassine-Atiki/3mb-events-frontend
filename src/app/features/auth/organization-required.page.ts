import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { UserService } from '../../core/api/user.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-organization-required-page',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent],
  template: `
    <div class="mb-7 text-center">
      <span class="page-header-badge">Organisation requise</span>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary">Nommez votre organisation</h1>
      <p class="mt-2 text-sm text-text-secondary">
        Votre compte organisateur ne peut pas accéder à l'espace 3MB Events tant que le nom de votre
        entreprise ou association n'est pas renseigné.
      </p>
    </div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
      <app-ui-input
        label="Organisation"
        placeholder="Nom de votre entreprise ou association"
        formControlName="organization"
        [error]="invalid() ? 'Requis (2 caractères minimum)' : undefined"
      />

      <div class="mt-2 flex justify-center">
        <app-ui-button type="submit" [loading]="loading()">Continuer</app-ui-button>
      </div>
    </form>

    <p class="mt-6 text-center text-sm text-text-secondary">
      <button
        type="button"
        class="font-semibold text-brand-teal-dark hover:underline"
        (click)="logout()"
      >
        Se déconnecter
      </button>
    </p>
  `
})
export class OrganizationRequiredPage {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    organization: ['', [Validators.required, Validators.minLength(2)]]
  });

  protected invalid(): boolean {
    const control = this.form.controls.organization;
    return control.invalid && control.touched;
  }

  protected logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth/connexion']);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const user = this.authStore.user();
    if (!user) return;

    const organization = this.form.controls.organization.value.trim();
    this.loading.set(true);

    this.userService
      .updateProfile(user.id, { organization })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (updated) => {
          this.authStore.setUser(updated);
          this.toast.success('Organisation enregistrée.');
          void this.router.navigate(['/organisateur/tableau-de-bord']);
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(
            (error.error as { message?: string } | null)?.message ??
              "Impossible d'enregistrer l'organisation."
          );
        }
      });
  }
}
