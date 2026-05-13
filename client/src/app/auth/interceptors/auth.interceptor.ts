import { inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthStore } from '../store/auth.store';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const router = inject(Router);
  const messageService = inject(MessageService);
  const authStore = inject(AuthStore);

  const reqWithCredentials = req.clone({
    withCredentials: true,
  });

  return next(reqWithCredentials).pipe(
    catchError((error: HttpErrorResponse) => {
      console.log('HTTP Error:', error);
      const isLoginRequest = req.url.endsWith('/login');
      const isCheckAuthRequest = req.url.endsWith('/user/me');

      if (error.status === 401 && !isLoginRequest && !isCheckAuthRequest) {
        authStore.clearAuth();
        router.navigate(['/login']);
        messageService.add({
          severity: 'error',
          summary: 'Session Expired',
          detail: 'Your session has expired. Please log in again.',
        });
      }
      return throwError(() => error);
    })
  );
};
