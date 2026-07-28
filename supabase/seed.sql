-- Seed script for iROUP Next Local Database
-- Contains real partner organizations, countries, UP units, and sample MOUs

-- 1. Insert Countries
insert into public.countries (id, iso2, iso3, name_th, name_en, continent_code) values
('20000000-0000-0000-0000-000000000001', 'TH', 'THA', 'ประเทศไทย', 'Thailand', 'AS'),
('21000000-0000-0000-0000-000000000001', 'JP', 'JPN', 'ญี่ปุ่น', 'Japan', 'AS'),
('c1000000-0000-0000-0000-000000000003', 'CN', 'CHN', 'จีน', 'China', 'AS'),
('c1000000-0000-0000-0000-000000000004', 'TW', 'TWN', 'ไต้หวัน', 'Taiwan', 'AS'),
('42000000-0000-0000-0000-000000000001', 'VN', 'VNM', 'เวียดนาม', 'Vietnam', 'AS'),
('b2000000-0000-0000-0000-000000000001', 'KR', 'KOR', 'เกาหลีใต้', 'South Korea', 'AS'),
('c1000000-0000-0000-0000-000000000007', 'CZ', 'CZE', 'สาธารณรัฐเช็ก', 'Czech Republic', 'EU'),
('c1000000-0000-0000-0000-000000000008', 'FR', 'FRA', 'ฝรั่งเศส', 'France', 'EU'),
('c1000000-0000-0000-0000-000000000009', 'US', 'USA', 'สหรัฐอเมริกา', 'United States', 'NA'),
('c1000000-0000-0000-0000-000000000010', 'AU', 'AUS', 'ออสเตรเลีย', 'Australia', 'OC'),
('c1000000-0000-0000-0000-000000000011', 'LA', 'LAO', 'ลาว', 'Laos', 'AS'),
('c1000000-0000-0000-0000-000000000012', 'ID', 'IDN', 'อินโดนีเซีย', 'Indonesia', 'AS'),
('c1000000-0000-0000-0000-000000000013', 'GB', 'GBR', 'สหราชอาณาจักร', 'United Kingdom', 'EU'),
('c1000000-0000-0000-0000-000000000014', 'DE', 'DEU', 'เยอรมนี', 'Germany', 'EU'),
('c1000000-0000-0000-0000-000000000015', 'SG', 'SGP', 'สิงคโปร์', 'Singapore', 'AS')
on conflict (id) do update set
  name_th = excluded.name_th,
  name_en = excluded.name_en,
  continent_code = excluded.continent_code;

