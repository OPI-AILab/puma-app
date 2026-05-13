import { Component, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import { AuthStore } from '../auth/store/auth.store';
import { HttpClient } from '@angular/common/http';
import { LogImportDialogComponent } from '../logs/components/log-import-dialog.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    MenuModule,
    AvatarModule,
    LogImportDialogComponent
  ],
  template: `
    <nav class="bg-white shadow-lg border-b border-gray-200">
      <div class="container mx-auto px-4">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <a
              routerLink="/"
              class="text-xl font-bold text-gray-900"
            >
              Multimodal Benchmark
            </a>
          </div>

          <div class="flex items-center space-x-4">
            @if (authStore.isAuthenticated()) {
              <div class="flex items-center space-x-3">
                <p-button
                  label="Models"
                  icon="pi pi-list"
                  [outlined]="true"
                  routerLink="/models"
                ></p-button>

                <p-button
                  label="Stats"
                  icon="pi pi-chart-bar"
                  [outlined]="true"
                  routerLink="/stats"
                ></p-button>

                <p-button
                  label="Evaluations"
                  icon="pi pi-gauge"
                  [outlined]="true"
                  routerLink="/evaluations"
                ></p-button>

                <p-button
                  label="Import logs"
                  icon="pi pi-upload"
                  [outlined]="true"
                  (onClick)="openImportDialog()"
                ></p-button>

                <a
                  pButton
                  target="_blank"
                  href="/api/project/export.zip"
                  [loading]="authStore.isLoading()"
                  [outlined]="true"
                ><i class="pi pi-file-export"></i><span pButtonLabel>Export project</span></a>

                <app-log-import-dialog></app-log-import-dialog>

                <span class="text-sm text-gray-700">
                  {{ authStore.user()?.username }}
                </span>

                <p-avatar
                  [label]="getUserInitials()"
                  styleClass="bg-blue-500 text-white"
                  size="normal"
                  shape="circle"
                ></p-avatar>

                <p-button
                  label="Logout"
                  icon="pi pi-sign-out"
                  [outlined]="true"
                  (onClick)="logout()"
                  [loading]="authStore.isLoading()"
                ></p-button>
              </div>
            } @else {
              <div class="flex items-center space-x-2">
                <p-button
                  label="Login"
                  [outlined]="true"
                  routerLink="/login"
                ></p-button>
              </div>
            }
          </div>
        </div>
      </div>
    </nav>
  `
})
export class NavbarComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);

  readonly importDialog = viewChild(LogImportDialogComponent);

  openImportDialog(): void {
    this.importDialog()?.open();
  }

  getUserInitials(): string {
    const user = this.authStore.user();
    if (!user?.username) return 'U';

    return user.username.substring(0, 2).toUpperCase();
  }

  logout(): void {
    this.authStore.logout();
  }

  downloadFile(data: any) {
    const blob = new Blob([data], { type: "application/zip" });
    const url= window.URL.createObjectURL(blob);
    window.open(url);
  }
}
