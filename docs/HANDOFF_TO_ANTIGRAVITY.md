# iROUP Next — Handoff

อัปเดต: 28 กรกฎาคม 2569
Branch: `main` (`ccbb347` ก่อน handoff documentation นี้)
Repository: `https://github.com/Peachylochy/iroup-next`

## สถานะที่ส่งต่อ

MOU ปิดรอบ core แล้ว: write workflow, multi-partner/unit contract, detail, internal-only attachment, list/search/filter/pagination และ CSV/XLSX export ถูก merge อยู่บน `main`

- Local app: `http://localhost:3000`
- MOU list: `http://localhost:3000/mou`
- MOU create: `http://localhost:3000/mou/new`
- Partner organizations: `http://localhost:3000/mou/organizations`
- User management: `http://localhost:3000/settings/users`

ก่อนเริ่มทุกครั้ง ให้รัน `git pull --ff-only origin main`, ตรวจ `git status` และ `pnpm.cmd exec supabase migration list`

## ข้อมูลทดสอบ Local เท่านั้น

- import MOU จาก legacy public API: 54 MOU (35 active, 19 expired), 46 partner organizations, 14 countries, 18 owner units
- import PDF เฉพาะ 28 ไฟล์ที่ชื่อจับคู่ได้แบบ exact; อยู่ใน private bucket `mou-attachments`, link ผ่าน `assets`/`record_assets`, ทุกไฟล์ `is_public = false`
- ชื่อไฟล์ที่คลุมเครือหรือไม่ตรงกันยังไม่ import และรอ manual review
- ห้ามใส่ข้อมูลทดสอบหรือ PDF ใน Git และห้ามสรุปว่าเป็นข้อมูล production

## ข้อตกลงที่ห้ามเปลี่ยนเอง

- MOU: end date optional, many partners/one lead, many UP units/one owner, country snapshot, soft delete/restore, no automatic file purge
- MOU files และ partner contacts เป็น internal only; public portal ห้ามเห็น
- Mobility กับ official travel ใช้ data core ร่วมกัน แต่แยก navigation, workflow และ permission boundary
- RLS/RPC/Storage policy เป็น source of truth; UI hide อย่างเดียวไม่พอ
- ห้ามแก้ legacy source `D:\---------ONLY PEACH----------\Peachylochy_iroup-portal`

## เอกสารที่ต้องอ่านก่อนเริ่มงาน

1. `docs/PROJECT_STATE.md` — สถานะล่าสุด
2. `docs/LEGACY_FUNCTION_INVENTORY.md` — baseline ระบบเก่า
3. `docs/MOU_PRESERVE_IMPROVE_RETIRE_MATRIX.md` และ `docs/MOU_WRITE_WORKFLOW.md`
4. `docs/MOU_ANALYTICS_SCOPE.md` — ขอบเขต analytics รอบถัดไป
5. `docs/MOBILITY_PRESERVE_IMPROVE_RETIRE_MATRIX.md` — ต้อง review ก่อนเริ่ม Mobility/Travel
6. `docs/architecture/01-users-and-permissions.md` และ `02-domain-model.md`

## งานถัดไปตามลำดับ

1. MOU analytics: KPI, renewal queue, owner-unit/country aggregate และ drill-down ไป `/mou`; Admin ไม่มี interactive map
2. ทบทวน Mobility matrix กับเจ้าของระบบ แล้วสร้าง field mapping/import contract ของ Mobility และ official travel แยกกัน
3. หลัง matrix อนุมัติเท่านั้น: movement migration → RLS/RPC → pgTAP → list/detail/form → participant/budget/files/import
4. Public Portal/map เป็น phase แยกด้วย public-safe DTO; ห้ามเผยไฟล์ MOU, contacts, notes หรือ PII

## Verification ขั้นต่ำก่อนส่งกลับ

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd exec supabase test db --local
pnpm.cmd exec supabase migration list
git status --short --branch
```

อย่า commit password, service role key, `.env.local`, ข้อมูลผู้ติดต่อจริง หรือไฟล์ใน `assets/`
