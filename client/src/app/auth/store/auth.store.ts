import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthState, initialAuthState, User } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { EMPTY, Observable } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly _state = signal<AuthState>(initialAuthState);
  private readonly _projectEmpty = signal(false);

  readonly user = computed(() => this._state().user);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly error = computed(() => this._state().error);
  readonly isAuthenticated = computed(() => this._state().isAuthenticated);
  readonly projectEmpty = this._projectEmpty.asReadonly();

  checkAuthStatus(): Observable<User> {
    this.setLoading();
    return this.authService.getProjectStatus().pipe(
      switchMap((status) => {
        this._projectEmpty.set(!status.hasUsers);
        if (!status.hasUsers) {
          this.clearAuth();
          this.router.navigate(['/setup']);
          return EMPTY;
        }
        return this.authService.getCurrentUser().pipe(
          tap((user) => this.setAuthenticated(user)),
          catchError(() => {
            this.clearAuth();
            return EMPTY;
          })
        );
      }),
      catchError(() => {
        this.clearAuth();
        return EMPTY;
      })
    );
  }

  login(username: string, password: string): Observable<User> {
    this.setLoading();
    return this.authService.login(username, password).pipe(
      tap((user) => this.setAuthenticated(user)),
      catchError((err: HttpErrorResponse) => {
        this.setError(
          err.status === 401
            ? 'Invalid username or password'
            : 'An unknown error occurred'
        );
        throw err;
      })
    );
  }

  initProject(password: string): Observable<void> {
    this.setLoading();
    return this.authService.initProject(password).pipe(
      switchMap(() => this.authService.getCurrentUser()),
      tap((user) => {
        this._projectEmpty.set(false);
        this.setAuthenticated(user);
      }),
      map(() => void 0),
      catchError((err: HttpErrorResponse) => {
        this.setError(err.error?.detail || 'An error occurred during initialization');
        throw err;
      })
    );
  }

  logout(): void {
    this.setLoading();
    this.authService
      .logout()
      .pipe(
        finalize(() => {
          this.clearAuth();
          this.router.navigate(['/login']);
        })
      )
      .subscribe();
  }

  clearAuth(): void {
    this._state.set(initialAuthState);
  }

  private setLoading(): void {
    this._state.update((state) => ({
      ...state,
      isLoading: true,
      error: null,
    }));
  }

  private setAuthenticated(user: User): void {
    this._state.update((state) => ({
      ...state,
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    }));
  }

  private setError(error: string): void {
    this._state.update((state) => ({
      ...state,
      error,
      isLoading: false,
    }));
  }

  private setLoadingComplete(): void {
    this._state.update((state) => ({
      ...state,
      isLoading: false,
    }));
  }
}
