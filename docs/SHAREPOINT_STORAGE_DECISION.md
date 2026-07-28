# SharePoint Storage Decision

สถานะ: พื้นที่จัดเก็บพร้อมแล้ว; รอแนวทางการเชื่อม Microsoft Graph จาก CITCOMS  
อัปเดต: 28 กรกฎาคม 2569

## การตัดสินใจ

ไฟล์เอกสารจริงของ iROUP จะเก็บใน Microsoft SharePoint Online ของมหาวิทยาลัยพะเยา ส่วน Supabase ยังคงเป็น source of truth สำหรับข้อมูล MOU, สิทธิ์, workflow และ metadata ของไฟล์

| เรื่อง | ข้อตกลง |
| --- | --- |
| SharePoint Site | `https://liveupac.sharepoint.com/iroup` (`iROUP Portal`) |
| Document Library | `iROUP MOU Internal Documents` |
| ข้อมูลที่เก็บ | PDF, Word, ภาพ และหลักฐาน MOU ภายใน |
| ข้อมูลที่ไม่เก็บ | MOU structured data, workflow, user roles, contact data และ secrets |
| การเผยแพร่ | ไม่มี public link; MOU files เป็น internal only |
| สิทธิ์ Site | unique permissions; Owners = ผู้ดูแล, Members = เจ้าหน้าที่ที่จัดการเอกสาร, Visitors = ว่างไว้ก่อน |
| Sensitivity label | ยังไม่ตั้งค่า AIP encryption จนกว่าจะยืนยันว่า compatible กับ app integration |

## สถานะการเชื่อมระบบ

ระบบ iROUP ปัจจุบันยังใช้ Supabase Storage สำหรับ attachment flow บน Local เท่านั้น การอัปโหลดจากหน้า MOU ไปยัง SharePoint อัตโนมัติ **ยังไม่ได้ implement**

เจ้าของระบบได้ส่งคำขอถึง CITCOMS แล้ว เพื่อขอคำแนะนำ/อนุญาตการเชื่อม Microsoft Graph แบบจำกัดสิทธิ์เฉพาะ SharePoint Site นี้ โดยไม่มี public access

ห้าม commit Tenant ID, Client ID, Client Secret, certificate หรือ token ลง Git หรือส่งผ่านแชต

## แผนเมื่อได้รับคำตอบ

1. ยืนยันรูปแบบ auth ที่ CITCOMS อนุมัติ (app-only `Sites.Selected` เป็นเป้าหมาย; ใช้แนวทางที่ CITCOMS กำหนดเป็นหลัก)
2. เก็บ credentials เฉพาะ environment ของ server/VPS
3. ทำ storage provider `sharepoint` ฝั่ง server: upload session, download stream, unlink และ audit
4. เพิ่ม metadata provider, external item ID และ library/site reference ใน `assets`
5. ย้าย MOU attachment UI ให้ใช้ provider นี้ พร้อม RLS/role tests และ browser QA
6. ทำ import เอกสารเดิมหลังมี mapping ที่ตรวจสอบได้; ห้ามผูกไฟล์ที่อัปโหลดมือโดยเดา

## ทางเลือกชั่วคราว

สามารถอัปโหลดไฟล์เข้าห้องสมุด SharePoint ด้วยมือได้ทันที แต่ iROUP จะยังไม่เห็นหรือผูกไฟล์นั้นกับ MOU จนกว่าจะมี integration หรือฟังก์ชันเก็บ external reference ที่ผ่านการออกแบบแล้ว

