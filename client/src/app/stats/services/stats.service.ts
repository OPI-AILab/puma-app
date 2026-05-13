import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WeeklyStats } from '../models/stats.models';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);

  getWeeklyStats(): Observable<WeeklyStats> {
    return this.http.get<WeeklyStats>('/api/stats/weekly');
  }
}
