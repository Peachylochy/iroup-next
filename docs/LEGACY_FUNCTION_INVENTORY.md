# iROUP Legacy Function Inventory

สถานะ: **Baseline ที่ต้องเทียบก่อน build โมดูลใหม่**  
จัดทำ: 27 กรกฎาคม 2569  
แหล่งตรวจ: `Peachylochy_iroup-portal/Team IROUP` (admin pages, public pages, V2 API adapter และ Apps Script backend)

> กติกา: ห้ามถือว่า Next implementation เสร็จเพียงเพราะมีหน้ารายการหรือฟอร์ม
> ใหม่ ทุก capability ด้านล่างต้องถูกกำหนดเป็น **คงไว้ / ปรับปรุง / เลิกใช้โดยอนุมัติ**
> ก่อนโมดูลนั้นจะ merge เข้า `main`.

## 1. ขอบเขตระบบเก่า

| พื้นที่ | หน้า/บริการเดิม | ความสามารถระดับผู้ใช้ |
|---|---|---|
| Dashboard | `dashboard.html` | KPI, งานใกล้ครบกำหนด, activity chart, รายการทุน/กิจกรรม, MOU ใกล้หมดอายุ |
| MOU | `mou.html` | list, search/filter, KPI, world map, chart หน่วยงาน, create/edit/delete, files, CSV export |
| Mobility | `mobility.html` | list/detail, grid/table, filter, create/edit/delete, participant, batch resolution/import, budget, public map/summary |
| เดินทาง | `travel.html` | list/detail, filter, create/edit/delete, participant, budget, public summary |
| ทุน | `scholarship.html` | list/detail, filter, create/edit/delete, public list |
| กิจกรรม | `events.html` | list/detail, validation, dry-run, create/update/delete, files, public list |
| ข่าว | `news.html` | list/detail, create/update/delete, public list/detail |
| คลังความรู้ | `knowledge.html` | list/detail, create/update/delete, file/type filter, public list/detail |
| รายงาน | `report.html` | fiscal-year report summary, trend chart, breakdown, quick export/detail table |
| Public | `public/*.html` | landing, MOU, mobility, travel, scholarship, events, news, knowledge + selected detail pages |
| Master/contact | V2 lookups + `partner_contacts` design | ประเทศ, หน่วยงาน UP, บุคลากร/นิสิต, ประเภทไฟล์/งบ/กิจกรรม, องค์กรและผู้ติดต่อภายนอก |

## 2. MOU — baseline ที่ต้องรักษา

### 2.1 รายการและการวิเคราะห์

- รายการ MOU พร้อม paginate
- ค้นหาชื่อองค์กร/หน่วยงาน/ประเทศ/ประเภท
- กรองสถานะ: ทั้งหมด, active, ใกล้หมดอายุ, หมดอายุ, ยกเลิก
- กรองทวีปและช่วงวันที่
- KPI: จำนวนทั้งหมด, active, ใกล้หมดอายุ, หมดอายุ, ประเทศ/ทวีปที่เกี่ยวข้อง
- แผนที่โลกตามประเทศคู่ความร่วมมือ และ popup รายละเอียด
- สรุปตามหน่วยงาน ม.พะเยา
- เปิดรายละเอียด, แก้ไข, ลบแบบยืนยัน, export CSV ของรายการที่กรองแล้ว

### 2.2 ข้อมูลในฟอร์มเดิม

| กลุ่ม | Field เดิม | สถานะใน Next ปัจจุบัน |
|---|---|---|
| เจ้าของ | หน่วยงาน ม.พะเยา (`up_unit_id`) | มี: `organization_unit_id` |
| คู่สัญญา | ชื่อองค์กรไทย/อังกฤษ | มีแบบ master organization แต่ต้องรองรับ snapshot/ชื่อจากหนังสือ |
| ภูมิศาสตร์ | ประเทศ (`country_id`), ทวีป | ประเทศอยู่ใน master; ทวีปต้อง derive จาก country ไม่ใช่กรอกซ้ำ |
| ข้อตกลง | ประเภท MOU/MOA, ปีงบประมาณ | มี |
| ระยะเวลา | วันเริ่ม, วันสิ้นสุด, คำนวณปีงบประมาณจากวันเริ่ม | มีวันและปี แต่ยังไม่ auto-calculate |
| สถานะ | active/expired/cancelled | มี status domain; **ห้ามให้ผู้สร้าง publish เอง** |
| การเผยแพร่ | public visible, public file allowed | ยังไม่สร้าง UI; ต้องอยู่ใน approval/publish step |
| ไฟล์ | แนบ, ดูชื่อไฟล์, เปิดไฟล์, ล้างไฟล์ pending | ยังไม่สร้าง |

### 2.3 การตัดสินใจออกแบบที่อนุมัติไว้

