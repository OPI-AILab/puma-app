import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LogImport, LogEntry, LogEntriesResponse } from '../models/log.models';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/logs';

  importLogs(file: File): Observable<{ import_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ import_id: string }>(`${this.baseUrl}/import`, formData);
  }

  getLogImport(importId: string): Observable<LogImport> {
    return this.http.get<LogImport>(`${this.baseUrl}/${importId}`);
  }

  getLogEntries(importId: string, page: number, limit: number): Observable<LogEntriesResponse> {
    return this.http.get<LogEntriesResponse>(`${this.baseUrl}/${importId}/entries`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  getLogEntry(importId: string, entryId: number): Observable<LogEntry> {
    return this.http.get<LogEntry>(`${this.baseUrl}/${importId}/entries/${entryId}`);
  }

  deleteLogImport(importId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${importId}`);
  }
}
