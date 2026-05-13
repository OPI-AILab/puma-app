import {
  htmlTableNode,
  htmlTableRowNode,
  htmlTableCellNode,
  htmlTableHeaderNode
} from './schema';
import { remarkHtmlTable } from './parser';
import {
  toggleTableFormatCommand,
  insertTableCommand,
  addColumnCommand,
  addRowCommand,
  deleteColumnCommand,
  deleteRowCommand
} from './commands';

export const htmlTablePlugin = [
  remarkHtmlTable,

  htmlTableNode,
  htmlTableRowNode,
  htmlTableCellNode,
  htmlTableHeaderNode,

  toggleTableFormatCommand,
  insertTableCommand,
  addColumnCommand,
  addRowCommand,
  deleteColumnCommand,
  deleteRowCommand,
].flat();

export * from './schema';
export * from './parser';
export * from './commands';
