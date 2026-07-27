# MOU Preserve / Improve / Retire Matrix

สถานะ: **รอเจ้าของระบบทบทวนก่อนแก้ schema หรือ form เพิ่ม**  
จัดทำ: 27 กรกฎาคม 2569  
Baseline: `docs/LEGACY_FUNCTION_INVENTORY.md`, legacy `Team IROUP/mou.html`, V2 MOU API

เอกสารนี้แปลงความสามารถของ MOU ระบบเดิมเป็นสัญญาการ build ของระบบใหม่
โดยคำว่า **คงไว้** หมายถึงต้องมีความสามารถเทียบเท่า, **ปรับปรุง** หมายถึงต้องมี
ความสามารถเดิมพร้อมกติกา/UX ใหม่ที่ดีกว่า, และ **เลิกใช้** ต้องมีเหตุผลและอนุมัติชัดเจน

## หลักการที่ยืนยันแล้ว

- การกด “เพิ่ม MOU” สร้างได้เพียง `draft`; ห้ามเป็น Active หรือ public โดยอัตโนมัติ
- หากทราบ MOU จากหนังสือก่อนมีข้อมูลองค์กร ให้สร้างองค์กรขั้นต่ำ `pending_verification`
  แล้วกลับมาผูกกับ MOU ได้
- แยกผู้บันทึก, หน่วยงานเจ้าของ ม.พะเยา, และองค์กรคู่ความร่วมมือออกจากกัน
- ผู้ติดต่อองค์กรต่างประเทศเป็นข้อมูลภายใน ไม่อยู่ใน public portal
- ระบบใหม่ยังไม่ตัด capability ของระบบเดิมเพียงเพราะยังไม่มีในหน้าปัจจุบัน

## ข้อสรุปที่ยืนยันแล้ว

| เรื่อง | ข้อสรุป |
|---|---|
| วันสิ้นสุด | ไม่บังคับ เพราะ MOU บางฉบับไม่มีวันหมดอายุ; ถ้ากรอกต้องไม่น้อยกว่าวันเริ่ม |
| คู่สัญญา | รองรับหลายองค์กร และต้องกำหนดองค์กรหลัก (`lead`) เพียงหนึ่งองค์กร |
| หน่วยงาน ม.พะเยา | มีหน่วยงานเจ้าของ (`owner`) หนึ่งหน่วยงาน และเพิ่มหน่วยงานเกี่ยวข้องได้หลายหน่วยงาน |
| ประเทศของ MOU | ดึงจากองค์กร master โดยอัตโนมัติ และเก็บ country snapshot/override พร้อมเหตุผลเพื่อรักษาประวัติย้อนหลัง |
| ไฟล์ MOU | เก็บเป็นข้อมูลภายในเท่านั้น; ไม่มีการเผยแพร่ไฟล์ MOU ใน public portal |
| การลบ | Soft delete ก่อน; System Admin restore ได้เสมอ และไม่มี automatic file purge ในขอบเขตปัจจุบัน |
| Map/กราฟหน่วยงาน | ทำใน phase analytics หลัง form, detail, attachments, list/filter และ export เสร็จ |

## Matrix ความสามารถ

