export const formatLocalDateTime = (value?: number | string | null) => {
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      value = numeric;
    } else {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        value = parsed;
      }
    }
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    const formatted = date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    if (formatted) {
      return formatted;
    }
  } catch {
    // Fall through to stable formatter below.
  }
  const pad = (segment: number) => String(segment).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};
