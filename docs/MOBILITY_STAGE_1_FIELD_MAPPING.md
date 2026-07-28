# Mobility Stage 1 — Field Mapping and Write Contract

สถานะ: **พร้อมออกแบบ migration/RPC ของ Mobility นิสิต**
ขอบเขต: `student_mobility` เท่านั้น; ไม่ import ข้อมูลเดิม และไม่สร้าง Public Portal ในรอบนี้

## หลักการ

Mobility นิสิตใช้ `movement_cases` เป็นโครงการหนึ่งรายการ และใช้
`movement_participants` เป็นผู้เข้าร่วมหนึ่งคนต่อหนึ่งโครงการ จึงแยกจำนวนโครงการออกจากจำนวนผู้เข้าร่วมเสมอ

ข้อมูลจากระบบเดิมเป็น baseline เท่านั้น: ห้ามย้ายการเขียนตรงจากหน้า HTML/Excel มาใช้ในระบบใหม่
ทุก write ผ่าน RPC และทุก batch import ผ่าน staging → validate → review → commit → audit

## Mapping จากระบบเดิม

| ข้อมูลเดิม | Target ใหม่ | สถานะ Stage 1 |
| --- | --- | --- |
| ชื่อโครงการ | `movement_cases.project_name` | บังคับ |
| ชื่ออังกฤษ | `movement_cases.title_en` | ไม่บังคับ |
| Inbound / Outbound | `movement_cases.direction` | บังคับ |
| ประเทศ / เมือง | `country_id`, `city` | ประเทศบังคับเมื่อเป็น international mobility |
| สถาบันคู่ความร่วมมือ | `partner_organization_id` พร้อม snapshot | เลือกจาก master หรือเพิ่มเป็น pending verification |
| หน่วยงานเจ้าของ ม.พะเยา | `owner_unit_id` | บังคับ |
| วันไป / วันกลับ | `start_date`, `end_date` และเวลาเดินทางที่ migration จะเพิ่ม | วันที่ไปบังคับ; วันกลับขึ้นกับ workflow |
| วัตถุประสงค์ / mobility mode | `purpose`, field contract ของ student mobility | บังคับ purpose |
| ปีงบประมาณ | `fiscal_year` | คำนวณจากวันไป และเก็บไว้เพื่อรายงาน |
| สถานะงาน | `workflow_status` | ใช้ transition ที่ guarded RPC ตรวจสอบ |
| ผู้เข้าร่วม | `movement_participants` | เพิ่มทีละคนหรือ batch ผ่าน preview |
| รหัสนิสิต / ชื่อ / คณะ / หลักสูตร | person relation + immutable participant snapshots | ห้ามเผยแพร่ public |
| งบประมาณหลายแหล่ง | `movement_funding` | เพิ่มหลายรายการต่อ case ได้ |
| เอกสารโครงการ | `assets` + `record_assets` | internal only, signed URL ตาม RLS |

## ช่องว่างที่ migration ต้องเติม

ตาราง movement core มีอยู่แล้ว แต่ต้องเพิ่ม contract ที่ใช้งานจริงสำหรับ Mobility นิสิต:

1. เวลาออกเดินทางและเวลากลับ โดยรักษา `start_date` / `end_date` สำหรับ report และ filter เดิม
2. Snapshot ผู้เข้าร่วมที่เฉพาะกรณีนิสิต ได้แก่ รหัสนิสิต หลักสูตร ระดับการศึกษา และเพศ โดยเก็บข้อมูลหน่วยงานเดิมไว้แล้ว
3. Workflow event และ Workflow RPC สำหรับ create, update, submit review, return, approve และเปลี่ยนสถานะหลังอนุมัติ
4. ปิด direct write ของ `student_mobility` บน movement case / participant / funding โดยไม่กระทบ Travel หรือ Mobility บุคลากร
5. Validation ที่แยก `student_mobility` จาก category อื่น โดยไม่เปิดสิทธิ์ข้ามไป Travel

## Write contract

```text
create draft
  → add/edit participants, funding, internal files
  → submit for review
  → approve
  → active while exchange is in progress
  → complete or cancel
```

- Editor สร้าง/แก้ draft และส่งตรวจได้
- ผู้มีสิทธิ์ publish/approve ของ Mobility เท่านั้นที่อนุมัติได้
- สิทธิ์ `travel` ไม่สามารถเห็นหรือแก้ Mobility draft
- ผู้เข้าร่วม, งบประมาณ, notes และไฟล์ไม่อยู่ใน public DTO

## Import guardrail

ไฟล์ Mobility 407/408 แถวยังไม่ใช่คำสั่งนำเข้า เพราะหนึ่งแถวอาจเป็นผู้เข้าร่วมหรือโครงการ
ก่อน import ต้องยืนยันว่าแต่ละ row map เป็น case, participant หรือทั้งสองอย่าง และต้องมีวันไป-กลับที่ถูกต้อง
การทดลอง import จะเริ่มได้หลัง Stage 1 CRUD/RLS ผ่านและมีหน้าจอ review rows แล้วเท่านั้น

## Definition of ready for UI

- migration ผ่าน local reset
- pgTAP ครอบคลุม RLS และ workflow transition ของ Mobility
- RPC ไม่เปิด direct write จาก browser
- list/detail/form query contract ระบุ field ครบ
- batch preview ไม่เขียนข้อมูลจริงก่อนผู้ใช้ commit
