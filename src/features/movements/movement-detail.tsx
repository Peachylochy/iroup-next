"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Pencil,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { transitionStaffMovement } from "./actions";
import {
  staffMovementModules,
  type StaffMovementModule,
} from "./config";
import type { StaffMovementRecord } from "./movement-query";

const statusLabel = {
  draft: "ร่าง",
  under_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  active: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  archived: "เก็บถาวร",
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(value))
    : "ยังไม่ระบุ";

export function StaffMovementDetail({
  module,
  movement,
  access,
}: {
  module: StaffMovementModule;
  movement: StaffMovementRecord;
  access: CurrentUserAccess;
}) {
  const config = staffMovementModules[module];
  const permission = access.modules[config.permission];
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (
    action: "return_to_draft" | "approve" | "activate" | "complete",
  ) =>
    startTransition(async () => {
      const result = await transitionStaffMovement(
        module,
        movement.id,
        movement.updated_at,
        action,
        note,
      );
      if (result.error) setError(result.error);
      else window.location.reload();
    });

  return (
    <main className="module-main mou-form-page">
      <div className="module-page-heading">
        <div>
          <Link className="back-link" href={config.route}>
            <ArrowLeft /> กลับไปรายการ{config.title}
          </Link>
          <p className="module-eyebrow">{config.title}</p>
          <h1>{movement.project_name}</h1>
          <p>{movement.purpose || "ยังไม่มีรายละเอียดวัตถุประสงค์"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="mou-status">
            {statusLabel[movement.workflow_status]}
          </Badge>
          {movement.workflow_status === "draft" && permission.update ? (
            <Link
              className={cn(buttonVariants({ variant: "outline" }))}
              href={`${config.route}/${movement.id}/edit`}
            >
              <Pencil /> แก้ไข
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mou-form-section">
        <div className="mou-form-section-heading">
          <span>1</span>
          <div>
            <h2>ข้อมูลการเดินทาง</h2>
            <p>ข้อมูลอ้างอิงจากรายการและ Data Master</p>
          </div>
        </div>
        <div className="mou-detail-grid">
          <div>
            <small>
              <MapPin /> ประเทศและเมือง
            </small>
            <strong>
              {movement.country_name_snapshot ||
                movement.countries?.name_th ||
                "ยังไม่ระบุ"}
              {movement.city ? ` · ${movement.city}` : ""}
            </strong>
          </div>
          <div>
            <small>องค์กรปลายทาง</small>
            <strong>
              {movement.partner_name_snapshot ||
                movement.partner_organizations?.name_th ||
                movement.partner_organizations?.name_en ||
                "ยังไม่ระบุ"}
            </strong>
          </div>
          <div>
            <small>หน่วยงานเจ้าของ</small>
            <strong>{movement.organization_units?.name_th || "ยังไม่ระบุ"}</strong>
          </div>
          <div>
            <small>
              <CalendarDays /> ระยะเวลา
            </small>
            <strong>
              {date(movement.start_date)} – {date(movement.end_date)}
            </strong>
          </div>
          <div>
            <small>ประเภทกิจกรรม</small>
            <strong>{movement.activity_type || "ยังไม่ระบุ"}</strong>
          </div>
          <div>
            <small>เลขอ้างอิงอนุมัติ</small>
            <strong>{movement.approval_reference || "ยังไม่ระบุ"}</strong>
          </div>
        </div>
      </section>

      <section className="mou-form-section">
        <div className="mou-form-section-heading">
          <span>2</span>
          <div>
            <h2>
              <UsersRound /> ผู้เดินทาง
            </h2>
            <p>{movement.participant_count} คน</p>
          </div>
        </div>
        {movement.movement_participants.length ? (
          <div className="mou-list">
            {movement.movement_participants.map((participant) => (
              <article className="mou-row movement-participant-row" key={participant.id}>
                <div className="mou-row-main">
                  <div className="mou-row-title">
                    <strong>{participant.full_name_snapshot}</strong>
                    <small>
                      {participant.position_snapshot ||
                        participant.participant_role ||
                        "ผู้เดินทาง"}
                    </small>
                  </div>
                  <p>
                    {participant.organization_unit_name_snapshot ||
                      "ไม่ระบุหน่วยงาน"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>ยังไม่มีผู้เดินทาง</p>
        )}
      </section>

      <section className="mou-form-section">
        <div className="mou-form-section-heading">
          <span>3</span>
          <div>
            <h2>
              <WalletCards /> งบประมาณ
            </h2>
            <p>รายละเอียดแหล่งงบประมาณของรายการ</p>
          </div>
        </div>
        {movement.movement_funding.length ? (
          <div className="mou-list">
            {movement.movement_funding.map((item) => (
              <article className="mou-row" key={item.id}>
                <div className="mou-row-main">
                  <div className="mou-row-title">
                    <strong>{item.budget_type}</strong>
                    <small>{item.source_name || "ไม่ระบุแหล่งงบ"}</small>
                  </div>
                </div>
                <strong>
                  {item.amount == null
                    ? "ไม่ระบุจำนวน"
                    : `${new Intl.NumberFormat("th-TH").format(item.amount)} ${item.currency}`}
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <p>ไม่มีข้อมูลใช้งบประมาณ</p>
        )}
      </section>

      {movement.workflow_status === "under_review" && permission.update ? (
        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>4</span>
            <div>
              <h2>ตรวจสอบและอนุมัติ</h2>
              <p>อนุมัติ หรือส่งกลับให้ผู้บันทึกแก้ไขพร้อมเหตุผล</p>
            </div>
          </div>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="เหตุผลเมื่อส่งกลับแก้ไข"
          />
          <div className="mou-form-actions">
            <Button
              variant="outline"
              disabled={pending || !note.trim()}
              onClick={() => run("return_to_draft")}
            >
              ส่งกลับแก้ไข
            </Button>
            {permission.publish ? (
              <Button disabled={pending} onClick={() => run("approve")}>
                <CheckCircle2 /> อนุมัติ
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
      {movement.workflow_status === "approved" && permission.update ? (
        <div className="mou-form-actions">
          <Button disabled={pending} onClick={() => run("activate")}>
            เริ่มดำเนินการ
          </Button>
        </div>
      ) : null}
      {movement.workflow_status === "active" && permission.update ? (
        <div className="mou-form-actions">
          <Button disabled={pending} onClick={() => run("complete")}>
            บันทึกว่าเสร็จสิ้น
          </Button>
        </div>
      ) : null}
      {error ? <p className="mou-form-message is-error">{error}</p> : null}
    </main>
  );
}
