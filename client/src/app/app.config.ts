import {ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import {routes} from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authInterceptor } from './auth/interceptors/auth.interceptor';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthStore } from './auth/store/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    provideAppInitializer(() => {
      const authStore = inject(AuthStore);
      return authStore.checkAuthStatus();
    }),
    ConfirmationService,
    provideHttpClient(withInterceptors([authInterceptor])),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: 'none'
        }
      }
    })
  ]
};
