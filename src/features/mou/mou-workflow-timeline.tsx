import { CheckCircle2, Clock, FileText, RotateCcw, AlertTriangle, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkflowEvent = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string;
  } | null;
};

type Props = {
  events: WorkflowEvent[];
};

function getActionBadge(action: string) {
  switch (action) {
    case "created":
    case "saved_draft":
      return {
        label: "บันทึกร่าง",
        color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
        icon: FileText,
      };
    case "submitted_for_review":
      return {
        label: "ส่งตรวจสอบ",
        color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        icon: Clock,
      };
    case "returned_to_draft":
      return {
        label: "ส่งกลับไปแก้ไข",
        color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
        icon: RotateCcw,
      };
    case "published":
      return {
        label: "อนุมัติและเผยแพร่",
        color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        icon: CheckCircle2,
      };
    case "archived":
    case "terminated":
      return {
        label: "สิ้นสุด/เก็บเข้าคลัง",
        color: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800",
        icon: AlertTriangle,
      };
    default:
      return {
        label: action,
        color: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800",
        icon: AlertTriangle,
      };
  }
}

export function MouWorkflowTimeline({ events }: Props) {
  if (events.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          ประวัติการดำเนินการ (Workflow Events)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {events.map((evt) => {
            const badge = getActionBadge(evt.action);
            const Icon = badge.icon;
            const actorName = evt.profiles?.display_name || evt.profiles?.email || "ผู้ใช้งานระบบ";

            return (
              <div key={evt.id} className="relative group">
                <div className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-border">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(evt.created_at).toLocaleString("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  <div className="text-xs flex items-center gap-1.5 text-muted-foreground mt-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{actorName}</span>
                  </div>

                  {evt.note && (
                    <div className="mt-2 text-xs rounded-md bg-muted/50 p-2.5 text-foreground border border-border/40">
                      <span className="font-semibold">หมายเหตุ: </span>
                      {evt.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
