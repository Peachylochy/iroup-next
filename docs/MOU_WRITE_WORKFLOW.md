# MOU Write Workflow

เอกสารออกแบบการบันทึกและแก้ไข MOU สำหรับ iROUP Portal โดยแยก “สถานะการทำงานภายใน” ออกจาก “สถานะการเผยแพร่” เพื่อไม่ให้การกดบันทึกทำให้ข้อมูลหลุดออกสู่ public โดยไม่ตั้งใจ

## ข้อสรุปหลัก

- ใช้หน้าเดียวแบบ step form สำหรับสร้างและแก้ไข MOU
- บันทึกครั้งแรกเป็น `draft` เสมอ
- การบันทึกแบบร่างทำได้โดยไม่ต้องกรอกข้อมูลครบทุกช่อง แต่ต้องมีชื่อ MOU
- การส่งตรวจต้องผ่าน validation ครบ และเปลี่ยนเป็น `under_review`
- เฉพาะผู้มีสิทธิ์ `publish` เท่านั้นที่เปลี่ยนเป็น `published` และ `active` ได้
- การเผยแพร่ต้องเป็น action แยกจากการแก้ไข ไม่ผูกกับปุ่ม Save
- ทุกการเขียนหลายตารางต้องทำผ่าน server action/RPC แบบ atomic transaction
- ยังไม่ทำ autosave ในรอบแรก ให้ใช้ Save draft ที่ผู้ใช้กดเองและมีสถานะบันทึกล่าสุดชัดเจน

## วงจรสถานะ

```text
เริ่มสร้าง
   ↓
draft ──ส่งตรวจ──→ under_review ──อนุมัติ/เผยแพร่──→ active + published
  ↑                    │                                  │
  └────ส่งกลับแก้ไข────┘                                  ├─หมดอายุอัตโนมัติ→ expired
                                                         ├─ยุติข้อตกลง→ terminated
                                                         └─ซ่อนจาก public→ archived
```

หมายเหตุ: schema ปัจจุบันมี `agreements.status` เป็น `draft | active | expiring | expired | terminated` และมี `publication_status` เป็น `draft | published | archived` แต่ยังไม่มีสถานะ `under_review` ใน enum ของ agreement โดยตรง จึงควรเพิ่ม workflow metadata แยกก่อนเริ่มทำปุ่มส่งตรวจจริง

## ฟอร์มสร้าง/แก้ไข

### Step 1: ข้อมูลหลัก

- เลขที่ MOU (`agreement_number`) — optional ตอนร่าง, แนะนำให้ unique เมื่อส่งตรวจ
- ชื่อ MOU ภาษาไทย (`title_th`) — required
- ชื่อ MOU ภาษาอังกฤษ (`title_en`) — optional ใน draft, required เมื่อส่งตรวจถ้าเป็นข้อตกลงสองภาษา
- ประเภทข้อตกลง (`agreement_type`) — required
- ปีงบประมาณ (`fiscal_year`) — required, พ.ศ. 2500–3000
- หมายเหตุภายใน (`internal_note`) — ไม่เผยแพร่ public

### Step 2: องค์กรและหน่วยงาน

- เลือกองค์กรคู่ความร่วมมือจาก `partner_organizations`
- กำหนดองค์กรหลักได้ 1 องค์กร (`is_lead`)
- เพิ่มหน่วยงานภายในที่เกี่ยวข้องจาก `organization_units`
- กำหนดหน่วยงานเจ้าของได้ 1 หน่วยงาน (`is_owner`)
- ถ้าไม่มีองค์กรในฐานข้อมูล ให้เปิด “สร้างองค์กรคู่ความร่วมมือ” ใน dialog ย่อย แล้วกลับมายังฟอร์มเดิม

### Step 3: วันสำคัญและไฟล์

- วันลงนาม (`signed_date`)
- วันเริ่มมีผล (`start_date`) — required
- วันสิ้นสุด (`end_date`) — optional แต่ถ้ามีต้องไม่น้อยกว่าวันเริ่ม
- แนบไฟล์ MOU ฉบับลงนามผ่าน Storage และผูกด้วย `record_assets`
- เลือกบทบาทไฟล์จาก `file_roles`; ไฟล์เอกสารต้นฉบับเป็น internal โดย default
- การเปิดเผยไฟล์ public ต้องเป็น action แยก และต้องใช้ file role ที่อนุญาต public เท่านั้น

### Step 4: ตรวจสอบก่อนส่ง

แสดงสรุปข้อมูลทั้งหมด พร้อมรายการ validation ที่กดกลับไปแก้ได้ โดยห้ามส่งตรวจจนกว่าจะผ่าน:

