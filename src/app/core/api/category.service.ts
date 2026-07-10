import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Category } from '../models';

export type CreateCategoryRequest = Omit<Category, 'id' | 'eventCount'>;
export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  getAll(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  getById(id: string): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateCategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateCategoryRequest): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
