import {Pipe, PipeTransform} from '@angular/core';
import { parseMarkdown } from '../utils/markdown-parser';

@Pipe({
  standalone: true,
  name: 'markdown'
})
export class MarkdownPipe implements PipeTransform {

  transform(markdownText: string | null | undefined): string {
  if (!markdownText) {
      return '';
    }
    return parseMarkdown(markdownText);
  }

}
