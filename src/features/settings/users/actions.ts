"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  appRoles,
  moduleKeys,
  type ModulePermission,
} from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

export type SaveUserAccessState = {
  message: string;
  success?: boolean;
};

const saveAccessSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.enum(appRoles), z.literal("")]),
  active: z.enum(["true", "false"]),
  permissions: z.string(),
});

function parsePermissions(raw: string) {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("รูปแบบสิทธิ์ไม่ถูกต้อง");
  }

  const source = parsed as Record<string, unknown>;
  return Object.fromEntries(
    moduleKeys.map((module) => {
      const candidate =
        source[module] && typeof source[module] === "object"
          ? (source[module] as Partial<ModulePermission>)
          : {};
      return [
        module,
        {
          view: candidate.view === true,
          create: candidate.create === true,
          update: candidate.update === true,
          publish: candidate.publish === true,
          delete: candidate.delete === true,
          import: candidate.import === true,
        },
      ];
    }),
  );
}

export async function saveUserAccessAction(
  _previousState: SaveUserAccessState,
  formData: FormData,
): Promise<SaveUserAccessState> {
  const parsed = saveAccessSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    active: formData.get("active"),
    permissions: formData.get("permissions"),
  });

  if (!parsed.success) {
    return { message: "ข้อมูลสิทธิ์ไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง" };
  }

  let permissions: ReturnType<typeof parsePermissions>;
  try {
    permissions = parsePermissions(parsed.data.permissions);
  } catch {
    return { message: "รูปแบบสิทธิ์ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_access", {
    p_target_user_id: parsed.data.userId,
    p_target_role: parsed.data.role || null,
    p_active: parsed.data.active === "true",
    p_permissions: permissions,
  });

  if (error) {
    const knownMessage: Record<string, string> = {
      "You cannot remove your own system administrator access.":
        "ไม่สามารถลดสิทธิ์หรือปิดบัญชีผู้ดูแลระบบของตัวเองได้",
      "At least one active system administrator is required.":
        "ระบบต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน",
    };
    return {
      message:
        knownMessage[error.message] ??
        "บันทึกสิทธิ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }

  revalidatePath("/settings/users");
  revalidatePath("/");
  return { message: "บันทึกสิทธิ์เรียบร้อยแล้ว", success: true };
}

