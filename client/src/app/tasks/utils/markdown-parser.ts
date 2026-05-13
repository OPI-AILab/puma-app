import { extractTableDataFromString } from '../../milkdown-plugins/html-table/parser';

export const parseMarkdown = (markdown: string): string => {
  let processed = markdown;

  const tableMatches = Array.from(processed.matchAll(/<table[^>]*>[\s\S]*?<\/table>/gi));

  const replacements: Array<{ original: string; replacement: string }> = [];

  for (const match of tableMatches) {
    const tableHtml = match[0];
    const tableData = extractTableDataFromString(tableHtml);

    if (tableData && tableData.rows.length > 0) {
      let tableRendered = '<table class="border-collapse border border-gray-300">';

      for (const row of tableData.rows) {
        tableRendered += '<tr>';
        for (const cell of row) {
          const tag = cell.isHeader ? 'th' : 'td';
          const classes = cell.isHeader
            ? 'border border-gray-300 px-4 py-2 bg-gray-100 font-bold'
            : 'border border-gray-300 px-4 py-2';

          let attrs = `class="${classes}"`;
          if (cell.colspan && cell.colspan > 1) {
            attrs += ` colspan="${cell.colspan}"`;
          }
          if (cell.rowspan && cell.rowspan > 1) {
            attrs += ` rowspan="${cell.rowspan}"`;
          }

          tableRendered += `<${tag} ${attrs}>${cell.content}</${tag}>`;
        }
        tableRendered += '</tr>';
      }

      tableRendered += '</table>';

      replacements.push({ original: tableHtml, replacement: tableRendered });
    }
  }

  for (const { original, replacement } of replacements) {
    processed = processed.replace(original, replacement);
  }

  processed = processed.replace(/^(#{1,6})\s*(.*)$/gm, (match, hashes, content) => {
    const level = hashes.length;
    return `<h${level}>${content}</h${level}>`;
  });
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
  processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  processed = processed.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');

  const lines = processed.split('\n');
  let result: any[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if(trimmedLine === '') {
      continue;
    }

    if (trimmedLine.startsWith('<li>')) {
      if (!inList) {
        result.push('<ul class="list-reset">');
        inList = true;
      }
      result.push(trimmedLine);
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false;
      }
      if (trimmedLine) {
        result.push(trimmedLine);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  let finalResult = '';
  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    const next = result[i + 1];

    finalResult += current;

    if (!(current.includes('<ul') || current.includes('<li>') || current.includes('<table') ||
        (next && (next.includes('<li>') || next.includes('</ul>')))) && i < result.length - 1) {
      finalResult += '<br>';
    }
  }

  return finalResult.replace(/(<br\s*\/?>\s*){2,}/g, '<br>');
}