| # | ความสามารถเดิม | การตัดสินใจ | เป้าหมายระบบใหม่ / ข้อกำหนด |
|---:|---|---|---|
| 1 | รายการ MOU พร้อม pagination | ปรับปรุง | Server-side pagination, URL state และไม่โหลดทั้งชุดข้อมูลมาที่ browser |
| 2 | ค้นหาชื่อองค์กร, หน่วยงาน, ประเทศ, ประเภท | คงไว้ | ค้นหาจาก title, เลขที่, partner snapshot/master, owner unit, country, type |
| 3 | กรอง active, ใกล้หมดอายุ, หมดอายุ, ยกเลิก | ปรับปรุง | แยก workflow (`draft`, `under_review`, `published`) จาก lifecycle (`active`, `expiring`, `expired`, `terminated`) และคำนวณ `expiring` จากวันสิ้นสุด |
| 4 | กรองทวีป | คงไว้ | ทวีป derive จากประเทศใน master data; ไม่ให้กรอกทวีปซ้ำใน MOU |
| 5 | กรองช่วงวัน | คงไว้ | เลือกฟิลด์วันเริ่ม, วันสิ้นสุด และช่วงวันที่อย่างชัดเจน |
| 6 | KPI รวม/active/ใกล้หมดอายุ/หมดอายุ/ประเทศ/ทวีป | คงไว้ | KPI ใช้ query เดียวกับ filter ปัจจุบัน และแสดงความหมายของสถานะชัดเจน |
| 7 | แผนที่โลกและ popup ตามประเทศ | ปรับปรุง (phase analytics) | เก็บ latitude/longitude ที่ประเทศ ไม่ผูกกับ form; build หลัง list/detail/files พร้อม ไม่เป็น blocker ของการบันทึก MOU |
| 8 | สรุป/กราฟตามหน่วยงาน ม.พะเยา | ปรับปรุง (phase analytics) | Dashboard/report aggregate ตาม owner unit พร้อม drill-down ไปยังรายการที่กรองแล้ว |
| 9 | เพิ่ม, แก้ไข, ลบ MOU | ปรับปรุง | Draft/review/publish, optimistic concurrency, soft delete และ audit timeline; ไม่ให้ browser เขียนหลายตารางตรง ๆ |
| 10 | หน่วยงานเจ้าของ (`up_unit_id`) | คงไว้ | ต้องมี owner unit หนึ่งหน่วยงานเมื่อส่งตรวจ; รองรับหน่วยงานเกี่ยวข้องหลายหน่วยงานใน relation แยกต่างหาก |
| 11 | ชื่อองค์กรไทย/อังกฤษที่พิมพ์ในฟอร์ม | ปรับปรุง | เลือกจาก master organization เป็นหลัก; สร้างองค์กรขั้นต่ำ inline ได้ และเก็บ snapshot ชื่อ ณ วันทำ MOU เพื่อไม่ให้ประวัติเปลี่ยนตาม master |
| 12 | ประเทศ/ทวีปในฟอร์ม | ปรับปรุง | ประเทศดึงจากองค์กร master และเก็บ country snapshot/override พร้อมเหตุผลเมื่อข้อมูลในหนังสือไม่ตรง master |
| 13 | ประเภท MOU/MOA | คงไว้ | ใช้ controlled value และรองรับ subtype ที่เพิ่มภายหลังโดยไม่ต้องแก้ UI หลัก |
| 14 | ปีงบประมาณคำนวณจากวันเริ่ม | ปรับปรุง | คำนวณอัตโนมัติตามปีงบประมาณไทยจากวันเริ่ม; แสดงผลให้ตรวจและบันทึกค่า snapshot |
| 15 | สถานะ active/expired/cancelled | ปรับปรุง | ผู้สร้างเลือก lifecycle ไม่ได้; publish/terminate/archive เป็น action ตามสิทธิ์และทุก transition มีเหตุผล/audit |
| 16 | `public_visible` | ปรับปรุง | ตั้งได้ในขั้น publish เท่านั้น; public query เห็นเฉพาะ MOU ที่ published + active + visible |
| 17 | `public_file_allowed` | เลิกใช้ | ไฟล์ MOU เป็น internal เท่านั้น; ใช้ signed URL สำหรับผู้มีสิทธิ์ดูภายใน |
| 18 | แนบไฟล์, ดูชื่อ, เปิดไฟล์, ล้าง pending file | คงไว้ | Attachment area มี upload queue, role, size/type validation, preview metadata, remove pending และ audit |
| 19 | เปิดไฟล์ public แต่ปิด download | เลิกใช้ในความหมายเดิม | Browser ป้องกันการดาวน์โหลดไฟล์ที่แสดงได้จริงไม่ได้; ถ้าห้ามดาวน์โหลด ต้องไม่เผยไฟล์ต้นฉบับ และเผยแพร่เฉพาะ metadata/preview ที่อนุมัติ |
| 20 | เปิดรายละเอียด MOU | ปรับปรุง | Detail เป็นศูนย์กลาง: ข้อมูลสัญญา, partners/units, files, public state, lifecycle และ timeline |
| 21 | ลบแบบยืนยัน | ปรับปรุง | Soft delete พร้อมเหตุผล; System Admin restore ได้ และไม่มีการลบไฟล์อัตโนมัติ |
| 22 | Export CSV ของรายการที่กรอง | ปรับปรุง | CSV ต้องมีแน่นอน; XLSX เป็น export มาตรฐานเดียวกัน พร้อมบันทึกผู้ export และ filter ที่ใช้ |
| 23 | แจ้ง MOU ใกล้หมดอายุบน dashboard | คงไว้ | Derived task/query ตาม threshold ที่กำหนด และ deep link ไป filter ที่เกี่ยวข้อง |
| 24 | public list/map | ปรับปรุง | Public DTO แยกจาก admin data; ไม่มี internal note, pending organization, private contact หรือไฟล์ private |
| 25 | Validation: unit, partner, country, start, end และ end >= start | ปรับปรุง | Draft validation เบา; submit validation ครบและต้องกำหนดกติกา “วันสิ้นสุดจำเป็นหรือไม่” ด้านล่าง |

