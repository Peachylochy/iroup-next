"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit,
  Send,
  CheckCircle2,
  RotateCcw,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CurrentUserAccess } from "@/lib/auth/access";
import {
  returnMouToDraftAction,
  softDeleteMouAction,
  restoreMouAction,
  submitMouForm,
} from "./actions";
import { MouDetail } from "./mou-query";

type Props = {
  mou: MouDetail;
  access: CurrentUserAccess;
};

export function MouDetailActions({ mou, access }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [deleteNote, setDeleteNote] = useState("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isDeleted = mou.deleted_at !== null;
  const isSystemAdmin = access.roles.includes("system_admin");
  const canEdit =
    !isDeleted &&
    (access.modules.mou?.create || access.modules.mou?.update || isSystemAdmin);
  const canPublish = !isDeleted && (access.modules.mou?.publish || isSystemAdmin);

  const handleReview = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("intent", "review");
      formData.set("agreement_id", mou.id);
      formData.set("updated_at", mou.updated_at);

      const res = await submitMouForm({}, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handlePublish = () => {
    if (!confirm("คุณต้องการอนุมัติและเผยแพร่ MOU ฉบับนี้ใช่หรือไม่?")) return;

    setErrorMsg(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("intent", "publish");
      formData.set("agreement_id", mou.id);
      formData.set("updated_at", mou.updated_at);

      const res = await submitMouForm({}, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleReturnToDraft = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await returnMouToDraftAction(mou.id, mou.updated_at, returnNote);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setReturnDialogOpen(false);
        router.refresh();
      }
    });
  };

  const handleSoftDelete = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await softDeleteMouAction(mou.id, mou.updated_at, deleteNote);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setDeleteDialogOpen(false);
        router.refresh();
      }
    });
  };

  const handleRestore = () => {
    if (!confirm("คุณต้องการคืนค่า MOU ฉบับนี้ใช่หรือไม่?")) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await restoreMouAction(mou.id, mou.updated_at);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-2">
      {errorMsg && (
        <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Deleted state: Restore button for System Admin only */}
        {isDeleted && isSystemAdmin && (
          <Button
            variant="outline"
            className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            onClick={handleRestore}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            คืนค่า MOU (Restore)
          </Button>
        )}

        {!isDeleted && (
          <>
            {/* Edit button */}
            {canEdit && (
              <Link
                href={`/mou/${mou.id}/edit`}
                className={buttonVariants({ variant: "outline", className: "gap-2" })}
              >
                <Edit className="w-4 h-4" />
                แก้ไข MOU
              </Link>
            )}

            {/* Submit for review button (Draft state) */}
            {canEdit && mou.workflow_status === "draft" && (
              <Button
                variant="default"
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleReview}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                ส่งตรวจสอบ (Submit for Review)
              </Button>
            )}

            {/* Return to Draft Dialog & Button (Under Review state) */}
            {canPublish && mou.workflow_status === "under_review" && (
              <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50">
                    <RotateCcw className="w-4 h-4" />
                    ส่งกลับไปแก้ไข
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>ส่งกลับไปแก้ไข (Return to Draft)</DialogTitle>
                    <DialogDescription>
                      ระบุข้อเสนอแนะหรือเหตุผลที่ต้องส่งกลับเพื่อให้ผู้จัดทำแก้ไขเพิ่มเติม
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    <Textarea
                      placeholder="ข้อความหมายเหตุเพิ่มเติม..."
                      value={returnNote}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReturnNote(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setReturnDialogOpen(false)}>
                      ยกเลิก
                    </Button>
                    <Button
                      variant="default"
                      className="bg-orange-600 hover:bg-orange-700"
                      onClick={handleReturnToDraft}
                      disabled={isPending}
                    >
                      {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      ยืนยันส่งกลับ
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Publish button (Under Review or Draft for Publisher/Admin) */}
            {canPublish && mou.workflow_status === "under_review" && (
              <Button
                variant="default"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handlePublish}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                อนุมัติและเผยแพร่ (Publish)
              </Button>
            )}

            {/* Soft Delete Dialog & Button */}
            {canEdit && (
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    ลบ MOU
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>ลบ MOU (Soft Delete)</DialogTitle>
                    <DialogDescription>
                      MOU จะถูกซ่อนและย้ายไปยังสถานะลบ โดย System Admin สามารถคืนค่าได้ภายหลัง
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    <Textarea
                      placeholder="ระบุเหตุผลการลบ (ระบุหรือไม่ก็ได้)..."
                      value={deleteNote}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeleteNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
                      ยกเลิก
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleSoftDelete}
                      disabled={isPending}
                    >
                      {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      ยืนยันการลบ
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </div>
    </div>
  );
}
