import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    PasswordModule,
    CardModule,
    MessageModule
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <p-card header="Project Initialization">
          <p class="text-gray-600 mb-6">
            The application has been launched in an empty project.
            During project initialization, an admin account will be created.
            Please provide the password for this account below.
          </p>

          <form (ngSubmit)="onSubmit()" #setupForm="ngForm" class="space-y-6">
            @if (authStore.error()) {
              <div class="mb-2">
                <p-message severity="error">{{authStore.error()}}</p-message>
              </div>
            }

            @if (passwordMismatch()) {
              <div class="mb-2">
                <p-message severity="error">Passwords do not match</p-message>
              </div>
            }

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <p-password
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                name="password"
                inputId="password"
                [feedback]="false"
                [disabled]="authStore.isLoading()"
                placeholder="Enter password"
                class="w-full"
                inputStyleClass="w-full"
                required
              ></p-password>
            </div>

            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <p-password
                [ngModel]="confirmPassword()"
                (ngModelChange)="confirmPassword.set($event)"
                name="confirmPassword"
                inputId="confirmPassword"
                [feedback]="false"
                [disabled]="authStore.isLoading()"
                placeholder="Repeat password"
                class="w-full"
                inputStyleClass="w-full"
                required
              ></p-password>
            </div>

            <div>
              <p-button
                type="submit"
                label="Create admin account"
                [loading]="authStore.isLoading()"
                [disabled]="!setupForm.valid || !password() || !confirmPassword()"
                styleClass="w-full"
              ></p-button>
            </div>
          </form>
        </p-card>
      </div>
    </div>
  `
})
export class SetupComponent {
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);

  password = signal('');
  confirmPassword = signal('');
  submitted = signal(false);
  passwordMismatch = computed(() =>
    this.submitted() && this.password() !== this.confirmPassword()
  );

  onSubmit(): void {
    this.submitted.set(true);
    if (!this.password() || !this.confirmPassword()) {
      return;
    }

    if (this.passwordMismatch()) {
      return;
    }

    this.authStore.initProject(this.password()).subscribe({
      next: () => {
        this.router.navigate(['/tasks']);
      },
      error: () => {},
    });
  }
}
