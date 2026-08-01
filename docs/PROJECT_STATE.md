# iROUP Next: Project State

## Current verified checkpoint — 1 August 2026

The local integration work is now pushed and deployed.

- GitHub branch: `agent/student-mobility-import-preview`
- Latest feature/deploy commit: `2290719 chore: exclude local dev logs from deploy`
- Feature commit: `6c7ccd7 feat: connect portal modules and import workflows`
- Draft PR: [#13](https://github.com/Peachylochy/iroup-next/pull/13)
- Production deployment: `dpl_5XXRp6UWXPqBLzRZeNzTTW38u9ao`
- Production URL: https://iroup-next.vercel.app
- Supabase production migrations through `20260730210000` are applied and verified
- Production RPC/function readback passed for mobility, staff movement, MOU, contacts, and legacy import commit paths
- Local checks passed: `pnpm.cmd typecheck`, `pnpm.cmd test` (4/4), `pnpm.cmd lint`, and `pnpm.cmd build`
- Production HTTP smoke checks passed: `/login` returned 200; protected `/mou` redirected to login
- Local-only `assets/` and `.codex-dev*.log` are excluded from GitHub/Vercel

Production currently contains master data but no committed legacy MOU, contact, or travel transaction records yet. Those imports remain a separate staging/review/explicit-commit step.

อัปเดตล่าสุด: 30 กรกฎาคม 2569
สถานะการทำงาน: **หยุดพักตามคำสั่งผู้ใช้ หลังจบ Local integration รอบ MOU, Contacts และ Travel**
Branch ปัจจุบัน: `agent/student-mobility-import-preview`
HEAD ที่ push แล้ว: `042015d fix: make account settings easy to reach`

> ไฟล์นี้บันทึกสถานะจริง ณ จุดหยุดงาน งานหลัง `042015d` ยังเป็น local working tree
> และยังไม่ได้ commit/push/deploy เพิ่ม ห้ามสรุปว่า production มีข้อมูลเท่ากับ local

## ภาพรวม

iROUP Next เป็น Next.js App Router + Supabase portal สำหรับงานวิเทศสัมพันธ์ทั้งระบบ:
Dashboard, MOU, องค์กรคู่ความร่วมมือ, ผู้ติดต่อองค์กรต่างประเทศ, Mobility นิสิต,
Mobility บุคลากร, เดินทางไปปฏิบัติงาน, ทุนการศึกษา, กิจกรรม, ข่าวประชาสัมพันธ์,
คลังความรู้, รายงาน, ผู้ใช้/สิทธิ์, Data Master และการนำเข้าข้อมูลระบบเดิม

หลักการที่อนุมัติร่วมกัน:

- ใช้ Supabase/Postgres/RLS เป็นแหล่งข้อมูลและสิทธิ์จริง
- Import ทุกชุดต้องผ่าน preview → staging/review → explicit commit
- MOU รองรับหลายคู่สัญญาโดยมี lead 1 องค์กร
- MOU รองรับหลายหน่วยงาน ม.พะเยาโดยมี owner 1 หน่วยงาน
- วันสิ้นสุด MOU ไม่บังคับ
- ข้อมูลผู้ติดต่อองค์กรต่างประเทศเป็นข้อมูลภายใน
- MOU file ไม่เปิด public และไม่มี automatic file deletion
- SharePoint file integration ยังรอ CITCOMS อนุมัติ Microsoft Graph API

## สถานะ Local Database ที่ตรวจยืนยันแล้ว

Data Master:

- ประเทศ 249 รายการ
- หน่วยงาน ม.พะเยา 57 รายการ
- บุคคล 26,640 รายการจาก `PERSON_STUDENT` และ `PERSON_STAFF`
- Partner organizations เพิ่มขึ้นจากการ import MOU และข้อมูลเดิม
- การเชื่อม country/unit ของ master ที่มี source reference ไม่มี orphan

ข้อมูลโมดูล:

- MOU 54 ฉบับ: ใช้งานอยู่ 35, หมดอายุ 19
- MOU partners 54 links และ MOU owner units 54 links
- ผู้ติดต่อองค์กรต่างประเทศ 56 records ใน local รวม QA 1 รายการ
- Contact methods 62 records: email 53, phone 9
- Mobility นิสิต 27 records ใน local รวม QA 1 รายการ
- ผู้เข้าร่วม Mobility/Travel ที่มีอยู่ใน local เชื่อมกับ Data Master จริง
- Mobility บุคลากร 1 QA record
- เดินทางไปปฏิบัติงานจากระบบเดิม 234 โครงการ / 407 ผู้เดินทาง
- Travel participants เชื่อม `people.id` ได้ 404 คน
- ผู้เดินทางที่ไม่พบใน Data Master 3 คนเก็บชื่อ snapshot ตามหลักฐานเดิม
- ตรวจช่วงวัน travel แล้วไม่มี `departure_date < arrival_date`
- ทุนการศึกษา 0, กิจกรรม 0, ข่าว 1 QA record, คลังความรู้ 0

## งานที่เสร็จและทดสอบแล้วใน Local

### Auth, roles และ App Shell

- Supabase Auth, pending access, account/password page และ System Admin
- Roles: System Admin, Office Admin, Editor, Viewer
- สิทธิ์รายโมดูล: view/create/update/publish/delete/import
- Sidebar และ Workspace Chrome ใช้ร่วมกันทุกโมดูล
- หน้า account เปลี่ยนรหัสผ่านเข้าถึงได้จาก header/sidebar
- Data Master import เป็น System Admin-only

### Data Master

- `/settings/master-import`
- รองรับ `COUNTRY_MASTER`, `UP_UNIT_MASTER`, `PARTNER_ORG_MASTER`,
  `PERSON_STUDENT`, `PERSON_STAFF`
- Local master batch commit ผ่านแบบ atomic
- มี pgTAP สำหรับสิทธิ์และ master commit
- Person search ใช้ API แบบค้นหาฝั่ง server ไม่โหลดคน 26,640 รายเข้าหน้าเว็บ

### MOU และองค์กร

- List/search/filter/pagination/detail/create/edit/export
- Workflow draft → under review → approved/active/completed/archived
- หลาย partners/lead 1 และหลาย UP units/owner 1
- Optional end date, fiscal year, country snapshot และ soft delete/restore
- Partner organization CRUD และ pending verification
- Private attachment data model พร้อมแล้ว แต่ SharePoint upload ยังไม่เชื่อม

### Mobility นิสิต

- List/detail/create/edit/workflow
- Participant search จาก Data Master
- Excel preview/mapping/staging/review/commit
- รองรับเพิ่ม country/unit/partner ระหว่าง mapping
- รองรับ “ยังระบุองค์กรไม่ได้” พร้อมหมายเหตุติดตาม
- Local import commit ผ่านและมี participant readback

### Mobility บุคลากรและเดินทางไปปฏิบัติงาน

- ใช้ movement core ร่วมกัน แต่แยก category/permission/route
- List/detail/create/edit/workflow
- Form ใช้ country/partner/unit master และ person search จริง
- Browser QA ของ staff movement write/workflow ผ่านก่อนหน้านี้
- หน้า travel list แสดง 234 รายการจาก legacy import จริง
- หน้า travel detail แสดงชื่อ ตำแหน่ง และหน่วยงานจาก Data Master จริง

### Legacy Import

หน้า `/settings/legacy-import` รองรับ 3 ชุด:

1. MOU จาก legacy public API
2. Contacts จาก `Contact_องค์กรต่างประเทศ_v5.xlsx`
3. Staff travel จาก legacy public API + รายงาน `ForeignAffairs_25690726_112149.xlsx`

ผล local:

- MOU preview/staging/commit: 54/54
- Contact workbook: 58 source rows, 56 valid, 2 warning, 0 invalid;
  upsert/dedupe เป็น 55 imported contacts
- Travel: 234 projects, 407 participants, 232 valid, 2 warning, 0 invalid
- Travel commit ผ่านแบบ atomic หลังแก้ mapping:
  `arrival_date = start_date`, `departure_date = end_date`
- แก้ API travel ให้ paginate people master ครั้งละ 1,000 จนครบ 26,640 ราย;
  หากไม่ paginate จะจับคู่ได้เพียงข้อมูลหน้าแรก

Legacy API ที่ตรวจแล้ว:

- MOU มี 54 รายการ
- Mobility มี 26 รายการและนำเข้าแล้ว
- Travel มี 234 โครงการ / 407 ผู้เดินทาง
- Scholarship, Event, News และ Knowledge ตอบกลับเป็น array ว่าง
  จึงไม่มี legacy records สำหรับ import ใน 4 โมดูลนี้

### Dashboard และรายงาน

- Dashboard counts อ่าน Supabase จริง:
  MOU 54, Mobility 28, Travel 234, Contacts 56 ใน local ปัจจุบัน
- MOU analytics, owner unit และ country ranking ใช้ข้อมูลจริง
- แก้ quick-add ให้ลิงก์ไปหน้า create จริงครบ:
  MOU, Mobility นิสิต, Mobility บุคลากร, Travel และ Contact
- Activity ล่าสุดอ่าน MOU/Movement/Contact จริงและคลิกเข้า record ได้
- Upcoming อ่าน MOU renewals และกิจกรรมในอนาคต
- Notification count ไม่ใช้เลขจำลอง 12 แล้ว
- `/reports` อ่านจำนวนและ aggregation จากฐานข้อมูล

## Browser QA ล่าสุด

ผ่าน:

- `/` แสดง local counts และ activity links จริง
- เมนู “เพิ่มข้อมูล” มี href จริงทั้ง 5 รายการ
- `/mou` แสดง 54 records และตัวกรองจากข้อมูลจริง
- `/mou/contacts` แสดง 56 records พร้อมองค์กร/ประเทศ/contact methods
- `/travel` แสดง 234 records
- `/travel/[id]` แสดงผู้เดินทางที่เชื่อม Data Master
- `/scholarships/new` เปิดได้และเห็น country/partner master selector

หยุดก่อนดำเนินการ:

- ยังไม่ได้ submit/browser readback ฟอร์ม Scholarship, Event, News, Knowledge รอบล่าสุด
- ยังไม่ได้ทำ browser regression รอบสุดท้ายทุก list/detail/form
- ยังไม่ได้ตรวจ Public Portal เพราะ route สาธารณะยังไม่ถูกสร้าง

## Migrations ที่เพิ่มใน Working Tree แต่ยังไม่ push รอบนี้

- `20260730113000_student_mobility_import_commit.sql`
- `20260730162000_mobility_workflow_event_actions.sql`
- `20260730162500_extend_mobility_workflow_event_actions.sql`
- `20260730180000_partner_contact_save_rpc.sql`
- `20260730190000_staff_movement_workflow.sql`
- `20260730200000_legacy_mou_import_commit.sql`
- `20260730203000_legacy_contact_import_commit.sql`
- `20260730210000_legacy_travel_import_commit.sql`

Local Supabase มี migration/function เหล่านี้แล้วตามการทดสอบ แต่ต้องตรวจ
`supabase migration list` ใหม่ก่อน apply production

## Production State

ยืนยันก่อนรอบปัจจุบัน:

- Supabase production ref: `fefxzaxlfocqeuicjevv`
- Vercel URL: `https://iroup-next.vercel.app`
- `thratip.so@up.ac.th` เป็น production System Admin
- Production master seed มี countries/units/partners/people แล้ว

ยังไม่ยืนยันหรือยังไม่ทำในรอบปัจจุบัน:

- Migrations ที่อยู่ใน working tree ด้านบนยังไม่ยืนยันว่า apply production
- Legacy MOU/Contacts/Travel รอบนี้ยังไม่ได้นำเข้า production
- Dashboard improvements รอบนี้ยังไม่ push/deploy
- ห้ามนำ QA records จาก local ขึ้น production

## QA Data ที่ต้องล้างก่อน Production

- Contact `66893c08-5512-4e92-b11f-bcd2461bdd8c` — `Codex QA Contact`
- News `b6ed413e-34fe-4fad-af7b-8ec8d0d5da15`
- Staff movement `6fbf453d-8095-416e-af08-bcaf6313846b`
- ตรวจหา student Mobility QA record เพิ่มเติมก่อน cleanup

ให้ inventory/readback ก่อนลบ และลบเฉพาะ QA data ที่ระบุได้แน่ชัด

## สิ่งที่ยังต้องทำ

1. ทดสอบ browser CRUD/readback ของ Scholarship, Event, News และ Knowledge
2. ตรวจทุก list/detail/form/search ว่าใช้ Data Master และ Supabase จริง
3. สร้าง Public Portal สำหรับ published/public MOU, Mobility, Travel,
   Scholarship, Event, News และ Knowledge; ต้องไม่เปิด Contacts/internal files
4. ทำ pgTAP เพิ่มสำหรับ legacy MOU/contact/travel commit functions
5. รัน `typecheck`, unit tests, ESLint, build, pgTAP และ browser regression
6. ล้าง local QA data หลัง inventory
7. ตรวจ production migration list แล้ว apply migrations ตามลำดับ
8. นำ legacy data ขึ้น production ผ่าน staging/review/explicit commit
9. push GitHub, deploy Vercel และตรวจ production readback/browser
10. SharePoint integration ทำหลัง CITCOMS อนุมัติ Graph API เท่านั้น

## จุดเริ่มงานครั้งถัดไป

เริ่มจาก:

1. `git status --short` และห้าม stage `assets/` หรือ `.codex-dev*.log`
2. `pnpm typecheck`
3. Browser QA ต่อจาก `/scholarships/new` โดย submit QA record แล้ว readback
4. ทำ Event → News → Knowledge ตามลำดับ และลบ QA records หลังผ่าน
5. ตรวจ/fix master pagination ใน query ที่อาจโตเกิน 1,000 rows
6. เริ่ม Public Portal หลัง internal CRUD/browser QA ผ่านครบ

## Git และไฟล์ที่ห้ามพลาด

- Repository: `Peachylochy/iroup-next`
- Branch: `agent/student-mobility-import-preview`
- Last pushed commit: `042015d`
- Working tree มีการเปลี่ยนแปลงจำนวนมากจาก Mobility, content modules,
  legacy import, dashboard, reports และ migrations
- ยังไม่ commit/push ตามคำสั่ง “หยุดก่อน”
- ห้าม stage `assets/`
- ห้าม stage `.codex-dev.err.log` และ `.codex-dev.out.log`
- Preserve unrelated user work และใช้ explicit `git add` เมื่อได้รับอนุมัติ

## Security และข้อควรจำ

- ห้าม commit password, service role key, database password หรือ token
- RLS/RPC ต้องเป็น enforcement จริง ไม่พึ่งการซ่อนปุ่ม
- Contacts และ internal files ห้ามเปิด public
- Imports ต้อง atomic และมี DB readback
- SharePoint/CITCOMS ยังเป็น external blocker ไม่ใช่งานที่ถือว่าเสร็จ
- ก่อน deploy ให้ยืนยัน production environment และ Supabase project/account
  ว่าตรงกับ Vercel account ปัจจุบัน
