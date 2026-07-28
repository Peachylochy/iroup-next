"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { saveMovementCaseAction } from "./actions";
import type { MobilityFormOptions, MovementCase } from "./mobility-query";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: MobilityFormOptions;
  editingCase?: MovementCase | null;
};

export function MobilityFormDialog({ open, onOpenChange, options, editingCase }: Props) {
  const [formState, formAction, pending] = useActionState(saveMovementCaseAction, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editingCase ? "แก้ไขรายการ Mobility / การเดินทาง" : "บันทึกรายการ Mobility / การเดินทางใหม่"}
          </DialogTitle>
          <DialogDescription>
            กรอกข้อมูลโครงการแลกเปลี่ยนนิสิต บุคลากร หรือการเดินทางไปปฏิบัติงานต่างประเทศ
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 text-xs pt-2">
          {editingCase && <input type="hidden" name="id" value={editingCase.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium">หมวดหมู่รายการ <span className="text-red-500">*</span></label>
              <select
                name="category"
                defaultValue={editingCase?.category || "student_exchange"}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                <option value="student_exchange">Mobility นิสิต (Student Exchange)</option>
                <option value="staff_exchange">Mobility บุคลากร (Staff Exchange)</option>
                <option value="staff_official_travel">เดินทางไปปฏิบัติงาน (Official Travel)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">ทิศทางการเดินทาง <span className="text-red-500">*</span></label>
              <select
                name="direction"
                defaultValue={editingCase?.direction || "outbound"}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                <option value="outbound">Outbound (ส่งไปต่างประเทศ)</option>
                <option value="inbound">Inbound (รับเข้ามา ม.พะเยา)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium">ชื่อโครงการ/รายการเดินทาง (ภาษาไทย) <span className="text-red-500">*</span></label>
            <Input
              name="title_th"
              defaultValue={editingCase?.title_th || ""}
              placeholder="e.g. โครงการแลกเปลี่ยนนิสิตภาคฤดูร้อน ณ มหาวิทยาลัยโจไซ"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium">ชื่อโครงการ (ภาษาอังกฤษ)</label>
            <Input
              name="title_en"
              defaultValue={editingCase?.title_en || ""}
              placeholder="e.g. Summer Student Exchange Program at Josai University"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium">มหาวิทยาลัย/องค์กรต่างประเทศคู่สัญญา</label>
              <select
                name="partner_organization_id"
                defaultValue={editingCase?.partner_organization_id || ""}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                <option value="">-- เลือกมหาวิทยาลัยคู่สัญญา --</option>
                {options.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_th || p.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">คณะ/หน่วยงาน ม.พะเยา ที่รับผิดชอบ</label>
              <select
                name="owner_unit_id"
                defaultValue={editingCase?.owner_unit_id || ""}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                <option value="">-- เลือกคณะ/หน่วยงาน --</option>
                {options.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name_th} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-medium">ประเภทกิจกรรม</label>
              <Input
                name="activity_type"
                defaultValue={editingCase?.activity_type || ""}
                placeholder="e.g. แลกเปลี่ยนเรียนรู้ / ฝึกงาน"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium">วันที่เริ่มต้น</label>
              <Input
                type="date"
                name="start_date"
                defaultValue={editingCase?.start_date || ""}
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium">วันที่สิ้นสุด</label>
              <Input
                type="date"
                name="end_date"
                defaultValue={editingCase?.end_date || ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium">จำนวนผู้เดินทาง (คน)</label>
              <Input
                type="number"
                name="participants_count"
                min={1}
                defaultValue={editingCase?.movement_participants?.length || 1}
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium">วงเงินงบประมาณ/ทุนสนับสนุน (บาท)</label>
              <Input
                type="number"
                name="funding_amount"
                min={0}
                placeholder="e.g. 50000"
                defaultValue={editingCase?.movement_funding?.[0]?.amount || ""}
              />
            </div>
          </div>

          {formState?.error && (
            <p className="text-red-600 bg-red-50 p-2 rounded text-xs">{formState.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "บันทึกรายการ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
