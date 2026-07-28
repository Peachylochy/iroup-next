"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  type AuthActionState,
  demoSignInAction,
  signInAction,
  signUpAction,
} from "./actions";

const initialState: AuthActionState = { message: "" };

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("thratip.so@up.ac.th");
  const [password, setPassword] = useState("password123");
  const [displayName, setDisplayName] = useState("");
  const [isDemoPending, startDemoTransition] = useTransition();

  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    initialState,
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpAction,
    initialState,
  );
  const state = mode === "signin" ? signInState : signUpState;
  const pending = (mode === "signin" ? signInPending : signUpPending) || isDemoPending;

  const handleFillDemo = () => {
    setMode("signin");
    setEmail("thratip.so@up.ac.th");
    setPassword("password123");
  };

  const handleDirectDemoLogin = () => {
    startDemoTransition(async () => {
      await demoSignInAction();
    });
  };

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

      {mode === "signin" && (
        <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={handleDirectDemoLogin}
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "linear-[#7c3aed], #4f46e5",
              backgroundColor: "#6366f1",
              color: "#ffffff",
              fontWeight: 600,
              cursor: pending ? "not-allowed" : "pointer",
              width: "100%",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
            }}
          >
            <Zap size={16} />
            <span>{isDemoPending ? "กำลังเข้าสู่ระบบ Demo..." : "⚡ คลิกเข้าใช้งานระบบ Demo (thratip.so@up.ac.th) ทันที"}</span>
          </button>

          <button
            type="button"
            onClick={handleFillDemo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              padding: "0.375rem 0.5rem",
              borderRadius: "0.375rem",
              border: "1px solid rgba(156, 163, 175, 0.3)",
              background: "transparent",
              color: "#6b7280",
              fontWeight: 400,
              cursor: "pointer",
              width: "100%",
              justifyContent: "center",
            }}
          >
            <KeyRound size={12} />
            <span>เติมรหัส Demo ใส่ช่องฟอร์ม</span>
          </button>
        </div>
      )}

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
              <Input
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
            <Input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@up.ac.th"
              required
            />
          </span>
        </label>

        <label>
          <span>รหัสผ่าน</span>
          <span className="auth-field">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