- ชื่อ MOU, ประเภท, ปีงบประมาณ และวันเริ่มมีผลครบ
- มีองค์กรคู่ความร่วมมืออย่างน้อย 1 รายการ และมี lead 1 รายการ
- มีหน่วยงานเจ้าของ 1 รายการ
- วันลงนามไม่เกินวันเริ่มมีผล ถ้ากรอกทั้งสองค่า
- วันสิ้นสุดไม่น้อยกว่าวันเริ่มมีผล
- เลขที่ MOU ไม่ซ้ำกับรายการที่ยังไม่ถูกลบ
- ไฟล์ที่จำเป็นผ่านชนิดและขนาดที่กำหนด

## ปุ่มและสิทธิ์

| Action | create | update | publish | delete |
|---|---:|---:|---:|---:|
| บันทึกแบบร่าง | yes | yes | no | no |
| ส่งตรวจ | yes | yes | no | no |
| ส่งกลับแก้ไข | no | no | yes | no |
| อนุมัติและเผยแพร่ | no | no | yes | no |
| ซ่อนจาก public | no | no | yes | no |
| ยุติข้อตกลง | no | no | yes | no |
| ลบแบบ soft delete | no | no | no | yes |

UI ใช้สิทธิ์เพื่อแสดง action ได้ แต่ database/RPC ต้องตรวจสิทธิ์ซ้ำทุกครั้ง

## Server/API contract ที่ควรทำ

สร้าง server actions หรือ RPC ชุดเล็ก ๆ แทนการให้ browser เขียนหลายตารางเอง:

- `create_mou_draft(payload)` — สร้าง agreement และ relations ใน transaction
- `update_mou_draft(id, payload, expected_updated_at)` — optimistic concurrency check
- `submit_mou_for_review(id)` — validate แล้วเปลี่ยน workflow state
- `return_mou_to_draft(id, reason)` — บันทึกเหตุผลการส่งกลับ
- `publish_mou(id)` — ตรวจ publish permission, public flags และเอกสารก่อนเผยแพร่
- `archive_mou(id, reason)` — ซ่อนจาก public โดยไม่ลบประวัติ
- `terminate_mou(id, reason)` — ยุติข้อตกลงและคงข้อมูล audit

ทุก action ควรคืนค่า `{ id, status, publication_status, updated_at }` และ error code ที่แปลเป็นข้อความภาษาไทยได้ เช่น `MOU_CONFLICT`, `MOU_VALIDATION_FAILED`, `MOU_FORBIDDEN`

## Migration ที่ต้องทำก่อนเขียนฟอร์ม

1. เพิ่ม enum หรือ table สำหรับ workflow state ที่มี `under_review`
2. เพิ่มตาราง `agreement_workflow_events` เก็บ action, ผู้กระทำ, เวลา, เหตุผล และ from/to state
3. เพิ่ม constraint/trigger บังคับว่า `published` ต้องมีข้อมูลขั้นต่ำและ `public_visible = true`
4. เพิ่ม unique index แบบไม่รวมรายการที่ soft-deleted สำหรับเลขที่ MOU
5. เพิ่ม RLS/RPC tests สำหรับแต่ละ transition และทดสอบผู้ใช้ Viewer, Editor, Office Admin, System Admin
6. ตรวจ policy ของ `agreement_partners` และ `agreement_units` ให้การแก้ relation อยู่ใน transaction เดียวกับ agreement

## UX ที่ผู้ใช้ควรเห็น

- แถบด้านบน: `ร่าง · ยังไม่บันทึก` / `บันทึกล่าสุดเมื่อ ...`
- ปุ่มหลัก: `บันทึกร่าง`
- ปุ่มรอง: `บันทึกและส่งตรวจ`
- เมื่อออกจากหน้าที่มีการแก้ไข ให้มี dialog ยืนยันก่อนทิ้งการเปลี่ยนแปลง
- ถ้ามีผู้ใช้อื่นแก้ก่อน ให้หยุดการ overwrite และแสดงปุ่ม `โหลดข้อมูลล่าสุด` กับ `เปรียบเทียบ`
- หน้า detail แสดง timeline ของ workflow events และผู้ดำเนินการ

## ลำดับการทำงานที่แนะนำ

1. ทำ migration + RLS/RPC tests ให้ transition ปลอดภัย
2. ทำ query/options สำหรับองค์กร หน่วยงาน และ file roles
3. ทำ create/edit form แบบ draft ก่อน
4. ทำ server actions และ optimistic concurrency
5. ทำ submit/review/publish workflow
6. ทดสอบ browser ตั้งแต่ create draft ถึง publish ด้วยผู้ใช้หลายบทบาท

