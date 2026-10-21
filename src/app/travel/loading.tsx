export default function TravelLoading() {
  return (
    <main className="module-main" aria-busy="true" aria-label="กำลังโหลดข้อมูลการเดินทาง">
      <section className="module-list-card p-6">
        <p role="status" className="text-base">กำลังโหลดรายการเดินทาง…</p>
        <div aria-hidden="true" className="mt-6 grid gap-4">
          {[1, 2, 3].map((row) => <div key={row} className="h-20 rounded-xl bg-muted" />)}
        </div>
      </section>
    </main>
  );
}
