import { Component, inject, ChangeDetectionStrategy, OnInit, effect, signal, WritableSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TaskService } from '../services/task.service';
import { Category, Task } from '../models/task.models';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  startWith,
  switchMap,
  of,
  shareReplay
} from 'rxjs';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { FormsModule } from '@angular/forms';
import {AuthStore} from '../../auth/store/auth.store';
import {CategoriesStore} from '../store/categories.store';

interface CategoryWithCount extends Category {
  count: number;
  filteredCount: number;
}

interface CategoriesViewModel {
  categories: CategoryWithCount[];
  totalCount: number;
  totalFilteredCount: number;
  categoryColors: Record<string, string>;
}

interface TaskViewModel extends Task {
  searchableContent: string;
  formattedDate: string;
  tagMatchCount: number;
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    TagModule,
    SkeletonModule,
    MessageModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    DialogModule,
    ConfirmDialogModule,
    ToggleButtonModule,
    FormsModule,
  ],
  providers: [ConfirmationService, MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container mx-auto px-4 py-6">
      <div class="flex flex-col gap-2">
        <div class="flex gap-2 self-end">
          <p-toggleButton
            [ngModel]="myTasksFilter()"
            (ngModelChange)="myTasksFilter.set($event)"
            onLabel="My tasks"
            offLabel="My tasks"
            onIcon="pi pi-check"
            offIcon="pi pi-user"
            class="!text-sm whitespace-nowrap"
          />
          <p-toggleButton
            [ngModel]="thisWeekFilter()"
            (ngModelChange)="thisWeekFilter.set($event)"
            onLabel="This week"
            offLabel="This week"
            onIcon="pi pi-check"
            offIcon="pi pi-calendar"
            class="!text-sm whitespace-nowrap"
          />
          <p-toggleButton
            [ngModel]="withoutTagsFilter()"
            (ngModelChange)="withoutTagsFilter.set($event)"
            onLabel="Without tags"
            offLabel="Without tags"
            onIcon="pi pi-check"
            offIcon="pi pi-tag"
            class="!text-sm whitespace-nowrap"
          />
          <p-button
            label="Add task"
            icon="pi pi-plus"
            severity="success"
            [disabled]="!(selectedCategory$ | async)"
            (onClick)="addTask()"
            class="!text-sm whitespace-nowrap"
          ></p-button>
        </div>

        <div class="flex flex-wrap gap-2 p-2 bg-gray-100 rounded-md border border-gray-200">
          @if (categoriesWithCount$ | async; as vm) {
            <div class="flex flex-wrap gap-2">
              <p-button
                [label]="(hasActiveFilters && vm.totalCount != 0) ? 'All (' + vm.totalFilteredCount + ' / ' + vm.totalCount + ')' : 'All (' + vm.totalCount + ')'"
                [outlined]="(selectedCategory$ | async) !== null"
                (onClick)="filterByCategory(null)"
                styleClass="!text-sm "
                [style]="{
                color: '#6b7280',
                'border-color': '#6b7280',
                'background-color': (selectedCategory$ | async) !== null ? 'white' : '#d1d5db'
              }"
              ></p-button>

              @for (category of vm.categories; track category.name) {
                <p-button
                  [label]="hasActiveFilters && category.count != 0 ? category.name + ' (' + category.filteredCount + ' / ' + category.count + ')' : category.name + ' (' + category.count + ')'"
                  [outlined]="(selectedCategory$ | async) !== category.name"
                  (onClick)="filterByCategory(category.name)"
                  [style]="{
                  color: category.primaryColor,
                  'border-color': category.primaryColor,
                  'background-color': (selectedCategory$ | async) === category.name ? category.secondaryColor : 'white'
                }"
                  styleClass="!text-sm"
                ></p-button>
              }
            </div>
          }

          <div>
            @if (selectedCategory$ | async; as selectedCategory) {
              @if (availableTags$ | async; as tags) {
                @if (tags.length > 0) {
                  <div class="flex flex-wrap gap-2 p-2">
                    @for (tag of tags; track tag) {
                      @if (categoriesWithCount$ | async; as vm) {
                        <p-tag
                          [value]="tag.name + ' (' + tag.count + ')'"
                          [style]="{
                        'background-color': selectedTags().includes(tag.name) ? vm.categoryColors[selectedCategory] : '#e5e7eb',
                        'color': selectedTags().includes(tag.name) ? 'white' : '#374151',
                        'cursor': 'pointer',
                        'border': '1px solid ' + (selectedTags().includes(tag.name) ? vm.categoryColors[selectedCategory] : '#d1d5db')
                      }"
                          (click)="toggleTag(tag.name)"
                          class="hover:opacity-80 transition-opacity"
                        ></p-tag>
                      }
                    }
                  </div>
                }
              }
            }
          </div>
        </div>
      </div>

      <p-card>
        @if (tasksViewModel$ | async; as vm) {
          @if (vm.isLoading) {
            <div class="space-y-4">
              @for (item of [1, 2, 3, 4, 5]; track item) {
                <div class="flex gap-4 items-center">
                  <p-skeleton shape="circle" size="2rem"></p-skeleton>
                  <p-skeleton width="100%" height="1.5rem"></p-skeleton>
                  <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
                  <p-skeleton width="6rem" height="1.5rem"></p-skeleton>
                </div>
              }
            </div>
          } @else if (vm.error) {
            <p-message severity="error">{{ vm.error }}</p-message>
          } @else {
            <div class="mb-4">
              <p-iconfield iconPosition="left">
                <p-inputicon class="pi pi-search"></p-inputicon>
                <input
                  pInputText
                  type="text"
                  (input)="onSearchInput($event, dt)"
                  placeholder="Search by category or content..."
                  class="w-full"
                />
              </p-iconfield>
            </div>
            <div class="text-sm text-gray-600 font-semibold mb-2">
              Total: {{ vm.tasks.length }} {{ vm.tasks.length === 1 ? 'task' : 'tasks' }}
            </div>
            <p-table
              #dt
              [value]="vm.tasks"
              [tableStyle]="{ 'min-width': '50rem' }"
              [globalFilterFields]="['category', 'searchableContent']"
              selectionMode="single"
              (onRowSelect)="onTaskSelect($event)"
              sortField="date_added"
              [sortOrder]="-1"
              [customSort]="true"
              (sortFunction)="customSort($event)"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th style="width: 80px">Category</th>
                  <th>Content</th>
                  <th style="width: 20%">Tags</th>
                  <th style="width: 150px" pSortableColumn="user_added">
                    User
                    <p-sortIcon field="user_added"></p-sortIcon>
                  </th>
                  <th style="width: 120px" pSortableColumn="date_added">
                    Date
                    <p-sortIcon field="date_added"></p-sortIcon>
                  </th>
                  <th style="width: 120px">Actions</th>
                </tr>
              </ng-template>

              <ng-template pTemplate="body" let-task>
                @if (categoriesWithCount$ | async; as categoriesVm) {
                  <tr class="cursor-pointer hover:bg-gray-50" (click)="viewTask(task.id)">
                    <td>
                      <div
                        class="w-6 h-6 rounded-full border-2 border-gray-300"
                        [style.background-color]="categoriesVm.categoryColors[task.category] || '#6b7280'"
                        [title]="task.category"
                      ></div>
                    </td>
                    <td>
                      <div class="flex flex-col gap-2">
                        @for (content of task.details['content']; track content) {
                          @switch (content.type) {
                            @case ('text') {
                              <div class="text-sm font-medium text-gray-900 line-clamp-2">{{ content.text }}</div>
                            }
                            @case ('file') {
                              <div class="inline-flex items-center gap-2 mr-3 align-middle">
                                <div
                                  class="flex text-sm items-center gap-1 bg-gray-100 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-200 max-w-64"
                                  role="button"
                                  (click)="openFilePreview(content.file, $event)"
                                >
                                  <span class="truncate">{{ content.file }}</span>
                                  <i [ngClass]="getFileIconClass(content.file)"></i>
                                </div>
                              </div>
                            }
                          }
                        }
                      </div>
                      @if (task.details['content'].length === 0) {
                        <span class="text-sm text-gray-500">No content</span>
                      }
                    </td>
                    <td>
                      @if (task.details.tags && task.details.tags.length > 0) {
                        <div class="flex flex-wrap gap-2">
                          @for (tag of task.details.tags; track tag) {
                            <p-tag
                              [value]="tag"
                              class="!text-sm"
                              severity="secondary"
                            ></p-tag>
                          }
                        </div>
                      } @else {
                        <span class="text-sm text-gray-500">No tags</span>
                      }
                    </td>

                    <td>
                      <span class="text-sm font-medium text-gray-700">{{ task.user_added }}</span>
                    </td>
                    <td [style.text-align]="'right'">
                      <span class="text-sm text-gray-600 whitespace-pre-line">{{ task.formattedDate }}</span>
                    </td>
                    <td>
                      <p-button
                        icon="pi pi-times"
                        [rounded]="true"
                        (onClick)="confirmRemoveTask(task.id, $event)"
                        styleClass="!text-sm"
                        variant="outlined"
                        severity="danger"
                      ></p-button>
                    </td>
                  </tr>
                }
              </ng-template>

              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="5" class="py-8">
                    <div class="text-gray-500 text-center">
                      <i class="pi pi-info-circle text-3xl mb-2"></i>
                      <p>No tasks</p>
                      @if (selectedCategory$ | async) {
                        <p class="text-sm">This category has no tasks</p>
                      }
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="summary">
                <div class="text-sm text-gray-600 mt-2 font-semibold">
                  Total: {{ vm.tasks.length }} {{ vm.tasks.length === 1 ? 'task' : 'tasks' }}
                </div>
              </ng-template>
            </p-table>
          }
        }
      </p-card>

      <p-dialog
        [(visible)]="showImageModal"
        [modal]="true"
        [style]="{ 'max-width': '90vw', 'width': 'auto' }"
        [draggable]="false"
        [resizable]="false"
        [closeOnEscape]="true"
        [dismissableMask]="true"
        (onHide)="closeFilePreview()"
      >
        <ng-template pTemplate="header">
          <h3>{{ previewFileId() }}</h3>
        </ng-template>
        <div class="flex justify-center">
          @if (previewFileId()) {
            <img
              [src]="getFileUrl(previewFileId()!)"
              [alt]="previewFileId()"
              class="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
            />
          }
        </div>
      </p-dialog>

      <p-dialog
        [(visible)]="showAudioPlayer"
        [modal]="true"
        [style]="{ 'max-width': '400px', 'width': 'auto' }"
        [draggable]="false"
        [resizable]="false"
        [closeOnEscape]="true"
        [dismissableMask]="true"
        (onHide)="closeAudioPlayer()"
      >
        <ng-template pTemplate="header">
          <h3>{{ audioFileId() }}</h3>
        </ng-template>
        <div class="flex justify-center">
          @if (audioFileId()) {
            <audio
              controls
              [src]="getFileUrl(audioFileId()!)"
              class="w-full"
            ></audio>
          }
        </div>
      </p-dialog>

      <p-dialog
        [(visible)]="showVideoPlayer"
        [modal]="true"
        [style]="{ 'max-width': '90vw', 'width': 'auto' }"
        [draggable]="false"
        [resizable]="false"
        [closeOnEscape]="true"
        [dismissableMask]="true"
        (onHide)="closeVideoPlayer()"
      >
        <ng-template pTemplate="header">
          <h3>{{ videoFileId() }}</h3>
        </ng-template>
        <div class="flex justify-center">
          @if (videoFileId()) {
            <video
              controls
              autoplay
              [src]="getFileUrl(videoFileId()!)"
              class="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
            ></video>
          }
        </div>
      </p-dialog>

      <p-confirm-dialog/>
    </div>
  `,
})
export class TaskListComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly authStore = inject(AuthStore);
  private readonly categoriesStore = inject(CategoriesStore);

  private selectedCategorySubject = new BehaviorSubject<string | null>(null);
  selectedCategory$ = this.selectedCategorySubject.asObservable();

  selectedTags = signal<string[]>([]);

  myTasksFilter: WritableSignal<boolean>;
  thisWeekFilter: WritableSignal<boolean>;
  withoutTagsFilter: WritableSignal<boolean>;

  get hasActiveFilters(): boolean {
    return this.myTasksFilter() || this.thisWeekFilter() || this.withoutTagsFilter() || this.selectedTags().length > 0;
  }

  private refreshTasksSubject = new BehaviorSubject<void>(undefined);

  allTasks$ = combineLatest([this.refreshTasksSubject.pipe(startWith(undefined))]).pipe(
    switchMap(() => this.taskService.searchTasks({ offset: 0, limit: 1000 })),
    map((tasks): TaskViewModel[] => tasks.map(task => ({
      ...task,
      searchableContent: this.extractSearchableContent(task),
      formattedDate: this.formatDate(task.date_added),
      tagMatchCount: 0
    }))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  categories$ = toObservable(this.categoriesStore.categories);

  availableTags$ = this.selectedCategory$.pipe(
    switchMap(category => {
      if (!category) return of([]);
      return this.taskService.getTagsByCategory(category);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  categoriesWithCount$ = combineLatest([this.categories$, this.allTasks$]).pipe(
    map(([categories, tasks]) => {
      const filteredTasks = this.applyFilters(tasks);

      const counts = new Map<string, number>();
      const filteredCounts = new Map<string, number>();

      for (const task of tasks) {
        counts.set(task.category, (counts.get(task.category) || 0) + 1);
      }

      for (const task of filteredTasks) {
        filteredCounts.set(task.category, (filteredCounts.get(task.category) || 0) + 1);
      }

      const categoriesWithCount = categories.map(category => ({
        ...category,
        count: counts.get(category.name) || 0,
        filteredCount: filteredCounts.get(category.name) || 0,
      }));

      return {
        categories: categoriesWithCount,
        totalCount: tasks.length,
        totalFilteredCount: filteredTasks.length,
        categoryColors: categories.reduce((acc, cat) => ({ ...acc, [cat.name]: cat.primaryColor }), {} as Record<string, string>)
      };
    }),
    catchError(() => of<CategoriesViewModel>({ categories: [], totalCount: 0, totalFilteredCount: 0, categoryColors: {} }))
  );

  tasksViewModel$ = combineLatest([this.selectedCategory$, this.allTasks$, toObservable(this.selectedTags)]).pipe(
    map(([selectedCategory, tasks, selectedTags]) => {
      let filteredTasks = selectedCategory ? tasks.filter(task => task.category === selectedCategory) : tasks;
      filteredTasks = this.applyFilters(filteredTasks);

      for (const task of filteredTasks) {
        task.tagMatchCount = 0;
      }

      if (selectedTags.length > 0) {
        const tagSet = new Set(selectedTags);
        const matched: TaskViewModel[] = [];
        for (const task of filteredTasks) {
          const taskTags = task.details.tags || [];
          let count = 0;
          for (const t of taskTags) {
            if (tagSet.has(t)) count++;
          }
          if (count > 0) {
            task.tagMatchCount = count;
            matched.push(task);
          }
        }
        filteredTasks = matched;
      }

      return {
        tasks: filteredTasks,
        isLoading: false,
        error: null,
      };
    }),
    startWith({ tasks: [] as TaskViewModel[], isLoading: true, error: null }),
    catchError(() =>
      of({
        tasks: [] as TaskViewModel[],
        isLoading: false,
        error: 'Error loading tasks',
      })
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  previewFileId = signal<string | null>(null);
  showImageModal = signal(false);
  showAudioPlayer = signal(false);
  audioFileId = signal<string | null>(null);
  showVideoPlayer = signal(false);
  videoFileId = signal<string | null>(null);

  constructor() {
    this.myTasksFilter = signal(localStorage.getItem('myTasksFilter') === 'true');
    this.thisWeekFilter = signal(localStorage.getItem('thisWeekFilter') === 'true');
    this.withoutTagsFilter = signal(localStorage.getItem('withoutTagsFilter') === 'true');

    effect(() => {
      localStorage.setItem('myTasksFilter', String(this.myTasksFilter()));
      localStorage.setItem('thisWeekFilter', String(this.thisWeekFilter()));
      localStorage.setItem('withoutTagsFilter', String(this.withoutTagsFilter()));
      this.refreshTasksSubject.next();
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const category = params['category'] || null;
      this.selectedCategorySubject.next(category);

      const tagsParam = params['tags'];
      if (tagsParam) {
        const tags = tagsParam.split(',').filter((t: string) => t.length > 0);
        this.selectedTags.set(tags);
      } else {
        this.selectedTags.set([]);
      }
    });
  }

  filterByCategory(category: string | null): void {
    this.selectedCategorySubject.next(category);
    this.selectedTags.set([]);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: category, tags: null },
      queryParamsHandling: 'merge'
    });
  }

  toggleTag(tag: string): void {
    this.selectedTags.update(tags => {
      if (tags.includes(tag)) {
        return tags.filter(t => t !== tag);
      } else {
        return [...tags, tag];
      }
    });
  }

  customSort(event: any): void {
    const field = event.field as keyof TaskViewModel;
    const order = event.order as number;

    event.data.sort((a: TaskViewModel, b: TaskViewModel) => {
      if (a.tagMatchCount !== b.tagMatchCount) {
        return b.tagMatchCount - a.tagMatchCount;
      }

      const value1 = a[field];
      const value2 = b[field];

      if (value1 == null && value2 != null) return -1 * order;
      if (value1 != null && value2 == null) return 1 * order;
      if (value1 == null && value2 == null) return 0;

      if (typeof value1 === 'string' && typeof value2 === 'string') {
        return value1.localeCompare(value2) * order;
      }

      return (value1 < value2 ? -1 : value1 > value2 ? 1 : 0) * order;
    });
  }

  addTask(): void {
    const category = this.selectedCategorySubject.getValue();
    if (category) {
      this.router.navigate(['/tasks/new'], {
        queryParams: { category },
        state: {
          returnCategory: category,
          returnTags: this.selectedTags()
        }
      });
    }
  }

  viewTask(taskId: string): void {
    const currentCategory = this.selectedCategorySubject.getValue();
    this.router.navigate(['/tasks', taskId], {
      state: {
        returnCategory: currentCategory,
        returnTags: this.selectedTags()
      }
    });
  }

  onTaskSelect(event: any): void {
    if (event.data) {
      this.viewTask(event.data.id);
    }
  }

  confirmRemoveTask(taskId: string, event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Do you want to delete this task?',
      header: 'Confirmation',
      icon: 'pi pi-info-circle',
      rejectLabel: 'Cancel',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger',
      },
      accept: () => {
        this.taskService.deleteTask(taskId).subscribe({
          next: () => {
            this.refreshTasksSubject.next(undefined);
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Task removed successfully' });
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove task' });
            console.error('Error removing task: ', err);
          },
        });
      },
      reject: () => {},
    });
  }

  private readonly imageExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
  private readonly audioExt = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
  private readonly videoExt = new Set(['mp4', 'webm']);

  getFileIconClass(fileId?: string): string {
    if (!fileId) return 'pi pi-file text-gray-600';
    const ext = (fileId.split('.').pop() || '').toLowerCase();
    if (this.imageExt.has(ext)) return 'pi pi-image text-emerald-600';
    if (this.audioExt.has(ext)) return 'pi pi-volume-up text-blue-600';
    if (this.videoExt.has(ext)) return 'pi pi-video text-pink-600';
    return 'pi pi-file text-gray-600';
  }

  formatDate(dateString: string): string {
    const date = dateString ? new Date(dateString) : new Date();
    const dateStr = date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr}\n${timeStr}`;
  }

  openFilePreview(fileId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isImage(fileId)) {
      this.previewFileId.set(fileId);
      this.showImageModal.set(true);
    } else if (this.isAudio(fileId)) {
      this.audioFileId.set(fileId);
      this.showAudioPlayer.set(true);
    } else if (this.isVideo(fileId)) {
      this.videoFileId.set(fileId);
      this.showVideoPlayer.set(true);
    }
  }

  closeFilePreview(): void {
    this.showImageModal.set(false);
    this.previewFileId.set(null);
  }

  openAudioPlayer(fileId: string): void {
    this.audioFileId.set(fileId);
    this.showAudioPlayer.set(true);
  }

  closeAudioPlayer(): void {
    this.showAudioPlayer.set(false);
    this.audioFileId.set(null);
  }

  closeVideoPlayer(): void {
    this.showVideoPlayer.set(false);
    this.videoFileId.set(null);
  }

  getFileExtension(fileId: string): string {
    const parts = fileId.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  getFileUrl(fileId: string): string {
    return `/api/file/${fileId}/download`;
  }

  isImage(fileId: string): boolean {
    const extension = this.getFileExtension(fileId);
    return this.imageExt.has(extension);
  }

  isAudio(fileId: string): boolean {
    const extension = this.getFileExtension(fileId);
    return this.audioExt.has(extension);
  }

  isVideo(fileId: string): boolean {
    const extension = this.getFileExtension(fileId);
    return this.videoExt.has(extension);
  }

  private applyFilters<T extends Task>(tasks: T[]): T[] {
    let filteredTasks = tasks;

    if (this.myTasksFilter()) {
      const currentUser = this.authStore.user();
      if (currentUser) {
        filteredTasks = filteredTasks.filter(task => task.user_added === currentUser.username);
      }
    }

    if (this.thisWeekFilter()) {
      const today = new Date();
      const offset = (today.getDay() + 6) % 7;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - offset);
      startOfWeek.setHours(0, 0, 0, 0);

      filteredTasks = filteredTasks.filter(task => {
        const taskDate = new Date(task.date_added);
        return taskDate >= startOfWeek;
      });
    }

    if (this.withoutTagsFilter()) {
      filteredTasks = filteredTasks.filter(task => {
        const tags = task.details.tags;
        return !tags || tags.length === 0;
      });
    }

    return filteredTasks;
  }

  extractSearchableContent(task: Task): string {
    const textContent = task.details.content
      .filter(content => content.type === 'text' && content.text)
      .map(content => content.text)
      .join(' ');

    const fileContent = task.details.content
      .filter(content => content.type === 'file' && content.file)
      .map(content => content.file)
      .join(' ');

    const conditionsContent = task.details.conditions
      .flatMap(condition => {
        const items: string[] = [];
        if (condition.expected) {
          if (Array.isArray(condition.expected)) {
            const flattened = condition.expected.flat(Infinity);
            items.push(...flattened.filter(item => typeof item === 'string'));
          } else if (typeof condition.expected === 'string') {
            items.push(condition.expected);
          }
        }
        return items;
      })
      .join(' ');

    return `${textContent} ${fileContent} ${conditionsContent}`.trim();
  }

  onSearchInput(event: Event, table: any): void {
    const input = event.target as HTMLInputElement;
    table.filterGlobal(input.value, 'contains');
  }
}
