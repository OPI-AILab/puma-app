import {$remark} from '@milkdown/utils';
import type {HTML, Root} from 'mdast';
import {visit} from 'unist-util-visit';
import type {Plugin} from 'unified';

export const remarkHtmlTable = $remark('remarkHtmlTable', () => {

  const transformer: Plugin<[], Root> = () => {
    return (tree: Root) => {

      if (!tree || !tree.children) {
        return;
      }

      let htmlNodeCount = 0;
      let tableCount = 0;
      let allNodesTypes: string[] = [];

      visit(tree, (node: any) => {
        allNodesTypes.push(node.type);
        if (node.type === 'html') {
          htmlNodeCount++;
        }
      });


      const paragraphsToReplace: Array<{ paragraphIndex: number; tableNode: any }> = [];

      visit(tree, 'html', (node: HTML, index, parent) => {
        if (!node.value || typeof index !== 'number' || !parent) return;

        const trimmedValue = node.value.trim();

        if (trimmedValue.startsWith('<table') || trimmedValue.includes('<table')) {
          tableCount++;

          const tableData = extractTableDataFromString(trimmedValue);

          if (tableData && tableData.rows.length > 0) {

            const tableNode: any = {
              type: 'table',
              data: {
                hProperties: {
                  tableFormat: 'html'
                }
              },
              children: tableData.rows.map((row) => ({
                type: 'tableRow',
                children: row.map((cell) => ({
                  type: cell.isHeader ? 'tableHeader' : 'tableCell',
                  data: {
                    hProperties: {
                      colspan: cell.colspan || 1,
                      rowspan: cell.rowspan || 1
                    }
                  },
                  children: [{
                    type: 'text',
                    value: cell.content
                  }]
                }))
              }))
            };

            if (parent.type === 'paragraph') {

              const paragraphIndex = tree.children.findIndex(child => child === parent);
              if (paragraphIndex !== -1) {
                paragraphsToReplace.push({paragraphIndex, tableNode});
              }
            } else {
              (parent.children as any)[index] = tableNode;
            }
          } else {
          }
        }
      });

      paragraphsToReplace.reverse().forEach(({paragraphIndex, tableNode}) => {
        tree.children[paragraphIndex] = tableNode;
      });

    };
  };

  return transformer;
});

export const parseHtmlTable = (htmlString: string): HTMLTableElement | null => {
  if (typeof window === 'undefined') return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return doc.querySelector('table');
};

export const extractTableDataFromString = (htmlString: string): {
  rows: Array<Array<{ content: string; isHeader: boolean; colspan?: number; rowspan?: number }>>;
} | null => {
  const rows: Array<Array<{ content: string; isHeader: boolean; colspan?: number; rowspan?: number }>> = [];

  const trMatches = htmlString.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis);

  for (const trMatch of trMatches) {
    const trContent = trMatch[1];
    const cells: Array<{ content: string; isHeader: boolean; colspan?: number; rowspan?: number }> = [];

    const cellMatches = trContent.matchAll(/<(td|th)([^>]*)>(.*?)<\/(td|th)>/gis);

    for (const cellMatch of cellMatches) {
      const tag = cellMatch[1].toLowerCase();
      const attrs = cellMatch[2];
      const content = cellMatch[3];

      const isHeader = tag === 'th';

      const colspanMatch = attrs.match(/colspan\s*=\s*["']?(\d+)["']?/i);
      const rowspanMatch = attrs.match(/rowspan\s*=\s*["']?(\d+)["']?/i);

      const colspan = colspanMatch ? parseInt(colspanMatch[1], 10) : undefined;
      const rowspan = rowspanMatch ? parseInt(rowspanMatch[1], 10) : undefined;

      cells.push({
        content: content.trim(),
        isHeader,
        colspan,
        rowspan,
      });
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows.length > 0 ? {rows} : null;
};

export const extractTableData = (table: HTMLTableElement): {
  rows: Array<Array<{ content: string; isHeader: boolean; colspan?: number; rowspan?: number }>>;
} => {
  const rows: Array<Array<{ content: string; isHeader: boolean; colspan?: number; rowspan?: number }>> = [];

  const tableRows = table.querySelectorAll('tr');

  tableRows.forEach((tr) => {
    const cells: Array<{ content: string; isHeader: boolean; colspan?: number; rowspan?: number }> = [];

    const tableCells = tr.querySelectorAll('td, th');

    tableCells.forEach((cell) => {
      const isHeader = cell.tagName.toLowerCase() === 'th';
      const colspan = cell.getAttribute('colspan') ? parseInt(cell.getAttribute('colspan')!, 10) : undefined;
      const rowspan = cell.getAttribute('rowspan') ? parseInt(cell.getAttribute('rowspan')!, 10) : undefined;

      cells.push({
        content: cell.textContent || '',
        isHeader,
        colspan,
        rowspan,
      });
    });

    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  return {rows};
};
