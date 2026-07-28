# Mobility and Official Travel — Preserve / Improve / Retire Matrix

สถานะ: **ยืนยันให้เริ่ม Stage 1: Mobility นิสิต โดยยังไม่เริ่ม import ข้อมูลเดิม**
Baseline: `docs/LEGACY_FUNCTION_INVENTORY.md`, legacy `mobility.html`, legacy travel module, `docs/architecture/02-domain-model.md`

## ขอบเขตที่ยืนยันแล้ว

ใช้ข้อมูลแกนกลางเดียวกัน (`movement_cases`, participants, funding, files) เพราะ Mobility และการเดินทางไปปฏิบัติงานมีวันเดินทาง ปลายทาง คู่ความร่วมมือ หน่วยงาน และรายงานร่วมกัน แต่แยกหน้าจอ สิทธิ์ และ workflow ตาม `movement_category`

- `student_mobility` — Mobility นิสิต
- `staff_mobility` — Mobility บุคลากร
- `staff_official_travel` — เดินทางไปปฏิบัติงาน
- `visiting_delegation` — คณะ/ผู้มาเยือนจากต่างประเทศ

จึงไม่รวม Mobility กับการเดินทางเป็นเมนูหรือสิทธิ์เดียวกัน และไม่รวมจำนวนโครงการกับจำนวนผู้เข้าร่วมเป็นตัวเลขเดียว

## Matrix

| ความสามารถ legacy | ตัดสินใจ | เป้าหมายระบบใหม่ | ลำดับ |
| --- | --- | --- | --- |
| List, grid/table, search, filter, detail | คงไว้และปรับปรุง | URL filter, server pagination, saved view เฉพาะผู้ใช้ | Core |
| เพิ่ม/แก้ไข/ลบโครงการ | ปรับปรุง | guarded RPC, draft/review/approved(or completed) ตาม category, soft delete + audit | Core |
| วันไป-กลับและเวลา | ปรับปรุง | เก็บ departure/return date-time; return optional เฉพาะกรณีที่ workflow อนุญาต และ validate ลำดับเวลา | Core |
| ผู้เข้าร่วม | คงไว้และปรับปรุง | participant relation, role, snapshot, batch add พร้อม preview/error rows | Core |
| ค้น/resolve นิสิตและ import batch | คงไว้และปรับปรุง | staging import: upload → parse → normalize → validate → review → commit → audit; ห้ามเขียนเข้าตารางจริงระหว่าง preview | Core |
| งบประมาณ/แหล่งทุน | คงไว้ | `movement_funding` หลายรายการต่อ case พร้อมยอดและ currency | Core |
| เอกสารหลักฐาน | คงไว้และปรับปรุง | private attachments, role/type/size validation, signed URL ตาม RLS | Core |
| Inbound/outbound และปลายทาง/องค์กร | คงไว้ | destination/partner snapshot, country source of truth, เหตุผลเมื่อ override | Core |
| Mobility นิสิต | คงไว้ | ระดับการศึกษา, หลักสูตร, mobility mode, inbound/outbound | Category field |
| Mobility บุคลากร | คงไว้ | activity role, host organization, inbound/outbound | Category field |
| เดินทางไปปฏิบัติงาน | คงไว้ | purpose, approval/order reference, funding detail; permission แยกจาก Mobility | Category field |
| Dashboard, summary, map | ทำภายหลัง | internal KPI หลัง Core เสร็จ; interactive map อยู่ Public Portal เท่านั้น | Analytics/Public |
| Public list/map/summary | ปรับปรุง | public-safe DTO ที่ไม่ส่ง PII, private files, contacts, notes หรือ draft | Public |
| เขียนข้อมูลตรงจากหน้าจอ/Excel | เลิกใช้ | ทุก write ผ่าน RPC และทุก import ผ่าน staging/review | Retire |
| โครงสร้างข้อมูลซ้ำ Mobility/Travel | เลิกใช้ | shared movement core + category-specific validation/workflow | Retire |

## สิทธิ์และความเป็นส่วนตัว

| พื้นที่ | สิทธิ์ที่ใช้ |
| --- | --- |
| Mobility นิสิต/บุคลากร | module `mobility` |
| เดินทางไปปฏิบัติงาน | module `travel` |
| การเผยแพร่ public | ต้องมีสิทธิ์ publish ของโมดูลนั้น และผ่าน public-safe DTO |
| ไฟล์, ข้อมูลผู้เข้าร่วม, PII, notes | internal only; RLS และ signed URL เป็นตัวบังคับ |

การซ่อนเมนูเป็นเพียง UX; direct route, RPC, Storage และ aggregate query ต้องบังคับด้วย RLS เสมอ

## ลำดับการทำงานที่ต้องรักษา

1. ทบทวน matrix นี้กับเจ้าของระบบ และระบุ status/workflow ของแต่ละ category ให้ชัด
2. ตรวจ legacy API/หน้าจอจริง แล้วทำ field mapping และ import contract ของ Mobility/Travel แยกกัน
3. สร้าง migration, indexes, RLS, RPC และ pgTAP tests ของ movement core ก่อนทำฟอร์ม
4. ทำ list/detail/form ของหนึ่ง category บน core เดียว แล้วขยาย category ที่เหลือด้วย field/workflow contract
5. ทำ participant/budget/attachment/import review และทดสอบสิทธิ์ทุก action
6. ทำ dashboard/report; Public Portal และ map เป็นรอบแยกหลังข้อมูลและ permission พร้อม

## การตัดสินใจสำหรับ Stage 1

- เริ่มจาก `student_mobility` เท่านั้น เพื่อพิสูจน์ movement core ด้วย workflow และ field contract ที่ชัดเจนหนึ่งชุด
- ใช้ workflow เดียวกันกับแกนระบบ: `draft → under_review → approved → active → completed`; `cancelled` และ `archived` เป็นสถานะปลายทาง
- การเผยแพร่ public แยกจาก workflow ภายใน และ **ยังไม่อยู่ใน Stage 1**
- ฟอร์มรอบแรกต้องรองรับโครงการ, วันไป-กลับ, direction, ประเทศ/คู่ความร่วมมือ, หน่วยงานเจ้าของ, ผู้เข้าร่วม, งบประมาณ และเอกสารภายใน
- ข้อมูลนิสิตจากระบบต้นทางและ Excel ใช้ได้เฉพาะผ่าน staging/review; รอบแรกทำ contract และ preview ก่อน ไม่เขียนข้อมูลจริงจากไฟล์โดยตรง
- `staff_mobility`, `staff_official_travel` และ `visiting_delegation` จะต่อยอดจาก core และไม่เปลี่ยน permission boundary

## Import guardrail

ข้อมูล Mobility เดิม (รวมไฟล์ Excel ที่มี 407/408 แถวหรือมากกว่า) ยัง **ไม่ถูกนำเข้า** ในขั้นนี้ ต้องยืนยันการจับคู่ project/case, participant, วันไป-กลับ, ประเภทการเคลื่อนย้าย และแหล่งข้อมูล V2 ก่อนทุกครั้ง ข้อมูล contact องค์กรต่างประเทศห้ามปนกับ import นี้

