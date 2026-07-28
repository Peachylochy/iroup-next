# iROUP Next: Project State

อัปเดตล่าสุด: 28 กรกฎาคม 2569
สถานะ: MOU core, detail, private attachment, list/filter/export และ analytics ปิดรอบแล้ว; Mobility นิสิต Stage 1 ปิด migration/RLS/RPC/pgTAP และ List/Detail/Form UI แล้ว รอ review/merge

> ก่อนสร้างโมดูลใหม่หรือขยาย MOU ให้ใช้ `docs/LEGACY_FUNCTION_INVENTORY.md`
> เป็น baseline และทำ preserve/improve/retire matrix ของโมดูลนั้นก่อนเสมอ

## ภาพรวมปัจจุบัน

iROUP Next เป็นระบบใหม่ที่พัฒนาด้วย Next.js และ Supabase เพื่อทดแทนข้อจำกัด
ด้านความเร็วและการดูแลรักษาของระบบเดิม โครงสถาปัตยกรรมครอบคลุมทั้งระบบแล้ว
ได้แก่ Dashboard, MOU, Mobility, การเดินทางไปปฏิบัติงาน, ทุนการศึกษา,
กิจกรรม, ข่าวประชาสัมพันธ์, คลังความรู้, รายงาน และการตั้งค่าระบบ

## งานที่เสร็จแล้ว

- สร้าง Next.js App Router พร้อม TypeScript และ UI foundation
- เชื่อม Local repository กับ Supabase project `iroup-next`
- วาง Domain/Data Model และ migration หลักของระบบ
- เปิดใช้ Supabase Auth พร้อมหน้าเข้าสู่ระบบ สร้างบัญชี และรออนุมัติสิทธิ์
- สร้าง Dashboard สำหรับเจ้าหน้าที่และเชื่อมข้อมูลสรุปจาก Supabase จริง
- แยก Mobility และการเดินทางไปปฏิบัติงานเป็นคนละ permission boundary
  แต่ใช้ Movement data core ร่วมกัน
- เพิ่มฐานข้อมูลผู้ติดต่อองค์กรต่างประเทศแบบข้อมูลภายใน
- กำหนดผู้ใช้ `thratip.so@up.ac.th` เป็น System Administrator คนแรก
- สร้างหน้า `/settings/users` สำหรับค้นหาและจัดการผู้ใช้
- รองรับบทบาท System Admin, Office Admin, Editor และ Viewer
- รองรับสิทธิ์รายโมดูล: ดู เพิ่ม แก้ไข เผยแพร่ ลบ และนำเข้า
- ป้องกัน System Admin ลดสิทธิ์หรือปิดบัญชีของตัวเอง
- ย้ายฟังก์ชันที่ยกระดับสิทธิ์ไปยัง private schema และเปิด public RPC
  ผ่าน Security Invoker wrapper
- ตรวจ Responsive layout สำหรับ Desktop และ Mobile
- Merge PR #1 เข้า `main` สำเร็จด้วย merge commit `1dcfb4a`
- Merge PR #2 (App Shell, MOU, partner organization และ legacy matrix) เข้า `main`
  สำเร็จด้วย merge commit `1743eb5`
- เพิ่ม shared App Shell components สำหรับ Sidebar และ Workspace Chrome
- เพิ่มหน้า `/mou` สำหรับรายการ MOU พร้อมค้นหา กรองสถานะ และ empty state
- เพิ่ม MOU write workflow: ร่าง → รอตรวจสอบ → มีผลบังคับใช้/เผยแพร่
- เพิ่มหน้า `/mou/new` และ `/mou/[id]/edit` เชื่อมกับ Supabase RPC โดยตรง
- ปรับ MOU form ตาม matrix ที่อนุมัติ: หลายคู่สัญญา (lead หนึ่งองค์กร),
  หลายหน่วยงาน ม.พะเยา (owner หนึ่งหน่วยงาน), วันสิ้นสุด optional และ
  คำนวณปีงบประมาณไทยจากวันเริ่ม
- เก็บ partner/country snapshot ใน MOU, บังคับประเทศของ lead ก่อนส่งตรวจ
  และบังคับทุก partner เป็น `verified` ก่อน publish
- เพิ่ม MOU soft delete/restore; System Admin restore ได้ และไม่มี automatic file purge
- ปิด direct write จาก browser สำหรับ MOU และบังคับผ่าน workflow RPC
- เพิ่มคลังองค์กรคู่ความร่วมมือที่ `/mou/organizations` พร้อมสร้าง/แก้ไขข้อมูล
  องค์กรจากหนังสือขอลงนาม และสถานะ ยืนยันแล้ว/รอตรวจสอบ/ข้อมูลไม่ครบ
- เชื่อมฟอร์ม MOU กับทางลัด “ไม่พบองค์กร? เพิ่มจากหนังสือฉบับนี้”

## สถานะฐานข้อมูลและความปลอดภัย

- Supabase production migrations ใช้งานถึง:
  - `20260727034322_mou_write_workflow`
  - `20260727045323_partner_organization_workflow`
  - `20260727075135_mou_legacy_field_contract`
  - `20260727084026_remove_mou_file_retention`
  - `20260728000000_mou_attachments_and_storage`
- Mobility Stage 1 migration `20260728150616_student_mobility_stage_1` ทดสอบบน Local Supabase แล้ว:
  เพิ่มเวลาไป-กลับ, snapshot ของคู่ความร่วมมือ/ประเทศ, snapshot ของนิสิต, workflow events และ guarded RPC
  สำหรับ draft, participant, funding, review, approve, activate และ complete โดยปิด direct write เฉพาะ `student_mobility`
