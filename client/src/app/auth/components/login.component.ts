import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../store/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    MessageModule
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <p-card header="Login">
          <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="space-y-6">
            @if (authStore.error()) {
              <div class="mb-2">
                <p-message severity="error">{{authStore.error()}}</p-message>
              </div>
            }

            <div>
              <label for="username" class="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                pInputText
                id="username"
                name="username"
                type="text"
                [ngModel]="username()"
                (ngModelChange)="username.set($event)"
                required
                class="mt-1 block w-full"
                placeholder="Enter username"
                [disabled]="authStore.isLoading()"
              />
            </div>

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
              ></p-password>
            </div>

            <div>
              <p-button
                type="submit"
                label="Login"
                [loading]="authStore.isLoading()"
                [disabled]="!loginForm.valid"
                styleClass="w-full"
              ></p-button>
            </div>
          </form>
        </p-card>
      </div>
    </div>
  `
})
export class LoginComponent {
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);

  username = signal('');
  password = signal('');

  onSubmit(): void {
    if (!this.username() || !this.password()) {
      return;
    }

    this.authStore.login(this.username(), this.password()).subscribe({
      next: () => {
        this.router.navigate(['/tasks']);
      },
    });
  }
}
