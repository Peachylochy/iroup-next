"use client";

import { useState, useTransition } from "react";
import { Check, CirclePlay, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { transitionStudentMobility, type MobilityTransition } from "./actions";

type WorkflowStatus = "draft" | "under_review" | "approved" | "active" | "completed" | "cancelled" | "archived";

const definitions: Partial<Record<WorkflowStatus, Array<{ transition: MobilityTransition; label: string; icon: typeof Check; needsPublish?: boolean; variant?: "outline" | "default" }>>> = {
  under_review: [
    { transition: "return_to_draft", label: "ส่งกลับแก้ไข", icon: RotateCcw, needsPublish: true, variant: "outline" },
    { transition: "approve", label: "อนุมัติ", icon: Check, needsPublish: true },
  ],
  approved: [{ transition: "activate", label: "เริ่มโครงการ", icon: CirclePlay }],
  active: [{ transition: "complete", label: "ปิดโครงการ", icon: Check }],
};

export function MobilityWorkflowActions({
  id,
  updatedAt,
  workflowStatus,
  access,
}: {
  id: string;
  updatedAt: string;
  workflowStatus: WorkflowStatus;
  access: CurrentUserAccess;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const actions = (definitions[workflowStatus] || []).filter((action) =>
    action.needsPublish ? access.modules.mobility?.publish : access.modules.mobility?.update,
  );

  if (!actions.length) return null;

  function run(transition: MobilityTransition) {
    const returnNote = transition === "return_to_draft"
      ? window.prompt("ระบุเหตุผลที่ส่งกลับแก้ไข (ถ้ามี)") || ""
      : "";
    setError(undefined);
    startTransition(async () => {
      const result = await transitionStudentMobility(id, updatedAt, transition, returnNote);
      if (result.error) setError(result.error);
    });
  }

  return <div className="flex flex-col items-end gap-2">
    <div className="flex flex-wrap justify-end gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return <Button key={action.transition} type="button" variant={action.variant} disabled={isPending} onClick={() => run(action.transition)}>
          <Icon />{isPending ? "กำลังบันทึก..." : action.label}
        </Button>;
      })}
    </div>
    {error ? <p className="text-xs text-destructive max-w-sm text-right">{error}</p> : null}
  </div>;
}
