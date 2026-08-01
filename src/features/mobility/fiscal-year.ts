export function deriveThaiFiscalYear(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateValue.trim());
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return "";
  }

  return String(year + 543 + (month >= 10 ? 1 : 0));
}
