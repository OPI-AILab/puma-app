import { $node } from '@milkdown/utils';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';

export const htmlTableNode = $node('table', (ctx) => {
  return {
    content: 'table_row+',
    tableRole: 'table',
    isolating: true,
    group: 'block',
    attrs: {
      tableFormat: { default: 'markdown' },
    },
    parseDOM: [
      {
        tag: 'table',
        getAttrs: (dom) => {
          return {
            tableFormat: 'html',
          };
        },
      },
    ],
    toDOM: (node: ProseMirrorNode) => {
      if (node.attrs['tableFormat'] === 'html') {
        return ['table', 0];
      }
      return ['div', { class: 'table-wrapper' }, ['table', 0]];
    },
    toMarkdown: {
      match: (node) => node.type.name === 'table',
      runner: (state, node) => {
        const isHtmlFormat = node.attrs['tableFormat'] === 'html';

        if (isHtmlFormat) {

          let html = '<table>\n';

          node.forEach((rowNode: any) => {
            html += '  <tr>\n';

            rowNode.forEach((cellNode: any) => {
              const tag = cellNode.type.name === 'table_header' ? 'th' : 'td';
              const attrs = [];

              if (cellNode.attrs['colspan'] && cellNode.attrs['colspan'] > 1) {
                attrs.push(`colspan="${cellNode.attrs['colspan']}"`);
              }
              if (cellNode.attrs['rowspan'] && cellNode.attrs['rowspan'] > 1) {
                attrs.push(`rowspan="${cellNode.attrs['rowspan']}"`);
              }

              const attrString = attrs.length ? ' ' + attrs.join(' ') : '';

              let cellContent = '';
              cellNode.forEach((child: any) => {
                if (child.isText) {
                  cellContent += child.text || '';
                }
              });

              html += `    <${tag}${attrString}>${cellContent}</${tag}>\n`;
            });

            html += '  </tr>\n';
          });

          html += '</table>\n';

          state.openNode('html', undefined, { value: html });
          state.closeNode();
        } else {
          state.openNode(node.type.name);
          state.next(node.content);
          state.closeNode();
        }
      }
    },
    parseMarkdown: {
      match: (node) => node.type === 'table',
      runner: (state, node, type) => {
        const tableFormat = (node.data as any)?.hProperties?.tableFormat || 'markdown';
        state.openNode(type, { tableFormat });
        state.next(node.children);
        state.closeNode();
      }
    }
  };
});

export const htmlTableRowNode = $node('table_row', (ctx) => {
  return {
    content: '(table_cell | table_header)*',
    tableRole: 'row',
    parseDOM: [{ tag: 'tr' }],
    toDOM: () => ['tr', 0],
    toMarkdown: {
      match: (node) => node.type.name === 'table_row',
      runner: (state, node) => {
        state.openNode(node.type.name);
        state.next(node.content);
        state.closeNode();
      }
    },
    parseMarkdown: {
      match: (node) => node.type === 'tableRow',
      runner: (state, node, type) => {
        state.openNode(type);
        state.next(node.children);
        state.closeNode();
      }
    }
  };
});

export const htmlTableCellNode = $node('table_cell', (ctx) => {
  return {
    content: 'inline*',
    tableRole: 'cell',
    isolating: true,
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null },
    },
    parseDOM: [
      {
        tag: 'td',
        getAttrs: (dom: HTMLElement) => {
          const colspan = dom.getAttribute('colspan');
          const rowspan = dom.getAttribute('rowspan');
          const colwidth = dom.getAttribute('data-colwidth');

          return {
            colspan: colspan ? parseInt(colspan, 10) : 1,
            rowspan: rowspan ? parseInt(rowspan, 10) : 1,
            colwidth: colwidth ? colwidth.split(',').map((w: string) => parseInt(w, 10)) : null,
          };
        },
      },
    ],
    toDOM: (node: ProseMirrorNode) => {
      const attrs: Record<string, any> = {};

      if (node.attrs['colspan'] && node.attrs['colspan'] > 1) {
        attrs['colspan'] = node.attrs['colspan'];
      }
      if (node.attrs['rowspan'] && node.attrs['rowspan'] > 1) {
        attrs['rowspan'] = node.attrs['rowspan'];
      }
      if (node.attrs['colwidth']) {
        attrs['data-colwidth'] = node.attrs['colwidth'].join(',');
      }

      return ['td', attrs, 0];
    },
    toMarkdown: {
      match: (node) => node.type.name === 'table_cell',
      runner: (state, node) => {
        state.openNode(node.type.name);
        state.next(node.content);
        state.closeNode();
      }
    },
    parseMarkdown: {
      match: (node) => node.type === 'tableCell',
      runner: (state, node, type) => {
        const attrs = {
          colspan: (node.data as any)?.hProperties?.colspan || 1,
          rowspan: (node.data as any)?.hProperties?.rowspan || 1,
          colwidth: null
        };
        state.openNode(type, attrs);
        state.next(node.children);
        state.closeNode();
      }
    }
  };
});

export const htmlTableHeaderNode = $node('table_header', (ctx) => {
  return {
    content: 'inline*',
    tableRole: 'header_cell',
    isolating: true,
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null },
    },
    parseDOM: [
      {
        tag: 'th',
        getAttrs: (dom: HTMLElement) => {
          const colspan = dom.getAttribute('colspan');
          const rowspan = dom.getAttribute('rowspan');
          const colwidth = dom.getAttribute('data-colwidth');

          return {
            colspan: colspan ? parseInt(colspan, 10) : 1,
            rowspan: rowspan ? parseInt(rowspan, 10) : 1,
            colwidth: colwidth ? colwidth.split(',').map((w: string) => parseInt(w, 10)) : null,
          };
        },
      },
    ],
    toDOM: (node: ProseMirrorNode) => {
      const attrs: Record<string, any> = {};

      if (node.attrs['colspan'] && node.attrs['colspan'] > 1) {
        attrs['colspan'] = node.attrs['colspan'];
      }
      if (node.attrs['rowspan'] && node.attrs['rowspan'] > 1) {
        attrs['rowspan'] = node.attrs['rowspan'];
      }
      if (node.attrs['colwidth']) {
        attrs['data-colwidth'] = node.attrs['colwidth'].join(',');
      }

      return ['th', attrs, 0];
    },
    toMarkdown: {
      match: (node) => node.type.name === 'table_header',
      runner: (state, node) => {
        state.openNode(node.type.name);
        state.next(node.content);
        state.closeNode();
      }
    },
    parseMarkdown: {
      match: (node) => node.type === 'tableCell' || node.type === 'tableHeader',
      runner: (state, node, type) => {
        const attrs = {
          colspan: (node.data as any)?.hProperties?.colspan || 1,
          rowspan: (node.data as any)?.hProperties?.rowspan || 1,
          colwidth: null
        };
        state.openNode(type, attrs);
        state.next(node.children);
        state.closeNode();
      }
    }
  };
});
