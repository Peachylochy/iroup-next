"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function TravelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="module-main">
      <section className="module-list-card p-6" aria-labelledby="travel-error-title">
        <h1 id="travel-error-title" className="text-xl font-semibold">โหลดข้อมูลการเดินทางไม่สำเร็จ</h1>
        <p role="alert" className="my-3 text-muted-foreground">ลองโหลดข้อมูลอีกครั้ง ตัวกรองที่เลือกไว้ยังอยู่ใน URL</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={retry} disabled={isPending}>{isPending ? "กำลังโหลด…" : "ลองอีกครั้ง"}</Button>
          <Link href="/" className="underline underline-offset-4">กลับหน้าหลัก</Link>
        </div>
      </section>
    </main>
  );
}
