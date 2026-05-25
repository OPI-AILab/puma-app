import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-user-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule],
  template: `
    <p-dialog
      header="New User"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '400px' }"
      (onHide)="close()"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="font-medium text-gray-700">Username</label>
          <input
            pInputText
            [(ngModel)]="username"
            placeholder="Enter username"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="font-medium text-gray-700">Password</label>
          <input
            pInputText
            type="password"
            [(ngModel)]="password"
            placeholder="Enter password"
            class="w-full"
          />
        </div>

        @if (errorMessage()) {
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {{ errorMessage() }}
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [outlined]="true"
            (onClick)="close()"
            [disabled]="isLoading()"
          ></p-button>
          <p-button
            label="Create"
            icon="pi pi-user-plus"
            (onClick)="create()"
            [disabled]="!isValid()"
            [loading]="isLoading()"
          ></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class UserCreateDialogComponent {
  private readonly adminService = inject(AdminService);

  created = output<void>();

  visible = signal(false);
  username = '';
  password = '';

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  open(): void {
    this.visible.set(true);
    this.username = '';
    this.password = '';
    this.errorMessage.set(null);
    this.isLoading.set(false);
  }

  close(): void {
    this.visible.set(false);
    this.errorMessage.set(null);
  }

  isValid(): boolean {
    return !!this.username.trim() && !!this.password.trim() && !this.isLoading();
  }

  create(): void {
    if (!this.isValid()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService.createUser(this.username.trim(), this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.close();
        this.created.emit();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.detail || 'Failed to create user'
        );
      },
    });
  }
}
