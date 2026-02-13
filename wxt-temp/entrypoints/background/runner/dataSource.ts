import { delimiterFromFileType, mapDelimitedRowsToObjects, parseDelimitedRows } from '../../../shared/delimited';
import type { FlowStepData } from '../../../shared/flowStepMigration';
import { getStepFieldRawValue, type FlowRowContext } from './tokenRenderer';

export type DataSourceParseResult = {
  rows: FlowRowContext[];
  estimatedRows: number;
  rowStepWeight: number;
};

export const parseDataSourceRows = (step: FlowStepData, rowStepWeight: number): DataSourceParseResult => {
  const rawText = step.dataSource?.rawText || '';
  if (!rawText.trim()) {
    throw new Error('Data source has no content.');
  }
  const sourceType = step.dataSource?.fileType === 'tsv' ? 'tsv' : 'csv';
  const delimiter = delimiterFromFileType(sourceType);
  const table = parseDelimitedRows(rawText, delimiter);
  if (table.length === 0) {
    return { rows: [], estimatedRows: 0, rowStepWeight };
  }
  const headerSetting = getStepFieldRawValue(step, 'headerRow');
  const hasHeader = headerSetting ? headerSetting === 'true' : true;
  const { rows } = mapDelimitedRowsToObjects(table, hasHeader);
  const estimatedRows =
    typeof step.dataSource?.rowCount === 'number' && Number.isFinite(step.dataSource.rowCount)
      ? Math.max(0, step.dataSource.rowCount)
      : rows.length;
  return { rows, estimatedRows, rowStepWeight };
};
