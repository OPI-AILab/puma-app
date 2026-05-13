import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {SavedResponse, SavedResponseRequest} from '../models/task.models';

@Injectable({
  providedIn: 'root'
})
export class SavedResponseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  save(request: SavedResponseRequest): Observable<SavedResponse> {
    return this.http.post<SavedResponse>(`${this.apiUrl}/saved-response/save`, request);
  }

  saveBatch(requests: SavedResponseRequest[]): Observable<SavedResponse[]> {
    return this.http.post<SavedResponse[]>(`${this.apiUrl}/saved-response/save-batch`, requests);
  }

  getAllForTask(taskId: string): Observable<SavedResponse[]> {
    return this.http.get<SavedResponse[]>(`${this.apiUrl}/saved-response/task/${taskId}`);
  }

  getByTaskAndModel(taskId: string, modelId: string): Observable<SavedResponse> {
    return this.http.get<SavedResponse>(`${this.apiUrl}/saved-response/task/${taskId}/model/${modelId}`);
  }

  deleteForTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/saved-response/task/${taskId}`);
  }

}
