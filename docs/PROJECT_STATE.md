# iROUP Next: Project State

อัปเดตล่าสุด: 27 กรกฎาคม 2569  
สถานะ: ระบบพื้นฐาน, App Shell และหน้า MOU รายการแรกพร้อมใช้งานบน Local

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
- เพิ่ม shared App Shell components สำหรับ Sidebar และ Workspace Chrome
- เพิ่มหน้า `/mou` สำหรับรายการ MOU พร้อมค้นหา กรองสถานะ และ empty state

## สถานะฐานข้อมูลและความปลอดภัย

- Supabase production migrations ใช้งานถึง:
  - `20260726185603_admin_user_management`
  - `20260726185750_harden_admin_user_api`
- pgTAP database tests ผ่านทั้งหมด 118 tests
- Supabase database lint ไม่พบ schema error
- Security Advisor ไม่พบคำเตือนจาก Admin RPC ชุดใหม่
- ยังมีคำเตือนระดับ Project Setting เรื่อง Leaked Password Protection
  ซึ่งไม่กระทบการทำงานปัจจุบันและควรเปิดก่อน Production launch

## สถานะ Frontend

- Local URL: `http://localhost:3000`
- User management: `http://localhost:3000/settings/users`
- MOU list: `http://localhost:3000/mou`
- ESLint ผ่าน
- TypeScript ผ่าน
- Next.js production build ผ่าน
- Playwright regression tests ผ่าน 5/5
- Browser QA ผ่านทั้งการค้นหา เปิด Permission panel
  การล็อกสิทธิ์บัญชีตัวเอง และ viewport 390px
- Browser console ไม่พบ error หรือ warning ที่เกี่ยวข้อง

## GitHub

- Repository: `Peachylochy/iroup-next`
- Main includes PR #1 merge commit: `1dcfb4a Add secure user permission management`
- Current feature branch: `agent/mou-app-shell`
- Current work: shared App Shell และ MOU list screen

## จุดเริ่มงานครั้งถัดไป

1. ตรวจและ Merge PR ของ App Shell/MOU เข้า `main`
2. ทำหน้าสร้าง/แก้ไข MOU และหน้าองค์กรคู่ความร่วมมือ
3. ต่อหน้าผู้ติดต่อองค์กรต่างประเทศกับฐานข้อมูล private ที่เตรียมไว้
4. วาง Import workflow สำหรับข้อมูล Excel/CSV หลังหน้ารายการมาตรฐานพร้อม

## ข้อควรจำ

- ห้ามใส่ Database password, service role key หรือข้อมูลผู้ติดต่อจริงใน GitHub
- การอนุญาตสิทธิ์ต้องบังคับใช้ที่ PostgreSQL/RLS ไม่พึ่งการซ่อนปุ่มใน React
- ข้อมูลผู้ติดต่อองค์กรต่างประเทศเป็นข้อมูลภายในและห้ามเปิด public
- ก่อนเริ่มงานครั้งถัดไปให้ตรวจ `git status`, Supabase migration list
  และสถานะ PR ล่าสุดก่อนเสมอ

