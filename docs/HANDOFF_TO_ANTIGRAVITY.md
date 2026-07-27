# iROUP Next — Handoff to Antigravity

อัปเดต: 27 กรกฎาคม 2569  
Branch: `agent/mou-app-shell`  
Latest commit: `d35440e Align MOU form with approved legacy matrix`  
PR: `https://github.com/Peachylochy/iroup-next/pull/2`

## เริ่มจากตรงนี้

ระบบใหม่ iROUP ใช้ Next.js App Router + Supabase เพื่อแทน Apps Script ระบบเก่า
MOU เป็นโมดูลแรกที่กำลัง build ตาม capability ของ legacy อย่างเป็นระบบ

- Local app: `http://localhost:3000`
- MOU ใหม่: `http://localhost:3000/mou/new`
- MOU list: `http://localhost:3000/mou`
- องค์กรคู่ความร่วมมือ: `http://localhost:3000/mou/organizations`
- Supabase project: `iroup-next` (`fefxzaxlfocqeuicjevv`)

ก่อนแก้ไขใด ๆ ให้ตรวจ `git status`, `supabase migration list` และ PR #2 ก่อน

## สิ่งที่ทำเสร็จและยืนยันแล้ว

### MOU workflow และสิทธิ์

- การสร้าง/แก้ไขทำผ่าน guarded RPC เท่านั้น: draft → under review → published
- Browser ถูกปิด direct write ไปยัง MOU และ relations
- Editor บันทึกร่าง/ส่งตรวจได้; Publisher publish ได้; Viewer ถูกปฏิเสธ
- ทุก transition มี `agreement_workflow_events`

### MOU form contract ที่ user อนุมัติ

- วันสิ้นสุดไม่บังคับ; ถ้ามีต้องไม่ก่อนวันเริ่ม
- รองรับหลายองค์กรคู่สัญญา แต่ต้องมี `lead` หนึ่งองค์กร
- รองรับหลายหน่วยงาน ม.พะเยา แต่ต้องมี `owner` หนึ่งหน่วยงาน
- ประเทศดึงจาก partner master และ snapshot ไว้เมื่อผูก MOU
- MOU ไฟล์เป็น internal เท่านั้น; ห้าม expose ใน public portal
- พันธมิตร `pending_verification` ส่งตรวจได้ แต่ทุก partner ต้อง `verified` ก่อน publish
- ปีงบประมาณไทยคำนวณจากวันเริ่ม (ตุลาคมเริ่มปีงบประมาณใหม่)
- Delete เป็น soft delete; System Admin restore ได้ก่อนครบ 30 วัน

### Migration ล่าสุด

`supabase/migrations/20260727075135_mou_legacy_field_contract.sql` ถูก apply ทั้ง local และ remote แล้ว

- partner/country snapshots และ country source/override contract
- fiscal-year trigger
- review/publish validation ที่เข้มขึ้น
- MOU attachment metadata ไม่ให้ anon เห็น
- RPC `mou_soft_delete` และ `mou_restore`

## เอกสารที่ต้องยึด

1. `docs/LEGACY_FUNCTION_INVENTORY.md` — baseline ฟังก์ชันจากระบบเก่า
2. `docs/MOU_PRESERVE_IMPROVE_RETIRE_MATRIX.md` — ข้อกำหนด MOU ที่ user อนุมัติแล้ว
3. `docs/MOU_WRITE_WORKFLOW.md` — สถานะ/สิทธิ์/UX workflow
4. `docs/PROJECT_STATE.md` — state ล่าสุด
5. `docs/LEGACY_ASSET_LIBRARY.md` — assets จาก legacy ที่ import แล้ว; ใช้ได้เมื่อจำเป็น

ห้าม build Mobility/Travel ก่อนทำ matrix ของโมดูลนั้นตามกติกาใน legacy inventory

## งานถัดไปที่ต้องทำ: MOU detail + attachments

ทำตามลำดับนี้:

1. ออกแบบ/ทำ migration สำหรับ MOU file attachment โดย reuse `assets` และ `record_assets`
2. สร้าง private Storage bucket/policies และ upload/download ผ่าน signed URL สำหรับผู้มีสิทธิ์ MOU เท่านั้น
3. ทำหน้า `/mou/[id]` detail: ข้อมูล MOU, partners/units snapshots, files, workflow timeline และ action ตาม role
4. ทำ scheduled worker ลบไฟล์จริงหลัง MOU ถูก soft-deleted 30 วัน
5. เพิ่ม RLS/RPC/Storage tests แล้วค่อยทำ UI

### ข้อสำคัญของ retention

ห้ามลบไฟล์ใน `storage.objects` ด้วย SQL. การลบไฟล์จริงต้องเรียก Supabase Storage API
จาก server-only scheduled worker/Edge Function; SQL delete จะเหลือ orphaned object.

- ห้ามใส่ service role key ใน client หรือ Git
- worker ต้อง idempotent และ log ผลลัพธ์ต่อ asset
- restore ก่อนครบ 30 วันต้องยกเลิก/ข้าม purge ของ MOU นั้น
- หลัง 30 วัน ให้คง MOU tombstone/audit ไว้ แต่ลบ file object และ asset metadata ที่เกี่ยวข้อง

## Verification ที่ต้องรันก่อน handoff กลับ

```powershell
pnpm.cmd exec supabase db reset --local --no-seed --yes
pnpm.cmd exec supabase test db --local supabase/tests/mou_write_workflow_test.sql supabase/tests/mou_legacy_field_contract_test.sql
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd exec supabase db advisors
```

สถานะล่าสุดก่อน handoff นี้:

- pgTAP: 17/17 ผ่าน
- ESLint / TypeScript / production build: ผ่าน
- Local และ remote DB advisor: ไม่พบ issue
- Remote migration list มีถึง `20260727075135`

## ความปลอดภัยและขอบเขต

- ผู้ติดต่อองค์กรต่างประเทศเป็นข้อมูลภายใน ห้าม public
- RLS/RPC เป็น source of truth ของสิทธิ์; ห้ามพึ่งการซ่อนปุ่มอย่างเดียว
- อย่าแก้ legacy source ที่ `D:\---------ONLY PEACH----------\Peachylochy_iroup-portal`
- อย่านำข้อมูล mobility Excel ไปปนกับ partner/contact data
- ห้าม commit password, service role key หรือข้อมูลผู้ติดต่อจริง