- `สร้างใหม่` ใน Next = สร้าง **draft** เท่านั้น ไม่ตั้ง Active/เผยแพร่จากฟอร์มแรก
- MOU ที่ทราบจากหนังสือคณะก่อนรู้จักองค์กร: สร้างองค์กรขั้นต่ำสถานะ `pending_verification` ได้ แล้วผูกกลับเข้า MOU
- ระบบต้องมีทั้ง `ผู้บันทึก` (account), `หน่วยงานเจ้าของ` (UP unit) และ `องค์กรคู่สัญญา` (external master) แยกกัน
- ก่อน publish: ตรวจชื่อองค์กรซ้ำ/ยืนยันองค์กร, วันลงนาม, ไฟล์ และ public visibility ตาม policy ที่จะกำหนด

### 2.4 Gap ที่ต้อง build ต่อก่อนเรียก MOU ว่า complete

1. MOU detail/read screen และ timeline/audit
2. attachment management + roles + internal/public policy
3. return-to-draft / reviewer note
4. list filter: country, owner unit, date range, workflow/status; CSV/XLSX export
5. MOU map + owner-unit analytics (กำหนดก่อนว่าจะเป็น phase analytics หรือไม่)
6. auto fiscal year และ derived expiring status
7. delete/soft-delete workflow

## 3. Mobility — matrix จากระบบเก่า (ต้องเทียบก่อน build ต่อ)

แหล่งอ้างอิง: `Team IROUP/mobility.html`, `IROUP_V2_DTO_LOOKUP.gs`,
`IROUP_V2_ADMIN_API.gs` และ `IROUP-MASTER-CONCEPT.md`.

| กลุ่มงานเดิม | พฤติกรรมที่ตรวจพบ | แนวทางสำหรับ Next | สถานะ |
|---|---|---|---|
| Master ประเทศ/หน่วยงาน | ใช้ `input` + `datalist`; พิมพ์ค้นหาได้ แล้ว `sync...IdFromInput()` จับคู่ hidden ID | เปลี่ยน dropdown บังคับเลือกเป็น combobox/autocomplete ที่ค้นหาได้; เพิ่ม master เฉพาะกรณีไม่พบจริง | ต้องแก้ UI import และฟอร์มหลัก |
| Master นิสิต/บุคลากร | lookup แยก `students` และ `staff`; Mobility outbound ดึงนิสิตเป็นหลัก | นำเข้า master ภายในแบบ staged และให้ค้นหาแบบ server-side; ห้ามโหลดรายชื่อทั้งหมดเข้าสู่ browser | ต้องออกแบบ master import |
| รายการ Mobility | list/detail, card/table view, search/filter ปีงบประมาณ และ refresh | รักษา list/detail/filter; table/card เป็น enhancement หลัง workflow หลัก | List/Detail บางส่วนมีแล้ว |
| โครงการ | create/update/delete, inbound/outbound, ประเทศ, เมือง, หน่วยงาน, purpose, level, กลุ่มผู้เข้าร่วม, วันที่, ปีงบประมาณ, counters, status/public | ทำ schema/workflow ที่รองรับ field เหล่านี้ครบก่อน import จริง | ต้องตรวจ field matrix |
| ผู้เข้าร่วม | ค้นหารายคน, เพิ่ม/ลบ, เพิ่มหลายรหัส (สูงสุด 200), preview ก่อนบันทึก | รักษา individual search + batch resolve/preview/commit | Stage 1/RPC มีบางส่วน |
| นิสิตไม่มีใน master | วางข้อมูลจาก Excel แล้ว `studentresolvebatch` ตรวจ/สร้างเป็น batch | ต้องมี staged person import และ error review; ไม่สร้างคนแบบเงียบ ๆ ระหว่าง import โครงการ | ยังไม่ทำ |
| บุคคล manual/inbound | เพิ่ม person manual พร้อมชื่อ เพศ หน่วยงาน หลักสูตร/ตำแหน่ง | เก็บเป็น internal person/manual participant แยกจาก student/staff master | ยังไม่ทำ |
| งบประมาณ | อ่าน/บันทึก budget ของโครงการ | สร้าง relation budget หลัง project/participant workflow ผ่าน | ยังไม่ทำ |
| Public | list/map/summary เผยแพร่เฉพาะข้อมูล aggregate ไม่รวมชื่อผู้เข้าร่วม | ทำภายหลัง และห้ามเปิดข้อมูลบุคคล | ยังไม่ทำ |

### 3.1 กติกา master ที่ต้องรักษา

- `COUNTRY_MASTER` และ `UP_UNIT_MASTER` เป็น master กลางของทุกโมดูล ไม่ใช่ข้อมูลเฉพาะ Mobility
- `PERSON_STUDENT` ใช้กับ Mobility; `PERSON_STAFF` ใช้กับการเดินทางไปปฏิบัติงาน
- การค้นหา master ต้องรองรับชื่อไทย อังกฤษ และรหัส; ผู้ใช้เลือก record ที่มี ID แล้วจึงบันทึก
- การเพิ่ม master ใหม่เป็น exception ที่มีสิทธิ์กำกับ ไม่ใช่ทางหลักเมื่อมีไฟล์ master อยู่แล้ว
- Public API ต้องส่งเฉพาะสถิติ/ข้อมูลโครงการที่อนุมัติ ไม่ส่งรายชื่อหรือข้อมูลติดต่อ

### 3.2 ลำดับก่อนทำ Mobility ต่อ

