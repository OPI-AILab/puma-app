import { $command, $useKeymap } from '@milkdown/utils';
import type { Command } from '@milkdown/prose/state';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import type { NodeType } from '@milkdown/prose/model';
import { Selection } from '@milkdown/prose/state';

function findParentNodeOfType(nodeType: NodeType) {
  return (selection: Selection): { node: ProseMirrorNode; pos: number } | undefined => {
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type === nodeType) {
        return { node, pos: $from.before(depth) };
      }
    }
    return undefined;
  };
}

export const toggleTableFormatCommand = $command('ToggleTableFormat', (ctx) => {
  return (format?: 'markdown' | 'html'): Command => (state, dispatch) => {
    const { selection, schema } = state;
    const tableType = schema.nodes['table'];

    if (!tableType) return false;

    const tableNode = findParentNodeOfType(tableType)(selection);

    if (!tableNode) return false;

    const newFormat = format || (tableNode.node.attrs['tableFormat'] === 'markdown' ? 'html' : 'markdown');

    if (dispatch) {
      const tr = state.tr.setNodeMarkup(
        tableNode.pos,
        undefined,
        { ...tableNode.node.attrs, tableFormat: newFormat }
      );
      dispatch(tr);
    }

    return true;
  };
});

export const insertTableCommand = $command('InsertTable', (ctx) => {
  return (rows: number = 3, cols: number = 3, format: 'markdown' | 'html' = 'markdown'): Command => (state, dispatch) => {
    const { schema, selection } = state;
    const table = schema.nodes['table'];
    const table_row = schema.nodes['table_row'];
    const table_cell = schema.nodes['table_cell'];
    const table_header = schema.nodes['table_header'];

    if (!table || !table_row || !table_cell || !table_header) return false;

    const headerCells: ProseMirrorNode[] = [];
    for (let i = 0; i < cols; i++) {
      headerCells.push(table_header.createAndFill()!);
    }
    const headerRow = table_row.create(null, headerCells);

    const bodyRows: ProseMirrorNode[] = [headerRow];
    for (let i = 1; i < rows; i++) {
      const cells: ProseMirrorNode[] = [];
      for (let j = 0; j < cols; j++) {
        cells.push(table_cell.createAndFill()!);
      }
      bodyRows.push(table_row.create(null, cells));
    }

    const tableNode = table.create({ tableFormat: format }, bodyRows);

    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(tableNode);
      dispatch(tr);
    }

    return true;
  };
});

export const addColumnCommand = $command('AddColumn', (ctx) => {
  return (position: 'before' | 'after' = 'after'): Command => (state, dispatch) => {
    const { selection, schema } = state;
    const tableType = schema.nodes['table'];
    const tableCellType = schema.nodes['table_cell'];
    const tableHeaderType = schema.nodes['table_header'];

    if (!tableType || !tableCellType || !tableHeaderType) return false;

    const tableNode = findParentNodeOfType(tableType)(selection);
    if (!tableNode) return false;

    const cellPos = selection.$anchor.pos;
    let colIndex = 0;
    let currentPos = tableNode.pos + 1;

    tableNode.node.forEach((rowNode: ProseMirrorNode, offset: number) => {
      let cellCount = 0;
      rowNode.forEach((cellNode: ProseMirrorNode, cellOffset: number) => {
        const cellStart = currentPos + cellOffset + 1;
        const cellEnd = cellStart + cellNode.nodeSize;

        if (cellPos >= cellStart && cellPos < cellEnd) {
          colIndex = cellCount;
        }
        cellCount++;
      });
      currentPos += rowNode.nodeSize;
    });

    if (dispatch) {
      const tr = state.tr;
      let currentRowPos = tableNode.pos + 1;

      tableNode.node.forEach((rowNode: ProseMirrorNode, rowOffset: number, rowIndex: number) => {
        let cellIndex = 0;
        const isHeaderRow = rowIndex === 0;
        const cellType = isHeaderRow ? tableHeaderType : tableCellType;

        const newCell = cellType.createAndFill()!;
        const insertPos = position === 'before' ? colIndex : colIndex + 1;

        let cellPos = currentRowPos + 1;
        rowNode.forEach((cellNode: ProseMirrorNode, offset: number, index: number) => {
          if (index === insertPos) {
            tr.insert(cellPos, newCell);
          }
          cellPos += cellNode.nodeSize;
        });

        currentRowPos += rowNode.nodeSize;
      });

      dispatch(tr);
    }

    return true;
  };
});

export const addRowCommand = $command('AddRow', (ctx) => {
  return (position: 'before' | 'after' = 'after'): Command => (state, dispatch) => {
    const { selection, schema } = state;
    const tableType = schema.nodes['table'];
    const tableRowType = schema.nodes['table_row'];
    const tableCellType = schema.nodes['table_cell'];

    if (!tableType || !tableRowType || !tableCellType) return false;

    const tableNode = findParentNodeOfType(tableType)(selection);
    if (!tableNode) return false;

    let colCount = 0;
    if (tableNode.node.firstChild) {
      tableNode.node.firstChild.forEach(() => {
        colCount++;
      });
    }

    const cells: ProseMirrorNode[] = [];
    for (let i = 0; i < colCount; i++) {
      cells.push(tableCellType.createAndFill()!);
    }
    const newRow = tableRowType.create(null, cells);

    if (dispatch) {
      const tr = state.tr;
      const cellPos = selection.$anchor.pos;

      let currentPos = tableNode.pos + 1;
      let targetRowPos = currentPos;
      let found = false;

      tableNode.node.forEach((rowNode: ProseMirrorNode, offset: number) => {
        const rowStart = currentPos;
        const rowEnd = currentPos + rowNode.nodeSize;

        if (!found && cellPos >= rowStart && cellPos < rowEnd) {
          targetRowPos = position === 'before' ? rowStart : rowEnd;
          found = true;
        }
        currentPos = rowEnd;
      });

      tr.insert(targetRowPos, newRow);
      dispatch(tr);
    }

    return true;
  };
});

export const deleteColumnCommand = $command('DeleteColumn', (ctx) => {
  return (): Command => (state, dispatch) => {
    const { selection, schema } = state;
    const tableType = schema.nodes['table'];

    if (!tableType) return false;

    const tableNode = findParentNodeOfType(tableType)(selection);
    if (!tableNode) return false;

    if (dispatch) {
      const tr = state.tr;
      dispatch(tr);
    }

    return true;
  };
});

export const deleteRowCommand = $command('DeleteRow', (ctx) => {
  return (): Command => (state, dispatch) => {
    const { selection, schema } = state;
    const tableType = schema.nodes['table'];
    const tableRowType = schema.nodes['table_row'];

    if (!tableType || !tableRowType) return false;

    const tableNode = findParentNodeOfType(tableType)(selection);
    if (!tableNode) return false;

    const rowNode = findParentNodeOfType(tableRowType)(selection);
    if (!rowNode) return false;

    if (dispatch) {
      const tr = state.tr.delete(rowNode.pos, rowNode.pos + rowNode.node.nodeSize);
      dispatch(tr);
    }

    return true;
  };
});
