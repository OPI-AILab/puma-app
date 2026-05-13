import { computed, inject, Injectable, signal } from '@angular/core';
import { Category } from '../models/task.models';
import { TaskService } from '../services/task.service';
import { catchError, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CategoriesStore {
  private readonly taskService = inject(TaskService);

  private readonly _categories = signal<Category[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _categoryVerifications = signal<Record<string, string[]>>({});
  private readonly _verificationsLoaded = signal<boolean>(false);

  readonly categories = computed(() => this._categories());
  readonly isLoading = computed(() => this._isLoading());
  readonly error = computed(() => this._error());
  readonly categoryVerifications = computed(() => this._categoryVerifications());

  readonly categoryMap = computed(() => {
    const map = new Map<string, Category>();
    this._categories().forEach(c => map.set(c.name, c));
    return map;
  });

  constructor() {
    this.loadCategories();
    this.loadCategoryVerifications();
  }

  loadCategories() {
    this._isLoading.set(true);
    this.taskService.getCategories().pipe(
      tap((categories) => {
        this._categories.set(categories);
        this._isLoading.set(false);
        this._error.set(null);
      }),
      catchError((err) => {
        this._error.set('Failed to load categories');
        this._isLoading.set(false);
        return EMPTY;
      })
    ).subscribe();
  }

  getCategoryColor(categoryName: string): { primary: string, secondary: string } {
    const category = this.categoryMap().get(categoryName);
    if (category) {
      return { primary: category.primaryColor, secondary: category.secondaryColor };
    }
    return { primary: '#808080', secondary: '#E0E0E0' };
  }

  allowedTypesFor(category: string): string[] {
    return this._categoryVerifications()[category] ?? [];
  }

  loadCategoryVerifications() {
    if (this._verificationsLoaded()) {
      return;
    }

    this.taskService.getCategoryVerifications().pipe(
      tap((categoryVerifications) => {
        this._categoryVerifications.set(categoryVerifications);
        this._verificationsLoaded.set(true);
      }),
      catchError((err) => {
        console.error('Failed to load category verifications:', err);
        return EMPTY;
      })
    ).subscribe();
  }
}