## สัญญาฟอร์ม MOU ที่จะ build หลังอนุมัติ matrix

### Draft

- ชื่อ MOU ไทย
- เลขที่ MOU, ชื่ออังกฤษ, ประเภท, วันสำคัญ และหมายเหตุภายในกรอกเพิ่มเติมได้
- เพิ่ม/เลือก partner แบบขั้นต่ำได้ แต่ยังไม่ถือว่า verified หรือ public
- บันทึกร่างได้โดยไม่เผยแพร่ข้อมูล

### Submit for review

- ชื่อ MOU, ประเภท, owner unit, partner หลัก, ประเทศของ MOU, วันเริ่ม และปีงบประมาณต้องครบ
- ตรวจเลขที่ MOU ซ้ำ, ความสัมพันธ์ของวัน, และข้อมูลองค์กรก่อนส่ง
- วันสิ้นสุดไม่บังคับ; หากกรอกต้องไม่น้อยกว่าวันเริ่ม
- MOU ที่ partner ยัง `pending_verification` ส่งตรวจได้ แต่ publish ไม่ได้จนกว่าจะตรวจองค์กรเสร็จ
- มีไฟล์ฉบับลงนามหรือไม่เป็นกติกา publish (ไม่บังคับใน draft)

### Publish / public

- ผู้มีสิทธิ์ publish เท่านั้นดำเนินการได้
- public payload ไม่คืนข้อมูลผู้ติดต่อองค์กร, internal note, audit detail หรือไฟล์ MOU

## สิทธิ์และผลที่ผู้ใช้เห็น

| Action | Viewer | Editor | Publisher/Office Admin | System Admin |
|---|---:|---:|---:|---:|
| ดูรายการ/รายละเอียดภายใน | ตาม module read | ✓ | ✓ | ✓ |
| บันทึกร่าง/แก้ไข draft | - | ✓ | ✓ | ✓ |
| ส่งตรวจ | - | ✓ | ✓ | ✓ |
| ส่งกลับแก้ไข/เผยแพร่/ซ่อน public/ยุติ | - | - | ✓ | ✓ |
| ลบ/restore | - | - | ตามสิทธิ์ delete | ✓ |
| เห็นข้อมูลผู้ติดต่อองค์กร | - | ตาม permission contacts | ตาม permission contacts | ✓ |

การซ่อนปุ่มเป็นเพียง UX; RPC และ RLS ต้องตรวจสิทธิ์ซ้ำเสมอ

## งานที่จะทำเป็นลำดับหลังอนุมัติ

1. **MOU foundation** — เติม field/relations ที่ matrix อนุมัติ, validation, migration และ RLS/RPC tests
2. **MOU form** — แก้ฟอร์ม create/edit ให้ครบตาม draft/submit rules และ return จากการเพิ่มองค์กร
3. **Detail + attachments** — storage policy, file roles, timeline, review/publish screens
4. **List + export** — filter ครบ, lifecycle derived status, CSV/XLSX
5. **Analytics + public** — KPI, dashboard alert, unit chart, map และ public DTO

## Implementation checklist ที่อนุมัติแล้ว

1. เพิ่ม snapshot ประเทศ/ชื่อคู่สัญญา, multi-partner และ multi-unit contract ให้ MOU RPC
2. คำนวณปีงบประมาณไทยจากวันเริ่ม และตรวจข้อมูลก่อนส่งตรวจ/เผยแพร่
3. เพิ่ม soft delete/restore พร้อม audit; การลบไฟล์อัตโนมัติอยู่นอกขอบเขตปัจจุบัน
4. รัน migration และ RLS/RPC tests ก่อนแก้ form
5. ขยายฟอร์ม MOU ให้เลือกหลายองค์กร/หน่วยงาน, เลือก lead/owner และแสดงประเทศที่ดึงมา
6. ทำ attachment worker, detail, list/filter/export แล้วจึงทำ map/analytics
