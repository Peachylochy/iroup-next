# iROUP Next

ระบบบริหารงานวิเทศสัมพันธ์ มหาวิทยาลัยพะเยา สร้างด้วย Next.js App Router และ
Supabase

## Platform

- Next.js 16 + React 19
- Supabase Auth, PostgreSQL, RLS และ Storage
- shadcn/ui + Base UI
- Vitest, Playwright และ pgTAP

## Local development

คัดลอก `.env.example` เป็น `.env.local` แล้วกำหนด Project URL และ publishable
key ของ Supabase จากนั้นรัน:

```bash
pnpm install
pnpm dev
```

เปิด <http://localhost:3000>

## Database workflow

```bash
pnpm supabase:start
pnpm exec supabase db reset --local --yes
pnpm supabase:test
```

ทุก migration ต้องผ่าน pgTAP และ database lint ก่อนนำขึ้น production

## Authentication and permissions

- ผู้ใช้ใหม่สมัครด้วยอีเมลและรหัสผ่าน
- บัญชีใหม่เห็นเฉพาะหน้ารออนุมัติ จนกว่าจะได้รับบทบาทหรือสิทธิ์โมดูล
- เมนู การอ่านข้อมูล และการแก้ไขข้อมูลอิงสิทธิ์เดียวกันจาก PostgreSQL
- ผู้ดูแลระบบคนแรกต้องมอบสิทธิ์ด้วยขั้นตอน bootstrap ฝั่งฐานข้อมูล
- ห้ามใช้ `user_metadata` เป็นแหล่งตัดสินสิทธิ์
- ห้ามนำ secret key หรือ service-role key ไปไว้ใน browser หรือ GitHub

รายละเอียดการออกแบบอยู่ใน [docs/architecture](docs/architecture)

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm supabase:test
```
