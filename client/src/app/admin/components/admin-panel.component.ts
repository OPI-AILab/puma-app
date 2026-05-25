import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AdminService } from '../services/admin.service';
import { AdminUser } from '../models/admin.models';
import { UserCreateDialogComponent } from './user-create-dialog.component';

const AVAILABLE_LANGS = [
  { label: 'Polski', value: 'pl' },
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Français', value: 'fr' },
];

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    TableModule,
    CardModule,
    SelectModule,
    ConfirmDialogModule,
    ToastModule,
    UserCreateDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="container mx-auto px-4 py-6">
      <p-button icon="pi pi-arrow-left" label="Tasks list" severity="secondary" routerLink="/tasks"></p-button>

      <h1 class="text-3xl font-bold text-gray-900 mt-4 mb-6">Administration</h1>

      <p-card styleClass="mb-6">
        <ng-template #header>
          <div class="px-4 pt-4">
            <h2 class="text-xl font-semibold text-gray-800">
              <i class="pi pi-globe mr-2"></i>Default language
            </h2>
          </div>
        </ng-template>
        <div class="flex items-center gap-4">
          <p-select
            [options]="langs"
            [(ngModel)]="selectedLang"
            optionLabel="label"
            optionValue="value"
            placeholder="Select language"
            styleClass="w-48"
          ></p-select>
          <p-button
            label="Save"
            icon="pi pi-check"
            severity="success"
            [loading]="savingLang()"
            (onClick)="saveLang()"
          ></p-button>
        </div>
      </p-card>

      <p-card>
        <ng-template #header>
          <div class="px-4 pt-4 flex justify-between items-center">
            <h2 class="text-xl font-semibold text-gray-800">
              <i class="pi pi-users mr-2"></i>Users
            </h2>
            <p-button
              label="Add User"
              icon="pi pi-user-plus"
              severity="success"
              (onClick)="openCreateDialog()"
            ></p-button>
          </div>
        </ng-template>

        @if (loadingUsers()) {
          <div class="text-center py-8">
            <i class="pi pi-spinner pi-spin text-2xl text-gray-400"></i>
          </div>
        } @else {
          <p-table
            [value]="users()"
            [tableStyle]="{ 'min-width': '30rem' }"
            styleClass="p-datatable-striped"
          >
            <ng-template pTemplate="header">
              <tr>
                <th class="font-semibold w-0">ID</th>
                <th class="font-semibold">Username</th>
                <th class="font-semibold text-center w-0">Actions</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-user>
              <tr class="hover:bg-gray-50">
                <td>{{ user.id }}</td>
                <td>
                  <span class="font-medium text-gray-900">{{ user.username }}</span>
                </td>
                <td class="text-center">
                  @if (user.username !== 'admin') {
                    <p-button
                      icon="pi pi-trash"
                      [rounded]="true"
                      severity="danger"
                      [outlined]="true"
                      (onClick)="confirmDelete(user, $event)"
                    ></p-button>
                  }
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="empty">
              <tr>
                <td colspan="3" class="text-center py-8 text-gray-500">No users found</td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <app-user-create-dialog (created)="onUserCreated()"></app-user-create-dialog>
      <p-toast></p-toast>
      <p-confirmDialog></p-confirmDialog>
    </div>
  `
})
export class AdminPanelComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly createDialog = viewChild(UserCreateDialogComponent);

  readonly users = signal<AdminUser[]>([]);
  readonly loadingUsers = signal(true);
  readonly savingLang = signal(false);

  readonly langs = AVAILABLE_LANGS;
  selectedLang = 'pl';

  ngOnInit(): void {
    this.loadUsers();
    this.loadLang();
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.adminService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false)
    });
  }

  loadLang(): void {
    this.adminService.getLang().subscribe({
      next: (res) => this.selectedLang = res.lang
    });
  }

  openCreateDialog(): void {
    this.createDialog()?.open();
  }

  onUserCreated(): void {
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'User created' });
    this.loadUsers();
  }

  confirmDelete(user: AdminUser, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Are you sure you want to delete user "${user.username}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.deleteUser(user)
    });
  }

  private deleteUser(user: AdminUser): void {
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `User "${user.username}" deleted` });
        this.loadUsers();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete user' });
      }
    });
  }

  saveLang(): void {
    this.savingLang.set(true);
    this.adminService.setLang(this.selectedLang).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Default language set to "${this.selectedLang}"` });
        this.savingLang.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save language setting' });
        this.savingLang.set(false);
      }
    });
  }
}
