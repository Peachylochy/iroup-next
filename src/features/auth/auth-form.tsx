"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  type AuthActionState,
  signInAction,
  signUpAction,
} from "./actions";

const initialState: AuthActionState = { message: "" };

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    initialState,
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpAction,
    initialState,
  );
  const state = mode === "signin" ? signInState : signUpState;
  const pending = mode === "signin" ? signInPending : signUpPending;

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="brand-mark" aria-hidden="true">
          iR
        </span>
        <span>
          <strong>iROUP Portal</strong>
          <small>มหาวิทยาลัยพะเยา</small>
        </span>
      </div>

      <div className="auth-heading">
        <h1>{mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชีเจ้าหน้าที่"}</h1>
        <p>
          {mode === "signin"
            ? "เข้าสู่พื้นที่ทำงานฝ่ายวิเทศสัมพันธ์"
            : "บัญชีใหม่จะยังใช้งานไม่ได้จนกว่าผู้ดูแลจะอนุมัติสิทธิ์"}
        </p>
      </div>

      <div className="auth-tabs" aria-label="เลือกประเภทแบบฟอร์ม">
        <button
          type="button"
          className={mode === "signin" ? "active" : undefined}
          aria-pressed={mode === "signin"}
          onClick={() => setMode("signin")}
        >
          เข้าสู่ระบบ
        </button>
        <button
          type="button"
          className={mode === "signup" ? "active" : undefined}
          aria-pressed={mode === "signup"}
          onClick={() => setMode("signup")}
        >
          สร้างบัญชี
        </button>
      </div>

      <form
        className="auth-form"
        action={mode === "signin" ? signInFormAction : signUpFormAction}
      >
        {mode === "signup" ? (
          <label>
            <span>ชื่อที่แสดงในระบบ</span>
            <span className="auth-field">
              <UserRound aria-hidden="true" />
              <Input
                name="displayName"
                autoComplete="name"
                placeholder="ชื่อ–นามสกุล"
                required
              />
            </span>
          </label>
        ) : null}

        <label>
          <span>อีเมล</span>
          <span className="auth-field">
            <Mail aria-hidden="true" />
            <Input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@up.ac.th"
              required
            />
          </span>
        </label>

        <label>
          <span>รหัสผ่าน</span>
          <span className="auth-field">
            <LockKeyhole aria-hidden="true" />
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signin" ? "รหัสผ่าน" : "อย่างน้อย 8 ตัวอักษร"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </span>
        </label>

        {state.message ? (
          <p
            className={state.success ? "auth-message success" : "auth-message"}
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "กำลังดำเนินการ…"
            : mode === "signin"
              ? "เข้าสู่ระบบ"
              : "สร้างบัญชี"}
        </Button>
      </form>

      <p className="auth-security-note">
        ข้อมูลภายในจะแสดงตามสิทธิ์ที่ผู้ดูแลระบบกำหนดเท่านั้น
      </p>
    </div>
  );
}
