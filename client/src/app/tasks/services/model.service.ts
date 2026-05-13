import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ModelDetailsAndProperties, ModelForCategory, ModelProperties} from '../models/model.models';
import {SearchRequest, TaskDetails} from '../models/task.models';

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  saveModel(model: ModelDetailsAndProperties): Observable<ModelDetailsAndProperties> {
    return this.http.post<ModelDetailsAndProperties>(`${this.apiUrl}/model/save`, model);
  }

  getModel(modelId: string): Observable<ModelDetailsAndProperties> {
    return this.http.get<ModelDetailsAndProperties>(`${this.apiUrl}/model/${modelId}`);
  }

  updateModel(modelId: string, model: ModelDetailsAndProperties): Observable<ModelDetailsAndProperties> {
    return this.http.put<ModelDetailsAndProperties>(`${this.apiUrl}/model/${modelId}`, model);
  }

  deleteModel(modelId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/model/${modelId}`);
  }

  getModels(request: SearchRequest): Observable<ModelDetailsAndProperties[]> {
    return this.http.post<ModelDetailsAndProperties[]>(`${this.apiUrl}/model/list`, request);
  }

  getModelsForCategory(categoryName: string): Observable<ModelForCategory[]> {
    return this.http.get<ModelForCategory[]>(`${this.apiUrl}/category/${categoryName}/models`);
  }

  evaluateModel(modelId: string, task: TaskDetails): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/model/${modelId}/evaluate`, task);
  }
}