1. ทำ field/workflow matrix ของ `MOBILITY_PROJECT` และ `MOBILITY_PARTICIPANT` เทียบ legacy กับ Supabase schema ทีละ field
2. ออกแบบและทดสอบ staged import ของ country, unit, student, staff และ partner master จากไฟล์ master
3. เปลี่ยน form/import mapping ให้ใช้ autocomplete จาก master ที่นำเข้าแล้ว
4. จึงสร้าง staging batch สำหรับข้อมูล Mobility และให้เจ้าหน้าที่ review/commit แยกต่างหาก

## 4. โมดูลอื่น: capability matrix

| โมดูล | อ่าน/วิเคราะห์ | เขียน | ไฟล์/ความสัมพันธ์ | Public |
|---|---|---|---|---|
| Mobility | list/detail, grid/table, filters, map, summary | create/update/delete | participant add/delete/batch add, person resolve/student resolve batch, budget get/save | list, map, summary |
| เดินทาง | list/detail, filters, summary | create/update/delete | participant add/delete, budget get/save | list, summary |
| ทุน | list/detail, filters | create/update/delete | - | list |
| กิจกรรม | list/detail, filters | validate, create/update dry-run, create/update/delete | file upload | list/detail |
| ข่าว | list/detail, filters | create/update/delete | file/image capability ผ่าน file upload | list/detail |
| คลังความรู้ | list/detail, type/file filters | create/update/delete | files/type | list/detail |
| รายงาน | report summary fiscal year, trend, breakdown, export table | ไม่มี record write | export | summary ที่อนุมัติ |
| Dashboard | dashboard summary, KPI, charts, alerts | ไม่มี record write โดยตรง | deep links ไป module | stats |

## 5. Exact V2 API capability registry

### Platform / auth / lookup

- `v2.health`, `v2.schema`, `v2.auth.session`
- `v2.lookup.countries`, `v2.lookup.units`, `v2.lookup.students`, `v2.lookup.staff`
- `v2.lookup.fileRoles`, `v2.lookup.budgettypes`, `v2.lookup.event_types`
- `v2.admin.person.search`, `create`, `createbatch`, `resolvebatch`, `studentresolvebatch`
- `v2.admin.file.upload`

### MOU

- `v2.admin.mou.list`, `detail`, `create`, `update`, `delete`
- `v2.public.mou.list`, `v2.public.mou.map`

### Mobility

- `v2.admin.mobility.list`, `detail`, `create`, `update`, `delete`
- `v2.admin.mobility.participant.list`, `add`, `batchadd`, `delete`
- `v2.admin.mobility.budget.get`, `save`
- `v2.public.mobility.list`, `map`, `summary`

### Travel

- `v2.admin.travel.list`, `detail`, `create`, `update`, `delete`
- `v2.admin.travel.participant.list`, `add`, `delete`
- `v2.admin.travel.budget.get`, `save`
- `v2.public.travel.list`, `summary`

### Content modules

- Scholarship: `admin.list/detail/create/update/delete`, `public.list`
- Event: `admin.list/detail/validate/create.dryrun/update.dryrun/create/update/delete`, `public.list`
- News: `admin.list/detail/create/update/delete`, `public.list`
- Knowledge: `admin.list/detail/create/update/delete`, `public.list`
- Dashboard/report: `v2.admin.dashboard.summary`, `v2.admin.report.summary`, `v2.public.stats`

## 6. Security and data rules observed in legacy system

- Admin session is Google-account based in Apps Script; V2 write/read admin actions require authenticated request.
- Public APIs emit sanitized DTOs, not raw admin records.
- Files carry module, record, file role and visibility level (`internal`/`public`).
- V2 supports soft-delete filtering and audit log concepts.
- Partner contacts are private information and must never become a public organization directory.

## 7. Build procedure from now on

For every next module:

1. Link this inventory row to the old page/API source.
2. Make a module-specific field + workflow matrix: **preserve / improve / deliberately retire**.
3. Obtain review of that matrix before creating migration/UI.
4. Implement schema/RLS/RPC/tests first, then list/detail/form/attachments/export.
5. Add regression tests for every capability marked preserve or improve.

## 8. Current Next implementation coverage

| Area | Status |
|---|---|
| Auth, roles, module permissions | built and tested |
| App Shell/dashboard foundation | built |
| MOU list + guarded draft/review/publish | built, incomplete against legacy matrix |
| Partner organization master + pending verification | built, incomplete (merge/dedupe review and private contacts pending) |
| Mobility, travel, scholarship, events, news, knowledge, reports, public portal | **do not build until each has a reviewed module matrix** |

## 9. Evidence paths

- Legacy MOU UI/data operations: `Team IROUP/mou.html`
- Legacy V2 browser API contract: `Team IROUP/js/iroup-v2-api.js`
- Legacy V2 backend router/actions: `Team IROUP/backend/database-v2/`
- Legacy compatibility backend: `Team IROUP/backend/Code.gs`
- Existing V2 schema/migration documentation: `Team IROUP/backend/database-v2/V2-API-CONTRACT.md`, `FRONTEND-V2-MIGRATION-PLAN.md`
