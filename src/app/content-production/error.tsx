"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <main className="module-main"><section className="module-list-card p-6">
    <h1 className="text-xl font-semibold">โหลดงานเนื้อหาไม่สำเร็จ</h1>
    <p role="alert" className="my-3">กรุณาลองโหลดข้อมูลอีกครั้ง</p>
    <div className="flex items-center gap-4">
      <Button disabled={pending} onClick={() => startTransition(() => { router.refresh(); reset(); })}>ลองอีกครั้ง</Button>
      <Link href="/" className="underline">กลับหน้าหลัก</Link>
    </div>
  </section></main>;
}
