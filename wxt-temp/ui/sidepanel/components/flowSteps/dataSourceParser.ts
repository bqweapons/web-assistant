import { extractDelimitedMeta } from '../../../../shared/delimited';
import { t } from '../../utils/i18n';

export type DataSourceParsedMeta = {
  columns: string[];
  rowCount: number;
  error: string;
};

export const parseDataSourceMeta = (
  text: string,
  sourceType: 'csv' | 'tsv',
  hasHeader: boolean,
): DataSourceParsedMeta => {
  try {
    const delimiter = sourceType === 'tsv' ? '\t' : ',';
    const meta = extractDelimitedMeta(text, delimiter, hasHeader);
    return {
      columns: meta.columns,
      rowCount: meta.rowCount,
      error: '',
    };
  } catch {
    return {
      columns: [],
      rowCount: 0,
      error: t('sidepanel_steps_file_parse_error', 'Failed to parse file'),
    };
  }
};

export const buildDataSourceSummary = (columns: string[], rowCount: number, error: string) => {
  if (error) {
    return t('sidepanel_steps_file_parse_error', 'Failed to parse file');
  }
  if (columns.length > 0) {
    return t('sidepanel_steps_columns_rows', '{columns} columns | {rows} rows')
      .replace('{columns}', String(columns.length))
      .replace('{rows}', String(rowCount));
  }
  return t('sidepanel_steps_columns_missing', 'No columns detected');
};
