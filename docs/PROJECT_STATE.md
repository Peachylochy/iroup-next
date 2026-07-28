# iROUP Next: Project State

อัปเดตล่าสุด: 28 กรกฎาคม 2569
สถานะ: งาน Antigravity อยู่ระหว่างตรวจแก้บน branch `agent/antigravity-audit-fixes`; ยังไม่ merge เข้า `main` หรือ apply ไปยัง Supabase production

> ก่อนสร้างหรือรับรองโมดูลใหม่ ต้องตรวจ `docs/LEGACY_FUNCTION_INVENTORY.md` และทำ preserve/improve/retire matrix ของโมดูลนั้นก่อนเสมอ

## ฐานที่อยู่บน main แล้ว

- Next.js App Router, Supabase Auth, App Shell, ระบบผู้ใช้และสิทธิ์รายโมดูล
- Dashboard สำหรับเจ้าหน้าที่ และ MOU workflow: ร่าง → รอตรวจสอบ → เผยแพร่
- MOU form ตามข้อตกลงที่อนุมัติ: คู่สัญญาหลายองค์กร (lead หนึ่งองค์กร), หน่วยงาน ม.พะเยาหลายหน่วยงาน (owner หนึ่งหน่วยงาน), วันสิ้นสุด optional, country snapshot และปีงบประมาณไทย
- Partner organization master และข้อมูลผู้ติดต่อองค์กรต่างประเทศแบบ internal only
- MOU soft delete/restore โดย System Admin; ไม่มี automatic file purge
- Migrations production ถึง `20260727084026_remove_mou_file_retention`
- `main` ล่าสุดที่ยืนยันก่อนรับงาน Antigravity: `72159ce`

## งาน Antigravity ที่ได้รับและตรวจแล้ว

- MOU detail, internal attachments, partner contacts, MOU list/export/analytics และ Dashboard dynamic queries ถูกเพิ่มเข้ามา แต่เดิมยังไม่ commit
- Mobility/Travel workspace, form และ detail ถูกเพิ่มเข้ามา แต่ยังไม่มี Mobility preserve/improve/retire matrix จึงเป็นงานรอตรวจรับ ไม่ใช่โมดูลที่อนุมัติให้ถือว่าเสร็จ
- แก้ lint และ TypeScript ที่ค้าง, ย้าย request guard กลับเป็น Next.js `proxy.ts`, และกัน Supabase service-role client ด้วย `server-only`
- ตรวจและแก้ migration ไฟล์แนบ `20260728000000_mou_attachments_and_storage`:
  - bucket เป็น private และจำกัดชนิด/ขนาดไฟล์
  - path ต้องอยู่ใต้ MOU เป้าหมาย และ RPC ตรวจว่า object เป็นของผู้อัปโหลดจริง
  - signed URL ตรวจ `agreementId + assetId` ก่อนเสมอ
  - storage/asset RLS อนุญาตเฉพาะไฟล์ที่ผูกกับ record และผู้ใช้ดู record นั้นได้
  - การนำไฟล์ออกจาก MOU ลบความเชื่อมโยง/metadata แต่ไม่ลบ object ใน storage อัตโนมัติ ตามข้อตกลง retention ปัจจุบัน

## หลักฐานการตรวจบน local

- `pnpm lint` ผ่าน
- `pnpm typecheck` ผ่าน
- `pnpm build` ผ่าน (ไม่มีคำเตือน middleware deprecation)
- `supabase db reset --local` ผ่าน พร้อม migration ไฟล์แนบ
- pgTAP ผ่าน 151/151 tests รวม `mou_attachments_test.sql` 11 tests
- Browser QA ผ่านบน `http://localhost:3000`: Dashboard console สะอาด, ค้นหา MOU ได้จริง และ MOU detail/ส่วนเอกสารแนบเปิดได้โดยไม่มี runtime error
- `supabase db lint --local` พบ warning เก่าหนึ่งจุดใน `public.mou_restore` (ตัวแปร `agreement_record` ไม่ถูกอ่าน) แต่ไม่พบ schema error จากงาน Antigravity
- ยังไม่ได้ apply migration ไป Supabase production

## ขั้นตอนถัดไป

1. ตรวจ diff สุดท้าย, commit/push branch audit, เปิด PR ให้ review ก่อน merge
2. ทำ Mobility preserve/improve/retire matrix จาก legacy system ก่อนตัดสินใจรับหรือปรับโค้ด Mobility ที่ Antigravity เพิ่มมา
3. หลัง PR ได้รับอนุมัติ จึง apply migration `20260728000000` ไป Supabase production

## ข้อควรจำ

- ห้าม commit database password, service role key หรือข้อมูลติดต่อจริง
- การคุมสิทธิ์ต้องอยู่ที่ PostgreSQL/RLS ไม่พึ่งการซ่อนปุ่มใน React
- MOU files และข้อมูลผู้ติดต่อองค์กรต่างประเทศเป็น internal only
- ก่อนเริ่มงานใหม่: ตรวจ `git status`, `pnpm exec supabase migration list` และสถานะ PR ล่าสุด
