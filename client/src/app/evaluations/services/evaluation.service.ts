import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Evaluation,
  EvaluationEntry,
  EvaluationEntriesResponse,
  EvaluationsListResponse,
  CreateEvaluationRequest,
} from '../models/evaluation.models';

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/evaluation';

  create(request: CreateEvaluationRequest): Observable<Evaluation> {
    return this.http.post<Evaluation>(`${this.baseUrl}/create`, request);
  }

  getList(page: number = 1, limit: number = 50): Observable<EvaluationsListResponse> {
    return this.http.get<EvaluationsListResponse>(`${this.baseUrl}/list`, {
      params: { page: page.toString(), limit: limit.toString() },
    });
  }

  get(id: string): Observable<Evaluation> {
    return this.http.get<Evaluation>(`${this.baseUrl}/${id}`);
  }

  start(id: string, reset: boolean = false): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/${id}/start`, { reset });
  }

  updateConfiguration(id: string, modelConfiguration: Record<string, any>): Observable<Evaluation> {
    return this.http.patch<Evaluation>(`${this.baseUrl}/${id}/configuration`, {
      model_configuration: modelConfiguration,
    });
  }

  cancel(id: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/${id}/cancel`, {});
  }

  getEntries(id: string, page: number, limit: number): Observable<EvaluationEntriesResponse> {
    return this.http.get<EvaluationEntriesResponse>(`${this.baseUrl}/${id}/entries`, {
      params: { page: page.toString(), limit: limit.toString() },
    });
  }

  getEntry(id: string, entryId: number): Observable<EvaluationEntry> {
    return this.http.get<EvaluationEntry>(`${this.baseUrl}/${id}/entries/${entryId}`);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }
}
