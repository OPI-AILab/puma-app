import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminUser, LangSetting } from '../models/admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/admin';

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.apiUrl}/users`);
  }

  createUser(username: string, password: string): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${this.apiUrl}/users`, { username, password });
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  getLang(): Observable<LangSetting> {
    return this.http.get<LangSetting>(`${this.apiUrl}/settings/lang`);
  }

  setLang(lang: string): Observable<LangSetting> {
    return this.http.post<LangSetting>(`${this.apiUrl}/settings/lang`, { lang });
  }
}
