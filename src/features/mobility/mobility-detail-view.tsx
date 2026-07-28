"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ChevronLeft,
  Coins,
  GraduationCap,
  Trash2,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentUserAccess } from "@/lib/auth/access";

import { deleteMovementCaseAction } from "./actions";
import { MobilityFormDialog } from "./mobility-form-dialog";
import type { MobilityFormOptions, MovementCase } from "./mobility-query";

type Props = {
  access: CurrentUserAccess;
  movementCase: MovementCase;
  options: MobilityFormOptions;
  viewer: { displayName: string; email: string; role: string };
};

const categoryMap = {
  student_exchange: { label: "Mobility นิสิต", icon: GraduationCap },
  staff_exchange: { label: "Mobility บุคลากร", icon: UsersRound },
  staff_official_travel: { label: "เดินทางไปปฏิบัติงาน", icon: BriefcaseBusiness },
};

export function MobilityDetailView({ access, movementCase, options, viewer }: Props) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const canUpdate = Boolean(access.modules.mobility?.update || access.modules.mou?.update);
  const canDelete = Boolean(access.modules.mobility?.delete || access.modules.mou?.delete);

  const catInfo = categoryMap[movementCase.category];
  const CatIcon = catInfo.icon;
  const partner = movementCase.partner_organizations;
  const unit = movementCase.organization_units;
  const country = partner?.countries?.[0];

  const handleDelete = () => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
      startDeleteTransition(async () => {
        const res = await deleteMovementCaseAction(movementCase.id);
        if (res.success) {
          router.push("/mobility");
        } else {
          alert(res.error || "เกิดข้อผิดพลาดในการลบรายการ");
        }
      });
    }
  };

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title={movementCase.title_th}
      activePath="/mobility"
    >
      <main className="module-main space-y-6">
        {/* Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/mobility"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} /> กลับไปหน้ารายการ Mobility / การเดินทาง
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CatIcon className="text-primary w-6 h-6" />
              {movementCase.title_th}
            </h1>
            {movementCase.title_en && <p className="text-sm text-muted-foreground">{movementCase.title_en}</p>}
          </div>

          <div className="flex items-center gap-2">
            {canUpdate && (
              <Button size="sm" variant="outline" onClick={() => setEditDialogOpen(true)}>
                แก้ไขรายการ
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                <Trash2 size={14} /> ลบ
              </Button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <Card className="border-border/60">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <CatIcon size={13} /> {catInfo.label}
                </Badge>
                {movementCase.direction === "inbound" ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs gap-1 border-emerald-200">
                    <ArrowDownLeft size={13} /> Inbound (รับเข้า ม.พะเยา)
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-xs gap-1 border-blue-200">
                    <ArrowUpRight size={13} /> Outbound (ส่งไปต่างประเทศ)
                  </Badge>
                )}
                {movementCase.activity_type && (
                  <Badge variant="secondary" className="text-xs">
                    {movementCase.activity_type}
                  </Badge>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground pt-2">
                {partner && (
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <Building2 size={14} className="text-primary" />
                    มหาวิทยาลัยคู่สัญญา: {partner.name_th || partner.name_en}
                    {country && <span className="text-muted-foreground">({country.name_th || country.name_en})</span>}
                  </p>
                )}
                {unit && (
                  <p className="flex items-center gap-1.5">
                    คณะ/หน่วยงาน ม.พะเยา เจ้าของเรื่อง: <strong className="text-foreground">{unit.name_th}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-2 border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar size={13} /> กำหนดการเดินทาง:
                </span>
                <span className="font-semibold text-foreground">
                  {[movementCase.start_date, movementCase.end_date].filter(Boolean).join(" ถึง ") || "ไม่ระบุ"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users size={13} /> จำนวนผู้เดินทาง:
                </span>
                <span className="font-semibold text-foreground">
                  {movementCase.movement_participants?.length || 1} คน
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Coins size={13} /> วงเงินงบประมาณ:
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {movementCase.movement_funding?.[0]?.amount
                    ? `${movementCase.movement_funding[0].amount.toLocaleString()} บาท`
                    : "ไม่มีงบประมาณ/ทุนสนับสนุน"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participants & Funding Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> รายชื่อผู้เดินทาง / ผู้เข้าร่วมโครงการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movementCase.movement_participants?.length ? (
                <div className="divide-y divide-border/40 text-xs">
                  {movementCase.movement_participants.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <UserCheck size={13} className="text-primary" /> {p.full_name_snapshot}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {p.participant_role || "ผู้เข้าร่วม"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">ไม่พบรายชื่อผู้เดินทางแยกบุคคล</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" /> แหล่งเงินทุน / งบประมาณสนับสนุน
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movementCase.movement_funding?.length ? (
                <div className="divide-y divide-border/40 text-xs">
                  {movementCase.movement_funding.map((f) => (
                    <div key={f.id} className="py-2.5 flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {f.budget_types?.name_th || "งบประมาณสนับสนุน"}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {f.amount.toLocaleString()} {f.currency}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">ไม่พบข้อมูลการจัดสรรงบประมาณ</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <MobilityFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        options={options}
        editingCase={movementCase}
      />
    </WorkspaceChrome>
  );
}