-- 2. Insert UP Organization Units
insert into public.organization_units (id, code, name_th, name_en) values
('b1000000-0000-0000-0000-000000000001', 'ICT', 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร', 'School of Information and Communication Technology'),
('b1000000-0000-0000-0000-000000000002', 'MED', 'คณะแพทยศาสตร์', 'School of Medicine'),
('b1000000-0000-0000-0000-000000000003', 'ENG', 'คณะวิศวกรรมศาสตร์', 'School of Engineering'),
('b1000000-0000-0000-0000-000000000004', 'HUM', 'คณะมนุษยศาสตร์และสังคมศาสตร์', 'School of Humanities'),
('b1000000-0000-0000-0000-000000000005', 'ARCH', 'คณะสถาปัตยกรรมศาสตร์และศิลปกรรมศาสตร์', 'School of Architecture and Fine Arts'),
('b1000000-0000-0000-0000-000000000006', 'AGRI', 'คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ', 'School of Agriculture and Natural Resources'),
('b1000000-0000-0000-0000-000000000007', 'DENT', 'คณะทันตแพทยศาสตร์', 'School of Dentistry'),
('b1000000-0000-0000-0000-000000000008', 'DLA', 'กองพัฒนาภาษาและกิจการต่างประเทศ', 'Division of Language and International Affairs')
on conflict (id) do update set
  name_th = excluded.name_th,
  name_en = excluded.name_en;

-- 3. Insert Real Foreign Partner Organizations
insert into public.partner_organizations (id, name_en, name_th, organization_type, country_id, verification_status) values
('b2000000-0000-0000-0000-000000000001', 'University of Architecture Ho Chi Minh City (UAH)', 'มหาวิทยาลัยสถาปัตยกรรมโฮจิมินห์', 'มหาวิทยาลัย', '42000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000002', 'Industrial University of Ho Chi Minh City (IUH)', 'มหาวิทยาลัยอุตสาหกรรมโฮจิมินห์', 'มหาวิทยาลัย', '42000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000003', 'Brno University of Technology - Faculty of Fine Arts (BUT)', 'มหาวิทยาลัยเทคโนโลยีเบอร์โน', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000007', 'verified'),
('b2000000-0000-0000-0000-000000000004', 'Taipei National University of the Arts', 'มหาวิทยาลัยศิลปะแห่งชาติไทเป', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000004', 'verified'),
('b2000000-0000-0000-0000-000000000005', 'Shanghai Open University (SOU)', 'มหาวิทยาลัยเปิดเซี่ยงไฮ้', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000003', 'verified'),
('b2000000-0000-0000-0000-000000000006', 'Josai University', 'มหาวิทยาลัยโจไซ', 'มหาวิทยาลัย', '21000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000007', 'Czech University of Life Sciences Prague (CZU)', 'มหาวิทยาลัยเกษตรศาสตร์ปราก', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000007', 'verified'),
('b2000000-0000-0000-0000-000000000008', 'National Chung Hsing University (NCHU)', 'มหาวิทยาลัยแห่งชาติจงซิ่ง', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000004', 'verified'),
('b2000000-0000-0000-0000-000000000009', 'Campus France Thailand / French Embassy in Thailand', 'สถานเอกอัครราชทูตฝรั่งเศสประจำประเทศไทย', 'รัฐบาล/องค์กรระหว่างประเทศ', 'c1000000-0000-0000-0000-000000000008', 'verified'),
('b2000000-0000-0000-0000-000000000010', 'Global Campuses Foundation, USA', 'มูลนิธิโกลบอลแคมปัส สหรัฐอเมริกา', 'NGO / มูลนิธิ', 'c1000000-0000-0000-0000-000000000009', 'verified'),
('b2000000-0000-0000-0000-000000000011', 'Andong National University', 'มหาวิทยาลัยแห่งชาติอันดง', 'มหาวิทยาลัย', 'b2000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000012', 'Faculty of Dentistry Niigata University', 'คณะทันตแพทยศาสตร์ มหาวิทยาลัยนีงาตะ', 'มหาวิทยาลัย', '21000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000013', 'World Federation for Laser Dentistry (WFLD)', 'สหพันธ์ทันตกรรมเลเซอร์โลก', 'NGO / มูลนิธิ', 'c1000000-0000-0000-0000-000000000010', 'verified'),
('b2000000-0000-0000-0000-000000000014', 'Chitose Institute of Science and Technology', 'สถาบันวิทยาศาสตร์และเทคโนโลยีชิโตเสะ', 'มหาวิทยาลัย', '21000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000015', 'Iwate University', 'มหาวิทยาลัยอิวาเตะ', 'มหาวิทยาลัย', '21000000-0000-0000-0000-000000000001', 'verified'),
('b2000000-0000-0000-0000-000000000016', 'Luang Prabang Teacher Training College', 'วิทยาลัยครูหลวงพระบาง', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000011', 'verified'),
('b2000000-0000-0000-0000-000000000017', 'Bali Tourism Institute, Indonesia', 'สถาบันการท่องเที่ยวบาหลี', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000012', 'verified'),
('b2000000-0000-0000-0000-000000000018', 'University of Cambridge', 'มหาวิทยาลัยเคมบริดจ์', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000013', 'verified'),
('b2000000-0000-0000-0000-000000000019', 'National University of Singapore (NUS)', 'มหาวิทยาลัยแห่งชาติสิงคโปร์', 'มหาวิทยาลัย', 'c1000000-0000-0000-0000-000000000015', 'verified')
on conflict (id) do update set
  name_en = excluded.name_en,
  verification_status = excluded.verification_status;

-- 4. Insert Seed System Admin Profile
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'a1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'thratip.so@up.ac.th',
  extensions.crypt('password123', extensions.gen_salt('bf', 10)),
  now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}', '{"full_name":"Thratip (System Admin)"}', now(), now()
) on conflict (id) do update set
  encrypted_password = excluded.encrypted_password,
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change = '';

insert into public.profiles (id, email, display_name)
values ('a1000000-0000-0000-0000-000000000001', 'thratip.so@up.ac.th', 'Thratip (System Admin)')
on conflict do nothing;

insert into private.user_roles (user_id, role)
values ('a1000000-0000-0000-0000-000000000001', 'system_admin')
on conflict do nothing;

insert into private.module_permissions (user_id, module, can_view, can_create, can_update, can_publish, can_delete) values
('a1000000-0000-0000-0000-000000000001', 'mou', true, true, true, true, true)
on conflict (user_id, module) do update set can_view = true, can_create = true, can_update = true, can_publish = true, can_delete = true;

-- 5. Insert Sample MOUs
insert into public.agreements (
  id, agreement_number, title_th, title_en, agreement_type, start_date, end_date, signed_date, fiscal_year, status, publication_status, workflow_status, public_visible, created_by
) values
(
  'b3000000-0000-0000-0000-000000000001',
  'MOU-UP-UAH-2567/01',
  'บันทึกความเข้าใจความร่วมมือทางวิชาการและวิจัยด้านสถาปัตยกรรมและการออกแบบ',
  'Memorandum of Understanding for Academic and Research Cooperation in Architecture',
  'MOU',
  '2024-06-01',
  '2029-05-31',
  '2024-05-20',
  2567,
  'active',
  'published',
  'active',
  true,
  'a1000000-0000-0000-0000-000000000001'
),
(
  'b3000000-0000-0000-0000-000000000002',
  'MOU-UP-JOSAI-2568/02',
  'ข้อตกลงความร่วมมือการแลกเปลี่ยนนิสิตและบุคลากรวิจัยกับมหาวิทยาลัยโจไซ ญี่ปุ่น',
  'Agreement on Student and Staff Academic Exchange with Josai University Japan',
  'MOU',
  '2025-01-15',
  '2030-01-14',
  '2025-01-10',
  2568,
  'active',
  'published',
  'active',
  true,
  'a1000000-0000-0000-0000-000000000001'
),
(
  'b3000000-0000-0000-0000-000000000003',
  'MOU-UP-BUT-2569/03',
  'บันทึกข้อตกลงความร่วมมือทางศิลปะและการออกแบบร่วมกับ Brno University of Technology',
  'Memorandum of Agreement on Fine Arts Cooperation with Brno University of Technology',
  'MOA',
  '2026-02-01',
  '2028-01-31',
  '2026-01-25',
  2569,
  'active',
  'published',
  'active',
  true,
  'a1000000-0000-0000-0000-000000000001'
),
(
  'b3000000-0000-0000-0000-000000000004',
  'MOU-UP-SOU-2569/04',
  'ข้อตกลงความร่วมมือการจัดการเรียนการสอนแบบออนไลน์ร่วมกับมหาวิทยาลัยเปิดเซี่ยงไฮ้',
  'MOU on Online Learning and Higher Education Collaboration with Shanghai Open University',
  'MOU',
  '2026-03-10',
  '2029-03-09',
  '2026-03-01',
  2569,
  'active',
  'published',
  'active',
  true,
  'a1000000-0000-0000-0000-000000000001'
),
(
  'b3000000-0000-0000-0000-000000000005',
  'MOU-UP-NIIGATA-2566/05',
  'บันทึกข้อตกลงความร่วมมือทางการแพทย์และทันตกรรมกับมหาวิทยาลัยนีงาตะ',
  'Agreement for Academic and Clinical Cooperation with Niigata University',
  'MOU',
  '2023-04-01',
  '2026-08-31',
  '2023-03-25',
  2566,
  'active',
  'published',
  'active',
  true,
  'a1000000-0000-0000-0000-000000000001'
),
(
  'b3000000-0000-0000-0000-000000000006',
  'MOU-UP-NUS-2569/06',
  'โครงการความร่วมมือวิจัยนวัตกรรมเทคโนโลยีสารสนเทศและปัญญาประดิษฐ์กับ NUS',
  'Research Collaboration Agreement in IT and AI Innovation with National University of Singapore',
  'MOA',
  '2026-05-01',
  '2031-04-30',
  '2026-04-15',
  2569,
  'draft',
  'draft',
  'under_review',
  false,
  'a1000000-0000-0000-0000-000000000001'
),
(
  'b3000000-0000-0000-0000-000000000007',
  'MOU-UP-CAMBRIDGE-2569/07',
  'ร่างบันทึกความเข้าใจด้านการแลกเปลี่ยนบุคลากรวิจัยร่วมกับ University of Cambridge',
  'Draft Memorandum of Understanding on Research Staff Exchange with Cambridge',
  'MOU',
  '2026-07-01',
  '2031-06-30',
  null,
  2569,
  'draft',
  'draft',
  'draft',
  false,
  'a1000000-0000-0000-0000-000000000001'
)
on conflict (id) do update set
  title_th = excluded.title_th,
  status = excluded.status,
  workflow_status = excluded.workflow_status;

-- 6. Link Agreements to Partners
insert into public.agreement_partners (
  agreement_id, partner_organization_id, is_lead, partner_name_th_snapshot, partner_name_en_snapshot, country_name_th_snapshot, country_name_en_snapshot
) values
('b3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', true, 'มหาวิทยาลัยสถาปัตยกรรมโฮจิมินห์', 'University of Architecture Ho Chi Minh City (UAH)', 'เวียดนาม', 'Vietnam'),
('b3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000006', true, 'มหาวิทยาลัยโจไซ', 'Josai University', 'ญี่ปุ่น', 'Japan'),
('b3000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', true, 'มหาวิทยาลัยเทคโนโลยีเบอร์โน', 'Brno University of Technology - Faculty of Fine Arts (BUT)', 'สาธารณรัฐเช็ก', 'Czech Republic'),
('b3000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000005', true, 'มหาวิทยาลัยเปิดเซี่ยงไฮ้', 'Shanghai Open University (SOU)', 'จีน', 'China'),
('b3000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000012', true, 'คณะทันตแพทยศาสตร์ มหาวิทยาลัยนีงาตะ', 'Faculty of Dentistry Niigata University', 'ญี่ปุ่น', 'Japan'),
('b3000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000019', true, 'มหาวิทยาลัยแห่งชาติสิงคโปร์', 'National University of Singapore (NUS)', 'สิงคโปร์', 'Singapore'),
('b3000000-0000-0000-0000-000000000007', 'b2000000-0000-0000-0000-000000000018', true, 'มหาวิทยาลัยเคมบริดจ์', 'University of Cambridge', 'สหราชอาณาจักร', 'United Kingdom')
on conflict do nothing;

-- 7. Link Agreements to UP Units
insert into public.agreement_units (
  agreement_id, organization_unit_id, is_owner
) values
('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', true),
('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', true),
('b3000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', true),
('b3000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', true),
('b3000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000007', true),
('b3000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001', true),
('b3000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000008', true)
on conflict do nothing;

-- 8. Workflow Events
insert into public.agreement_workflow_events (
  id, agreement_id, action, from_status, to_status, note, created_by
) values
('b6000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'created', null, 'draft', 'สร้างร่าง MOU สถาปัตยกรรมโฮจิมินห์', 'a1000000-0000-0000-0000-000000000001'),
('b6000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000001', 'published', 'under_review', 'active', 'อนุมัติลงนามและเปิดใช้งานสัญญาสมบูรณ์', 'a1000000-0000-0000-0000-000000000001'),
('b6000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000002', 'published', 'under_review', 'active', 'อนุมัติสัญญาแลกเปลี่ยนนิสิตโจไซ', 'a1000000-0000-0000-0000-000000000001'),
('b6000000-0000-0000-0000-000000000004', 'b3000000-0000-0000-0000-000000000006', 'submitted_for_review', 'draft', 'under_review', 'ส่งให้กองต่างประเทศและคณะ ICT ตรวจสอบ', 'a1000000-0000-0000-0000-000000000001')
on conflict do nothing;
