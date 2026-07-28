# MOU Analytics Scope

สถานะ: พร้อมเริ่มหลัง MOU core เสร็จสมบูรณ์  
อ้างอิง: `MOU_PRESERVE_IMPROVE_RETIRE_MATRIX.md`, `MOU_WRITE_WORKFLOW.md`

## เป้าหมาย

ให้เจ้าหน้าที่ติดตามภาพรวม MOU และงานต่ออายุได้จากข้อมูลจริง โดยคลิกจากตัวเลขหรือกราฟไปยังรายการ MOU ที่กรองไว้แล้วได้ทันที

Analytics เป็นส่วนต่อยอดของ MOU ไม่ใช่เงื่อนไขของการเพิ่มหรือแก้ไข MOU และไม่เปิดข้อมูลภายในสู่สาธารณะ

## ขอบเขต Phase MOU Analytics

| พื้นที่ | รายการ | พฤติกรรม |
| --- | --- | --- |
| Dashboard เจ้าหน้าที่ | จำนวนทั้งหมด, ใช้งานอยู่, ใกล้หมดอายุ, หมดอายุ, รอตรวจ | ใช้ query เดียวกับสถานะในรายการ MOU และ drill-down ได้ |
| Renewal queue | MOU ที่มีวันสิ้นสุดและเข้าเกณฑ์เตือน | ตั้งค่า threshold ในระบบภายหลัง; MOU ที่ไม่กำหนดวันสิ้นสุดไม่ถูกนับเป็นหมดอายุ |
| หน่วยงาน ม.พะเยา | จำนวน MOU ตาม owner unit | เลือกหน่วยงานแล้วเปิด `/mou` พร้อม filter เดียวกัน |
| ประเทศ/ภูมิภาค | จำนวน MOU ตาม country snapshot | ใช้ country snapshot เพื่อให้รายงานในอดีตไม่เปลี่ยนตาม master data |
| รายงาน | CSV/XLSX จาก filter ที่ใช้อยู่ | ไม่มีข้อมูลผู้ติดต่อ, internal note หรือไฟล์แนบใน export มาตรฐาน |

## ขอบเขตที่ไม่ทำใน Admin รอบนี้

- ไม่มี Interactive World Map ในหน้า Admin
- ไม่มีการแสดงหรือดาวน์โหลดไฟล์ MOU ใน public portal
- ไม่มีข้อมูลผู้ติดต่อองค์กรต่างประเทศ, internal note หรือข้อมูลส่วนบุคคลใน chart/export
- ไม่มี scheduled email หรือ background worker จนกว่าจะกำหนดนโยบายแจ้งเตือนและผู้รับผิดชอบ

## Public Portal ภายหลัง

แผนที่โลกและ public summary ทำเป็น Public DTO แยกต่างหากในรอบ Public Portal เท่านั้น โดยเปิดได้เฉพาะ MOU ที่ `published`, ยังมีผลบังคับใช้ และอนุญาตเผยแพร่แล้ว รวมทั้งไม่ส่งไฟล์หรือข้อมูลภายในไปยัง client

## เกณฑ์พร้อมเริ่ม

1. ใช้ lifecycle/workflow เดียวกับ MOU list และมี test ของ query aggregate
2. ทุก card/chart ต้อง deep-link กลับรายการที่ filter ได้จริง
3. ตรวจ RLS ว่า Viewer ที่ไม่มีสิทธิ์ MOU ไม่เห็น aggregate ภายใน
4. ตรวจ browser QA และ `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd build`

