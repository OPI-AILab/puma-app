import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Category, SearchRequest, Task, TaskDetails, FileUploadResponse, UpdateFileRequest, FileMetadata, Condition, TagStats} from '../models/task.models';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  searchTasks(request: SearchRequest): Observable<Task[]> {
    return this.http.post<Task[]>(`${this.apiUrl}/task/list`, request);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/dict/categories`);
  }

  getTask(taskId: string): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/task/${taskId}`);
  }

  saveTask(taskDetails: TaskDetails) {
    const prepared: TaskDetails = {
      ...taskDetails,
      conditions: (taskDetails.conditions || []).map(cond => this.prepareCondition(cond))
    } as TaskDetails;
    return this.http.post<Task>(`${this.apiUrl}/task/save`, prepared);
  }

  private prepareCondition(condition: Condition): Condition {
    const p: any = condition.params || {};
    if (condition.type === 'regex' || condition.type === 'wacc') {
      if (typeof (condition as any).expected !== 'string') {
        (condition as any).expected = '';
      }
      if (p.regex !== undefined) delete p.regex;
    } else if (condition.type === 'ocr') {
      if (!Array.isArray((condition as any).expected)) {
        (condition as any).expected = [(condition as any).expected || ''];
      }
    } else if (condition.type === 'struct') {
      // do nothing
    } else if (!Array.isArray((condition as any).expected)) {
      (condition as any).expected = [];
    }
    return condition;
  }

  uploadFile(file: File, url?: string, license?: string, attribution?: string): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (url) formData.append('url', url);
    if (license) formData.append('license', license);
    if (attribution) formData.append('attribution', attribution);

    return this.http.post<FileUploadResponse>(`${this.apiUrl}/file/upload`, formData);
  }

  getFileMetadata(fileId: string): Observable<FileMetadata> {
    return this.http.get<FileMetadata>(`${this.apiUrl}/file/${fileId}`);
  }

  updateFile(fileId: string, updateData: UpdateFileRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/file/update/${fileId}`, updateData);
  }

  deleteFile(fileId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/file/delete/${fileId}`, {});
  }

  deleteTask(taskId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/task/delete/${taskId}`, {});
  }

  getTags(taskId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/tags/${taskId}`);
  }

  getTagsByCategory(category: string): Observable<TagStats[]> {
    return this.http.get<TagStats[]>(`${this.apiUrl}/tags?category=${encodeURIComponent(category)}`);
  }

  getCategoryVerifications(): Observable<Record<string, string[]>> {
    return this.http.get<Record<string, string[]>>(`${this.apiUrl}/dict/category-verifications`);
  }

}
