import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            ไม่พบหน้าที่ค้นหา
          </h1>
          <p className="text-sm text-muted-foreground">
            หน้าที่คุณพยายามเข้าถึงอาจถูกย้าย ลบ หรือไม่เคยมีอยู่
            กรุณาตรวจสอบ URL อีกครั้ง
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}
