import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChipModule } from 'primeng/chip';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { TaskService } from '../services/task.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-tag-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ChipModule, AutoCompleteModule],
  template: `
    <div class="flex flex-wrap gap-2">
      @for (tag of tags; track tag) {
        <p-chip
          (onRemove)="removeTag(tag)"
          [label]="tag"
          removable="true"
        />
      }

      <p-autoComplete
        [(ngModel)]="newTag"
        [suggestions]="filteredTags()"
        (completeMethod)="filterTags($event)"
        (onSelect)="addTag($event.value)"
        (keydown)="onKeyDown($event)"
        [dropdown]="false"
        placeholder="Add tag..."
      ></p-autoComplete>
    </div>
  `,
  styles: []
})
export class TagEditorComponent {
  private readonly taskService = inject(TaskService);

  @Input() tags: string[] = [];
  @Output() tagsChange: EventEmitter<string[]> = new EventEmitter<string[]>();
  @Input() taskId!: string;

  newTag: string = '';
  filteredTags = signal<string[]>([]);

  addTag(tag: string): void {
    if (tag && !this.tags.includes(tag)) {
      const updatedTags = [...this.tags, tag];
      this.tags = updatedTags;
      this.tagsChange.emit(updatedTags);
      this.newTag = '';
    }
  }

  removeTag(tag: string): void {
    const updatedTags = this.tags.filter(t => t !== tag);
    this.tags = updatedTags;
    this.tagsChange.emit(updatedTags);
  }

  filterTags(event: AutoCompleteCompleteEvent): void {
    const query = event.query.toLowerCase();
    if (query === '') {
      this.filteredTags.set([]);
      return;
    }

    this.taskService.getTags(this.taskId)
      .pipe(
        catchError(error => {
          return of([]);
        })
      )
      .subscribe(tags => {
        this.filteredTags.set(tags.filter(tag => tag.toLowerCase().includes(query)));
      });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.addTag(this.newTag);
    }
  }
}