- `supabase/tests/student_mobility_stage_1_test.sql` ผ่าน 11/11: anon ถูกปิด, Editor ทำ draft/participant/submit ได้,
  Publisher อนุมัติได้ และผู้มีสิทธิ์ `travel` อย่างเดียวเข้าถึง Mobility ไม่ได้
- Local Security Advisor (warn/error) ไม่พบ issue หลัง migration Mobility
- ทดสอบสิทธิ์ MOU บน remote database ด้วย transaction rollback ผ่าน: direct write
  ถูกปิด, Editor สร้าง/ส่งตรวจได้แต่เผยแพร่ไม่ได้, Publisher เผยแพร่ได้ และ Viewer ถูกปฏิเสธ
- เพิ่มและรัน pgTAP test ที่ `supabase/tests/mou_write_workflow_test.sql` บน local
  Supabase หลัง reset จาก migrations จริง: ผ่าน 9/9 tests
- เพิ่มและรัน pgTAP test ที่ `supabase/tests/partner_organization_workflow_test.sql`:
  ผ่าน 5/5 tests
- เพิ่มและรัน `supabase/tests/mou_legacy_field_contract_test.sql`: ผ่าน 8/8 tests;
  test รวม MOU workflow + legacy contract ผ่าน 17/17 tests
- Supabase database lint ไม่พบ schema error
- Security Advisor แจ้ง Security Definer สำหรับ MOU RPC 4 ตัวตามคาด เพราะ RPC
  ต้องทำงานแบบ atomic; ทุกตัวตรวจสิทธิ์ผู้เรียกภายในก่อนทำงาน
- ยังมีคำเตือนระดับ Project Setting เรื่อง Leaked Password Protection
  ซึ่งไม่กระทบการทำงานปัจจุบันและควรเปิดก่อน Production launch

## สถานะ Frontend

- Local URL: `http://localhost:3000`
- User management: `http://localhost:3000/settings/users`
- MOU list: `http://localhost:3000/mou`
- MOU create: `http://localhost:3000/mou/new`
- Partner organizations: `http://localhost:3000/mou/organizations`
- Mobility student list: `http://localhost:3000/mobility`
- Mobility student create: `http://localhost:3000/mobility/new`
- ESLint ผ่าน
- TypeScript ผ่าน
- Next.js production build ผ่าน
- Playwright regression tests ผ่าน 5/5
- Browser QA ของ Mobility นิสิตผ่าน: เมนูเข้า list, empty state ไม่มีข้อมูลตัวอย่าง,
  form ดึงประเทศ/องค์กร/หน่วยงานจากข้อมูลจริง และเพิ่มผู้เข้าร่วมแบบ dynamic ได้
- Browser QA ผ่านทั้งการค้นหา เปิด Permission panel
  การล็อกสิทธิ์บัญชีตัวเอง และ viewport 390px
- Browser console ไม่พบ error หรือ warning ที่เกี่ยวข้อง

## GitHub

- Repository: `Peachylochy/iroup-next`
- Main includes PR #1 `1dcfb4a`, PR #2 `1743eb5`, PR #4 `d06610c` (MOU detail + internal attachments), PR #5 `6f7d4b4` (search label spacing), and PR #6 `ccbb347` (MOU filtering, pagination, CSV/XLSX export and local attachment test state).
- Current branch: `main` synchronized with `origin/main`.
- Local test data now uses 54 MOU records imported from the legacy public MOU API: 35 active, 19 expired, 46 partner organizations, 14 countries, and 18 owner units. This data is Local only and is not part of Git history or the linked production project.
- Imported 28 PDF attachments whose filename had a one-to-one, exact organization match. They are in the private `mou-attachments` bucket, linked through `assets`/`record_assets`, and have `is_public = false`. The remaining files require manual matching and were not imported.
- MOU list filtering, pagination, CSV/XLSX export, and private attachment display have been verified against the Local legacy dataset. Mobility remains out of scope until its legacy matrix is approved.

## จุดเริ่มงานครั้งถัดไป

1. Review และ merge หน้า List/Detail/Form ของ Mobility นิสิต; หน้า detail มี transition ตามสิทธิ์: ส่งกลับแก้ไข, อนุมัติ, เริ่มโครงการ และปิดโครงการ
2. ทำ internal attachment workflow หลังยืนยัน storage integration; ยังไม่เชื่อม SharePoint อัตโนมัติจนกว่า CITCOMS อนุมัติ Graph API
3. ทำ import preview/review สำหรับข้อมูล 407/408 แถว โดยยังไม่ commit จริง; `staff_mobility` และ `staff_official_travel` ค่อยต่อยอดตาม category contract

## ข้อควรจำ

- ห้ามใส่ Database password, service role key หรือข้อมูลผู้ติดต่อจริงใน GitHub
- การอนุญาตสิทธิ์ต้องบังคับใช้ที่ PostgreSQL/RLS ไม่พึ่งการซ่อนปุ่มใน React
- ข้อมูลผู้ติดต่อองค์กรต่างประเทศเป็นข้อมูลภายในและห้ามเปิด public
- ก่อนเริ่มงานครั้งถัดไปให้ตรวจ `git status`, Supabase migration list
  และสถานะ PR ล่าสุดก่อนเสมอ

