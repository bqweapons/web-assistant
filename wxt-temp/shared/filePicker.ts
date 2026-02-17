export type DataSourceFileType = 'csv' | 'tsv';

export type DataSourceFileRequest = {
  title: string;
  fileType: DataSourceFileType;
};

export type DataSourceFilePickerOptions = {
  confirmMessage?: string;
  requireConfirm?: boolean;
};

export const inferDataSourceFileType = (fileName: string, fallback: DataSourceFileType): DataSourceFileType => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tsv')) {
    return 'tsv';
  }
  if (lower.endsWith('.csv')) {
    return 'csv';
  }
  return fallback;
};

const getAccept = (fileType: DataSourceFileType) =>
  fileType === 'tsv'
    ? '.tsv,text/tab-separated-values,text/plain'
    : '.csv,text/csv,text/plain';

export const requestDataSourceFile = (
  request: DataSourceFileRequest,
  options?: DataSourceFilePickerOptions,
): Promise<File | null> => {
  return new Promise((resolve) => {
    if (!document.body) {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = getAccept(request.fileType);
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) {
        return;
      }
      settled = true;
      input.removeEventListener('change', handleChange);
      input.removeEventListener('cancel', handleCancel as EventListener);
      input.remove();
      resolve(file);
    };

    const handleChange = () => {
      finish(input.files?.[0] ?? null);
    };

    const handleCancel = () => {
      finish(null);
    };

    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel as EventListener);
    document.body.appendChild(input);

    if (options?.requireConfirm) {
      const confirmed = window.confirm(options.confirmMessage || `Select CSV/TSV for step: ${request.title}`);
      if (!confirmed) {
        finish(null);
        return;
      }
    }

    input.click();
  });
};
