/** ISO / сервер -> значение для input[type=date]. */
export function dueAtToInput(iso: string | null | undefined): string {
  if (!iso) return '';
  // Для значения вида YYYY-MM-DDTHH:mm:ss... берём только дату, без timezone-сдвигов.
  const short = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(short)) return short;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** date -> YYYY-MM-DD для API */
export function inputToDueAt(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return v;
}

/** Без timezone-сдвига, т.к. срок хранится как дата. */
export function formatDueDateRu(value: string | null | undefined): string {
  if (!value) return '';
  const short = value.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(short);
  if (!m) return value;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
