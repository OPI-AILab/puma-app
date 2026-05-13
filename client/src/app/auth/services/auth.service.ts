import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { LoginRequest, User } from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  login(username: string, password: string): Observable<User> {
    const request: LoginRequest = { username, password };
    return this.http
      .post(`${this.apiUrl}/login`, request, { withCredentials: true })
      .pipe(map(() => ({ username })));
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/logout`,
      {},
      { withCredentials: true }
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/user/me`, {
      withCredentials: true,
    });
  }
}
