export type ContentKind = "scholarship" | "news";
export type ContentChannel = "website" | "facebook";
export type EditorialFacts = {
  subject: string;
  key_points: string;
  category: string;
  scholarship_type: string;
  audience: "student" | "staff" | "both" | "external";
  funding_type: string;
  study_level: string;
  eligibility: string;
  detail_url: string;
  apply_url: string;
};
export type ContentLocale = { title: string; summary: string; body: string; coverage: string };
export type ContentLocales = { th: ContentLocale; en: ContentLocale };
export type DeadlineKind = "university_internal" | "thai_nominating_body" | "scholarship_owner";
export type EditorialDeadline = {
  kind: DeadlineKind;
  applicability: "specified" | "not_applicable";
  reason: string;
  cycle_key: string;
  raw_text: string;
  precision: "date_only" | "local_datetime" | "instant";
  date: string | null;
  time: string | null;
  timezone: string | null;
  instant: string | null;
  source_verification_id: string | null;
};
export type SourceInput = {
  title: string;
  publisher: string;
  requested_url: string;
  final_url: string;
  observed_on: string;
  valid_until: string;
  official: boolean;
  result: "verified" | "unverified";
  note: string;
};
export type SourceVerification = SourceInput & { id: string; created_by: string; created_at: string };
export type ContentSnapshot = {
  id: string;
  facts: EditorialFacts;
  source_verification_ids: string[];
  deadlines: EditorialDeadline[];
  digest: string;
  created_at: string;
};
export type ContentVersion = {
  id: string;
  channel: ContentChannel;
  version_number: number;
  snapshot_id: string;
  locales: ContentLocales;
  state: "draft" | "under_review" | "approved" | "returned" | "stale";
  is_latest: boolean;
  digest: string;
  created_at: string;
};
export type ContentReview = { id: string; version_id: string; decision: "submitted" | "approved" | "returned"; note: string; created_at: string; created_by: string };
export type ContentDetail = {
  kind: ContentKind;
  record_id: string;
  baseline: { title_th: string; publication_status: string; public_visible: boolean; facts: EditorialFacts; locales: ContentLocales };
  work_item: { id: string; row_version: number; current_snapshot_id: string | null } | null;
  snapshot: ContentSnapshot | null;
  sources: SourceVerification[];
  versions: ContentVersion[];
  reviews: ContentReview[];
};
export type ContentListResult = {
  rows: Array<{ id: string; title_th: string; updated_at: string; publication_status: string; work_item_id: string | null; state: "not_started" | ContentVersion["state"] }>;
  total: number;
  page: number;
  page_size: 20;
};
type ExistingCommand = { work_item_id: string; expected_revision: number; idempotency_key: string };
export type ContentCommand =
  | { op: "open"; kind: ContentKind; record_id: string | null; title_th: string; idempotency_key: string }
  | (ExistingCommand & { op: "record_source"; source: SourceInput })
  | (ExistingCommand & { op: "save_draft"; channel: ContentChannel; facts: EditorialFacts; source_verification_ids: string[]; deadlines: EditorialDeadline[]; locales: ContentLocales })
  | (ExistingCommand & { op: "review"; version_id: string; decision: "submit" | "approve" | "return"; note: string });
export type ContentCommandResult = { work_item_id: string; record_id: string; row_version: number; version_id?: string; source_verification_id?: string };
export type ContentActionState = { error?: string; code?: string; result?: ContentCommandResult; success?: boolean };

export const deadlineLabels: Record<DeadlineKind, string> = {
  university_internal: "ภายในมหาวิทยาลัย",
  thai_nominating_body: "หน่วยงานเสนอชื่อของไทย",
  scholarship_owner: "เจ้าของทุน",
};
export const contentStateLabels = {
  not_started: "ยังไม่ได้เริ่มจัดทำ", draft: "ร่าง", under_review: "รอตรวจสอบ",
  approved: "อนุมัติเนื้อหาแล้ว", returned: "ส่งกลับแก้ไข", stale: "ต้องตรวจใหม่",
};
