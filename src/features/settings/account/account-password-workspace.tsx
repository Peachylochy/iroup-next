"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type AuthActionState,
  changePasswordAction,
} from "@/features/auth/actions";
import type { CurrentUserAccess } from "@/lib/auth/access";

const initialState: AuthActionState = { message: "" };

type PasswordFieldProps = {
  name: "currentPassword" | "newPassword" | "confirmPassword";
  label: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  placeholder: string;
};

function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
  placeholder,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <span className="relative">
        <Input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          placeholder={placeholder}
          required
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `ซ่อน${label}` : `แสดง${label}`}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

type AccountPasswordWorkspaceProps = {
  access: CurrentUserAccess;
  viewer: {
    displayName: string;
    email: string;
    role: string;
  };
};

export function AccountPasswordWorkspace({
  access,
  viewer,
}: AccountPasswordWorkspaceProps) {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <WorkspaceChrome access={access} viewer={viewer} title="บัญชีผู้ใช้งาน">
      <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8">
        <div className="mb-7">
          <p className="mb-1 text-sm font-semibold text-primary">ตั้งค่าบัญชี</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            เปลี่ยนรหัสผ่าน
          </h1>
          <p className="mt-2 text-muted-foreground">
            ใช้รหัสผ่านปัจจุบันยืนยันตัวตนก่อนตั้งรหัสผ่านใหม่
          </p>
        </div>

        <Card className="max-w-xl">
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <CardTitle>ตั้งรหัสผ่านใหม่</CardTitle>
            <CardDescription>
              บัญชีที่กำลังใช้งาน: {viewer.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="grid gap-5">
              <PasswordField
                name="currentPassword"
                label="รหัสผ่านปัจจุบัน"
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่านปัจจุบัน"
              />
              <PasswordField
                name="newPassword"
                label="รหัสผ่านใหม่"
                autoComplete="new-password"
                minLength={8}
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />
              <PasswordField
                name="confirmPassword"
                label="ยืนยันรหัสผ่านใหม่"
                autoComplete="new-password"
                minLength={8}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              />

              <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                <span className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร และต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน
                </span>
              </div>

              {state.message ? (
                <p
                  role="status"
                  className={
                    state.success
                      ? "rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                      : "rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                  }
                >
                  {state.message}
                </p>
              ) : null}

              <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
                {pending ? "กำลังเปลี่ยนรหัสผ่าน…" : "บันทึกรหัสผ่านใหม่"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </WorkspaceChrome>
  );
}
