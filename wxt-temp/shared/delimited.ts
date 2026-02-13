export type DelimitedFileType = 'csv' | 'tsv';

export const delimiterFromFileType = (fileType: DelimitedFileType) =>
  fileType === 'tsv' ? '\t' : ',';

export const parseDelimitedRows = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (inQuotes) {
        current += char;
        continue;
      }
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(current);
      current = '';
      rows.push(row);
      row = [];
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows.filter((nextRow) => nextRow.some((cell) => cell.trim() !== ''));
};

export const extractDelimitedMeta = (
  text: string,
  delimiter: string,
  hasHeader: boolean,
) => {
  const rows = parseDelimitedRows(text, delimiter);
  if (rows.length === 0) {
    return { columns: [] as string[], rowCount: 0, rows };
  }
  const headerParts = rows[0];
  const columns = hasHeader
    ? headerParts.map((value) => value.trim()).filter(Boolean)
    : headerParts.map((_, index) => `column${index + 1}`);
  const rowCount = Math.max(0, rows.length - (hasHeader ? 1 : 0));
  return { columns, rowCount, rows };
};

export const mapDelimitedRowsToObjects = (
  table: string[][],
  hasHeader: boolean,
) => {
  if (table.length === 0) {
    return { columns: [] as string[], rows: [] as Record<string, string>[] };
  }
  const header = table[0];
  const columns = hasHeader
    ? header.map((value, index) => value.trim() || `column${index + 1}`)
    : header.map((_value, index) => `column${index + 1}`);
  const dataRows = hasHeader ? table.slice(1) : table;
  const rows = dataRows.map((values) => {
    const mapped: Record<string, string> = {};
    columns.forEach((column, index) => {
      mapped[column] = values[index] ?? '';
    });
    return mapped;
  });
  return { columns, rows };
};

