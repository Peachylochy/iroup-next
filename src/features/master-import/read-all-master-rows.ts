type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Callers must use a stable, unique order (the master row ID). */
export async function readAllMasterRows<T>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Invalid page size");
  const rows: T[] = [];
  while (true) {
    const { data, error } = await readPage(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(`อ่านข้อมูล master ปัจจุบันไม่สำเร็จ: ${error.message}`);
    if (!data) throw new Error("อ่านข้อมูล master ปัจจุบันไม่สำเร็จ");
    if (data.length === 0) return rows;
    rows.push(...data);
    // Continue until an empty page, even if the server caps a page below the
    // requested size. A short page alone must never turn existing keys into inserts.
  }
}
