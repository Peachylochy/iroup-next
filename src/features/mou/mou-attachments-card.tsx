"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Trash2, Upload, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrentUserAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/client";
import {
  attachMouFileAction,
  detachMouFileAction,
  getMouAttachmentSignedUrlAction,
} from "./actions";

type Attachment = {
  id: string;
  asset_id: string;
  created_at: string;
  assets: {
    id: string;
    storage_bucket: string;
    storage_path: string;
    original_file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
  };
};

type Props = {
  agreementId: string;
  attachments: Attachment[];
  access: CurrentUserAccess;
  isDeleted?: boolean;
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "ไม่ระบุขนาด";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MouAttachmentsCard({ agreementId, attachments, access, isDeleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canEdit =
    !isDeleted &&
    (access.modules.mou?.create || access.modules.mou?.update || access.roles.includes("system_admin"));

  const handleDownload = async (filename: string, assetId: string) => {
    setDownloadingId(assetId);
    setErrorMsg(null);
    try {
      const url = await getMouAttachmentSignedUrlAction(agreementId, assetId);
      if (!url) {
        setErrorMsg("ไม่สามารถสร้างลิงก์สำหรับดาวน์โหลดได้");
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setErrorMsg(" เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const fileExt = file.name.split(".").pop();
        const fileId = crypto.randomUUID();
        const storagePath = `agreements/${agreementId}/${fileId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("mou-attachments")
          .upload(storagePath, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          setErrorMsg(`อัปโหลดไฟล์ไม่สำเร็จ: ${uploadError.message}`);
          return;
        }

        const res = await attachMouFileAction(
          agreementId,
          storagePath,
          file.name,
          file.type,
          file.size,
        );

        if (res.error) {
          setErrorMsg(res.error);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลด";
        setErrorMsg(msg);
      }
    });

    e.target.value = "";
  };

  const handleDetach = (assetId: string) => {
    if (!confirm("คุณต้องการลบเอกสารแนบนี้ใช่หรือไม่?")) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await detachMouFileAction(agreementId, assetId);
      if (res.error) setErrorMsg(res.error);
    });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            เอกสารแนบสัญญา (Internal Documents)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Lock className="w-3.5 h-3.5 text-amber-500 inline" />
            เอกสารนี้เป็นข้อมูลภายในเฉพาะผู้มีสิทธิ์เท่านั้น ห้ามเปิดเผยต่อสาธารณะ
          </CardDescription>
        </div>

        {canEdit && (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 pointer-events-none"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-primary" />
              )}
              แนบไฟล์เอกสาร
            </Button>
          </label>
        )}
      </CardHeader>

      <CardContent>
        {errorMsg && (
          <div className="mb-4 rounded-md bg-destructive/15 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        {attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีเอกสารแนบใน MOU ฉบับนี้
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-md border">
            {attachments.map((item) => {
              const asset = item.assets;
              const isDownloading = downloadingId === asset.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{asset.original_file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(asset.size_bytes)} • อัปโหลดเมื่อ{" "}
                        {new Date(asset.created_at).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() =>
                        handleDownload(asset.original_file_name, asset.id)
                      }
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      ดาวน์โหลด
                    </Button>

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDetach(asset.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
