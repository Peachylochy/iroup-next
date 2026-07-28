"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Globe,
  Landmark,
  ShieldCheck,
  Tag,
  AlertTriangle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrentUserAccess } from "@/lib/auth/access";
import { MouAttachmentsCard } from "./mou-attachments-card";
import { MouDetailActions } from "./mou-detail-actions";
import { MouWorkflowTimeline } from "./mou-workflow-timeline";
import { MouDetail } from "./mou-query";

type Props = {
  mou: MouDetail;
  access: CurrentUserAccess;
};

function getWorkflowStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">ร่างระบบ (Draft)</Badge>;
    case "under_review":
      return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">รอตรวจสอบ (Under Review)</Badge>;
    case "approved":
    case "active":
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300">มีผลบังคับใช้ (Active)</Badge>;
    case "archived":
      return <Badge variant="outline" className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">เก็บเข้าคลัง (Archived)</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getVerificationBadge(status: string) {
  switch (status) {
    case "verified":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-600" /> ยืนยันแล้ว
        </Badge>
      );
    case "pending_verification":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1">
          <Clock className="w-3 h-3 text-amber-600" /> รอตรวจสอบ
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

export function MouDetailView({ mou, access }: Props) {
  const isDeleted = mou.deleted_at !== null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              href="/mou"
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "p-0 h-auto font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1",
              })}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> รายการ MOU
            </Link>
            <span>/</span>
            <span className="truncate max-w-[200px]">{mou.agreement_number || "ไม่ระบุเลขที่"}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {mou.title_th}
          </h1>
          {mou.title_en && (
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">{mou.title_en}</p>
          )}
        </div>

        {/* Action Bar */}
        <MouDetailActions mou={mou} access={access} />
      </div>

      {/* Deleted Banner */}
      {isDeleted && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-destructive flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">MOU ฉบับนี้ถูกลบแล้ว (Soft Deleted)</p>
            <p className="text-xs opacity-90">
              เมื่อวันที่ {new Date(mou.deleted_at!).toLocaleDateString("th-TH")} — System Admin สามารถกดคืนค่า MOU กลับมาได้
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Overview, Partners, Units, Files */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Info Card */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                ข้อมูลทั่วไป (General Details)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">เลขที่ข้อตกลง (MOU No.)</span>
                <span className="font-semibold">{mou.agreement_number || "-"}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">ประเภทข้อตกลง</span>
                <span className="font-medium">{mou.agreement_type || "MOU"}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">สถานะการตรวจสอบ</span>
                <div>{getWorkflowStatusBadge(mou.workflow_status)}</div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">ปีงบประมาณไทย</span>
                <span className="font-medium">ปีงบประมาณ {mou.fiscal_year || "-"}</span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">วันลงนาม (Sign Date)</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {mou.signed_date
                    ? new Date(mou.signed_date).toLocaleDateString("th-TH", { dateStyle: "medium" })
                    : "ไม่ระบุ"}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">ระยะเวลาบังคับใช้</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {mou.start_date
                    ? `${new Date(mou.start_date).toLocaleDateString("th-TH")} ถึง ${
                        mou.end_date
                          ? new Date(mou.end_date).toLocaleDateString("th-TH")
                          : "ไม่มีวันหมดอายุ"
                      }`
                    : "ไม่ระบุ"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Partner Organizations Card */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                องค์กรคู่ความร่วมมือ (Partner Organizations)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mou.agreement_partners.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่มีองค์กรคู่สัญญา</p>
              ) : (
                <div className="space-y-3">
                  {mou.agreement_partners.map((partner) => {
                    const org = partner.partner_organizations;
                    const nameTh = partner.partner_name_th_snapshot || org?.name_th;
                    const nameEn = partner.partner_name_en_snapshot || org?.name_en || "Partner Org";
                    const countryTh = partner.country_name_th_snapshot || org?.countries?.name_th;

                    return (
                      <div
                        key={partner.partner_organization_id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{nameEn}</span>
                            {partner.is_lead && (
                              <Badge className="bg-primary text-primary-foreground text-[10px]">
                                องค์กรหลัก (Lead Partner)
                              </Badge>
                            )}
                          </div>
                          {nameTh && <p className="text-xs text-muted-foreground">{nameTh}</p>}
                          {countryTh && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Landmark className="w-3 h-3" /> ประเทศ: {countryTh}
                            </p>
                          )}
                        </div>

                        {org && <div>{getVerificationBadge(org.verification_status)}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* UP Faculty / Units Card */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                หน่วยงาน ม.พะเยา (University Units)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mou.agreement_units.length === 0 ? (
                <p className="text-xs text-muted-foreground">ยังไม่ได้ระบุหน่วยงานรับผิดชอบ</p>
              ) : (
                <div className="space-y-2.5">
                  {mou.agreement_units.map((unit) => {
                    const orgUnit = unit.organization_units;
                    return (
                      <div
                        key={unit.organization_unit_id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {orgUnit?.name_th || "หน่วยงาน ม.พะเยา"}
                            </span>
                            {unit.is_owner && (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                เจ้าของหลัก (Owner Unit)
                              </Badge>
                            )}
                          </div>
                          {orgUnit?.name_en && (
                            <p className="text-xs text-muted-foreground">{orgUnit.name_en}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Attachments Card */}
          <MouAttachmentsCard
            agreementId={mou.id}
            attachments={mou.record_assets}
            access={access}
            isDeleted={isDeleted}
          />
        </div>

        {/* Right 1 Column: Internal Notes & Timeline */}
        <div className="space-y-6">
          {/* Internal Notes Card */}
          {mou.internal_note && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">บันทึกภายใน (Internal Note)</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {mou.internal_note}
              </CardContent>
            </Card>
          )}

          {/* Workflow Timeline Card */}
          <MouWorkflowTimeline events={mou.agreement_workflow_events} />
        </div>
      </div>
    </div>
  );
}
