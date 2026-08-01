"use client";

import { useState } from "react";
import {
  Check,
  ContactRound,
  DatabaseBackup,
  FileCheck2,
  Loader2,
  PlaneTakeoff,
  RefreshCw,
  Upload,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";

import type { LegacyContactPreview } from "./legacy-contact-import";
import type { LegacyMouPreview } from "./legacy-public-import";
import type { LegacyTravelPreview } from "./legacy-travel-import";

type Viewer = { displayName: string; email: string; role: string };

export function LegacyImportWorkspace({
  access,
  viewer,
}: {
  access: CurrentUserAccess;
  viewer: Viewer;
}) {
  const [preview, setPreview] = useState<LegacyMouPreview>();
  const [batchId, setBatchId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();
  const [committed, setCommitted] = useState(false);
  const [contactFile, setContactFile] = useState<File>();
  const [contactPreview, setContactPreview] = useState<LegacyContactPreview>();
  const [contactBatchId, setContactBatchId] = useState<string>();
  const [contactLoading, setContactLoading] = useState(false);
  const [contactConfirmation, setContactConfirmation] = useState("");
  const [contactMessage, setContactMessage] = useState<string>();
  const [contactsCommitted, setContactsCommitted] = useState(false);
  const [travelFile, setTravelFile] = useState<File>();
  const [travelPreview, setTravelPreview] = useState<LegacyTravelPreview>();
  const [travelBatchId, setTravelBatchId] = useState<string>();
  const [travelLoading, setTravelLoading] = useState(false);
  const [travelConfirmation, setTravelConfirmation] = useState("");
  const [travelMessage, setTravelMessage] = useState<string>();
  const [travelCommitted, setTravelCommitted] = useState(false);

  async function loadPreview() {
    setLoading(true);
    setMessage(undefined);
    const response = await fetch("/api/settings/legacy-import");
    const body = (await response.json()) as LegacyMouPreview & { error?: string };
    setLoading(false);
    if (!response.ok) return setMessage(body.error || "อ่านข้อมูลระบบเดิมไม่สำเร็จ");
    setPreview(body);
    setBatchId(undefined);
    setCommitted(false);
  }

  async function createStaging() {
    setLoading(true);
    setMessage(undefined);
    const response = await fetch("/api/settings/legacy-import", { method: "POST" });
    const body = (await response.json()) as {
      batchId?: string;
      preview?: LegacyMouPreview;
      error?: string;
    };
    setLoading(false);
    if (!response.ok || !body.batchId) {
      return setMessage(body.error || "สร้าง staging ไม่สำเร็จ");
    }
    setPreview(body.preview);
    setBatchId(body.batchId);
    setMessage("สร้าง staging และตรวจจับคู่ Data Master แล้ว ยังไม่ได้เขียน MOU จริง");
  }

  async function commit() {
    if (!batchId) return;
    setCommitting(true);
    setMessage(undefined);
    const response = await fetch(`/api/settings/legacy-import/${batchId}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = (await response.json()) as {
      result?: { agreements?: number; skipped?: number };
      error?: string;
    };
    setCommitting(false);
    if (!response.ok) return setMessage(body.error || "นำเข้า MOU ไม่สำเร็จ");
    setCommitted(true);
    setConfirmation("");
    setMessage(
      `นำเข้า MOU สำเร็จ ${body.result?.agreements?.toLocaleString() || 0} รายการ`,
    );
  }

  async function sendContacts(intent: "preview" | "stage") {
    if (!contactFile) return setContactMessage("เลือกไฟล์ Contact .xlsx ก่อน");
    setContactLoading(true);
    setContactMessage(undefined);
    const form = new FormData();
    form.set("file", contactFile);
    form.set("intent", intent);
    const response = await fetch("/api/settings/legacy-import/contacts", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as LegacyContactPreview & {
      preview?: LegacyContactPreview;
      batchId?: string;
      error?: string;
    };
    setContactLoading(false);
    if (!response.ok) {
      return setContactMessage(body.error || "ตรวจไฟล์ Contact ไม่สำเร็จ");
    }
    const nextPreview = body.preview || body;
    setContactPreview(nextPreview);
    if (body.batchId) {
      setContactBatchId(body.batchId);
      setContactMessage("สร้าง contact staging แล้ว ยังไม่ได้เขียนข้อมูลผู้ติดต่อจริง");
    }
  }

  async function commitContacts() {
    if (!contactBatchId) return;
    setContactLoading(true);
    setContactMessage(undefined);
    const response = await fetch(
      `/api/settings/legacy-import/${contactBatchId}/contacts/commit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: contactConfirmation }),
      },
    );
    const body = (await response.json()) as {
      result?: { contacts?: number };
      error?: string;
    };
    setContactLoading(false);
    if (!response.ok) {
      return setContactMessage(body.error || "นำเข้าผู้ติดต่อไม่สำเร็จ");
    }
    setContactsCommitted(true);
    setContactConfirmation("");
    setContactMessage(
      `นำเข้าผู้ติดต่อสำเร็จ ${body.result?.contacts?.toLocaleString() || 0} รายการ`,
    );
  }

  async function sendTravel(intent: "preview" | "stage") {
    if (!travelFile) return setTravelMessage("เลือกไฟล์รายงานการเดินทาง .xlsx ก่อน");
    setTravelLoading(true);
    setTravelMessage(undefined);
    const form = new FormData();
    form.set("file", travelFile);
    form.set("intent", intent);
    const response = await fetch("/api/settings/legacy-import/travel", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as LegacyTravelPreview & {
      preview?: LegacyTravelPreview;
      batchId?: string;
      error?: string;
    };
    setTravelLoading(false);
    if (!response.ok) {
      return setTravelMessage(body.error || "ตรวจรายงานการเดินทางไม่สำเร็จ");
    }
    setTravelPreview(body.preview || body);
    if (body.batchId) {
      setTravelBatchId(body.batchId);
      setTravelMessage("สร้าง travel staging แล้ว ยังไม่ได้เขียนข้อมูลการเดินทางจริง");
    }
  }

  async function commitTravel() {
    if (!travelBatchId) return;
    setTravelLoading(true);
    setTravelMessage(undefined);
    const response = await fetch(
      `/api/settings/legacy-import/${travelBatchId}/travel/commit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: travelConfirmation }),
      },
    );
    const body = (await response.json()) as {
      result?: { projects?: number; participants?: number };
      error?: string;
    };
    setTravelLoading(false);
    if (!response.ok) {
      return setTravelMessage(body.error || "นำเข้าการเดินทางไม่สำเร็จ");
    }
    setTravelCommitted(true);
    setTravelConfirmation("");
    setTravelMessage(
      `นำเข้าการเดินทาง ${body.result?.projects?.toLocaleString() || 0} โครงการ และผู้เดินทาง ${body.result?.participants?.toLocaleString() || 0} รายการ`,
    );
  }

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title="นำเข้าข้อมูลระบบเดิม"
      activePath="/settings/legacy-import"
    >
      <main className="module-main">
        <div className="module-page-heading">
          <div>
            <p className="text-xs font-semibold text-primary">ตั้งค่าระบบ · ย้ายข้อมูล</p>
            <h1>นำเข้าข้อมูลจาก iROUP เดิม</h1>
            <p>
              ดึงข้อมูลจาก public API เดิม ตรวจจับคู่กับ Data Master และสร้าง staging
              ก่อนเขียนข้อมูลจริงเสมอ
            </p>
          </div>
        </div>

        <section className="module-list-card mt-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mou-row-icon">
                <DatabaseBackup />
              </span>
              <div>
                <h2 className="text-lg font-semibold">MOU จากระบบเดิม</h2>
                <p className="text-sm text-muted-foreground">
                  แหล่งข้อมูล v2.public.mou.list · จับคู่ประเทศ หน่วยงาน
                  และองค์กรคู่ความร่วมมือกับ Data Master
                </p>
              </div>
            </div>
            <Button variant="outline" disabled={loading} onClick={() => void loadPreview()}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              ตรวจข้อมูลล่าสุด
            </Button>
          </div>

          {preview ? (
            <>
              <div className="mt-6 grid gap-px border bg-border md:grid-cols-5">
                <div className="bg-background p-4">
                  <strong className="text-2xl text-primary">{preview.total}</strong>
                  <p className="text-sm text-muted-foreground">ทั้งหมด</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-emerald-600">{preview.valid}</strong>
                  <p className="text-sm text-muted-foreground">พร้อมนำเข้า</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-destructive">{preview.invalid}</strong>
                  <p className="text-sm text-muted-foreground">ต้องแก้ mapping</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl">{preview.inserts}</strong>
                  <p className="text-sm text-muted-foreground">เพิ่มใหม่</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-amber-600">{preview.updates}</strong>
                  <p className="text-sm text-muted-foreground">อัปเดตเดิม</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!batchId ? (
                  <Button
                    disabled={loading || preview.invalid > 0}
                    onClick={() => void createStaging()}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
                    สร้าง staging
                  </Button>
                ) : (
                  <Badge variant="outline">staging {batchId}</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {preview.invalid > 0
                    ? "ยังไม่อนุญาตให้สร้าง staging จนกว่าจะแก้ mapping ครบ"
                    : "ข้อมูลผ่านการจับคู่ครบแล้ว"}
                </span>
              </div>

              {preview.invalid > 0 ? (
                <div className="mt-5 space-y-2">
                  {preview.rows
                    .filter((row) => row.status === "invalid")
                    .map((row) => (
                      <article className="rounded-md border border-destructive/30 p-4" key={row.sourceKey}>
                        <strong>{row.label || row.sourceKey}</strong>
                        <p className="text-sm text-destructive">{row.messages.join(" · ")}</p>
                      </article>
                    ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        {batchId && !committed ? (
          <section className="mt-6 border border-primary/25 bg-primary/5 p-5">
            <h2 className="font-semibold">ยืนยันเขียน MOU ลงฐานข้อมูล</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ขั้นนี้ upsert ตาม legacy ID ใน transaction เดียว และสามารถรันซ้ำได้โดยไม่สร้างรายการซ้ำ
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                className="w-64 bg-background"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="พิมพ์ IMPORT LEGACY MOU"
              />
              <Button
                disabled={confirmation !== "IMPORT LEGACY MOU" || committing}
                onClick={() => void commit()}
              >
                {committing ? <Loader2 className="animate-spin" /> : <Check />}
                นำเข้า MOU
              </Button>
            </div>
          </section>
        ) : null}

        {message ? (
          <p className={`mt-5 text-sm ${committed ? "text-emerald-700" : "text-primary"}`}>
            {message}
          </p>
        ) : null}

        <section className="module-list-card mt-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mou-row-icon">
                <ContactRound />
              </span>
              <div>
                <h2 className="text-lg font-semibold">ผู้ติดต่อองค์กรต่างประเทศ</h2>
                <p className="text-sm text-muted-foreground">
                  อัปโหลดไฟล์ Contact เดิม ตรวจชื่อองค์กรกับ Data Master
                  และเก็บเป็นข้อมูลภายในเท่านั้น
                </p>
              </div>
            </div>
            <Badge variant="outline">ข้อมูลภายใน</Badge>
          </div>
          <div className="mobility-import-file-actions mt-5">
            <label className="mobility-import-file-picker">
              <Upload /> เลือกไฟล์ Contact
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  setContactFile(event.target.files?.[0]);
                  setContactPreview(undefined);
                  setContactBatchId(undefined);
                  setContactMessage(undefined);
                  setContactsCommitted(false);
                }}
              />
            </label>
            <span
              className={
                contactFile
                  ? "mobility-import-file-name is-selected"
                  : "mobility-import-file-name"
              }
            >
              {contactFile?.name || "ยังไม่ได้เลือกไฟล์"}
            </span>
            <Button
              variant="outline"
              disabled={contactLoading || !contactFile}
              onClick={() => void sendContacts("preview")}
            >
              {contactLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              ตรวจไฟล์
            </Button>
          </div>

          {contactPreview ? (
            <>
              <div className="mt-6 grid gap-px border bg-border md:grid-cols-5">
                <div className="bg-background p-4">
                  <strong className="text-2xl text-primary">{contactPreview.total}</strong>
                  <p className="text-sm text-muted-foreground">ทั้งหมด</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-emerald-600">
                    {contactPreview.valid}
                  </strong>
                  <p className="text-sm text-muted-foreground">ผ่านตรวจ</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-amber-600">
                    {contactPreview.warning}
                  </strong>
                  <p className="text-sm text-muted-foreground">มีคำเตือน</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-destructive">
                    {contactPreview.invalid}
                  </strong>
                  <p className="text-sm text-muted-foreground">ต้องแก้</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl">
                    {contactPreview.inserts + contactPreview.updates}
                  </strong>
                  <p className="text-sm text-muted-foreground">พร้อม upsert</p>
                </div>
              </div>
              {!contactBatchId ? (
                <Button
                  className="mt-5"
                  disabled={contactLoading || contactPreview.invalid > 0}
                  onClick={() => void sendContacts("stage")}
                >
                  <FileCheck2 /> สร้าง contact staging
                </Button>
              ) : (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Input
                    className="w-60"
                    value={contactConfirmation}
                    onChange={(event) => setContactConfirmation(event.target.value)}
                    placeholder="พิมพ์ IMPORT CONTACTS"
                  />
                  <Button
                    disabled={
                      contactsCommitted ||
                      contactLoading ||
                      contactConfirmation !== "IMPORT CONTACTS"
                    }
                    onClick={() => void commitContacts()}
                  >
                    {contactLoading ? <Loader2 className="animate-spin" /> : <Check />}
                    นำเข้าผู้ติดต่อ
                  </Button>
                </div>
              )}
            </>
          ) : null}
          {contactMessage ? (
            <p
              className={`mt-4 text-sm ${
                contactsCommitted ? "text-emerald-700" : "text-primary"
              }`}
            >
              {contactMessage}
            </p>
          ) : null}
        </section>

        <section className="module-list-card mt-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mou-row-icon">
                <PlaneTakeoff />
              </span>
              <div>
                <h2 className="text-lg font-semibold">การเดินทางไปปฏิบัติงานเดิม</h2>
                <p className="text-sm text-muted-foreground">
                  ใช้ public API เดิมสำหรับช่วงไป–กลับ 234 โครงการ
                  และใช้ไฟล์รายงานสำหรับรายชื่อผู้เดินทาง 407 แถว
                </p>
              </div>
            </div>
          </div>
          <div className="mobility-import-file-actions mt-5">
            <label className="mobility-import-file-picker">
              <Upload /> เลือกไฟล์รายงานการเดินทาง
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  setTravelFile(event.target.files?.[0]);
                  setTravelPreview(undefined);
                  setTravelBatchId(undefined);
                  setTravelMessage(undefined);
                  setTravelCommitted(false);
                }}
              />
            </label>
            <span
              className={
                travelFile
                  ? "mobility-import-file-name is-selected"
                  : "mobility-import-file-name"
              }
            >
              {travelFile?.name || "ยังไม่ได้เลือกไฟล์"}
            </span>
            <Button
              variant="outline"
              disabled={travelLoading || !travelFile}
              onClick={() => void sendTravel("preview")}
            >
              {travelLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              ตรวจรายงาน
            </Button>
          </div>

          {travelPreview ? (
            <>
              <div className="mt-6 grid gap-px border bg-border md:grid-cols-5">
                <div className="bg-background p-4">
                  <strong className="text-2xl text-primary">
                    {travelPreview.total}
                  </strong>
                  <p className="text-sm text-muted-foreground">โครงการ</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl">
                    {travelPreview.participants}
                  </strong>
                  <p className="text-sm text-muted-foreground">ผู้เดินทาง</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-emerald-600">
                    {travelPreview.linkedParticipants}
                  </strong>
                  <p className="text-sm text-muted-foreground">เชื่อม Data Master</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-amber-600">
                    {travelPreview.warning}
                  </strong>
                  <p className="text-sm text-muted-foreground">เก็บชื่อ snapshot</p>
                </div>
                <div className="bg-background p-4">
                  <strong className="text-2xl text-destructive">
                    {travelPreview.invalid}
                  </strong>
                  <p className="text-sm text-muted-foreground">ต้องแก้</p>
                </div>
              </div>
              {!travelBatchId ? (
                <Button
                  className="mt-5"
                  disabled={travelLoading || travelPreview.invalid > 0}
                  onClick={() => void sendTravel("stage")}
                >
                  <FileCheck2 /> สร้าง travel staging
                </Button>
              ) : (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Input
                    className="w-60"
                    value={travelConfirmation}
                    onChange={(event) => setTravelConfirmation(event.target.value)}
                    placeholder="พิมพ์ IMPORT TRAVEL"
                  />
                  <Button
                    disabled={
                      travelCommitted ||
                      travelLoading ||
                      travelConfirmation !== "IMPORT TRAVEL"
                    }
                    onClick={() => void commitTravel()}
                  >
                    {travelLoading ? <Loader2 className="animate-spin" /> : <Check />}
                    นำเข้าการเดินทาง
                  </Button>
                </div>
              )}
            </>
          ) : null}
          {travelMessage ? (
            <p
              className={`mt-4 text-sm ${
                travelCommitted ? "text-emerald-700" : "text-primary"
              }`}
            >
              {travelMessage}
            </p>
          ) : null}
        </section>
      </main>
    </WorkspaceChrome>
  );
}
