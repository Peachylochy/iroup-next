import { describe, expect, it } from "vitest";

import { commandResultSchema, commandSchema, deadlineSchema, detailSchema, factsSchema, listSchema, sourceSchema } from "./schema";
import type { ContentDetail, ContentLocales, EditorialDeadline, EditorialFacts, SourceInput } from "./types";

const recordId = "7c10bf50-c4d4-4ed9-9bb9-103096bd6d10";
const workItemId = "7c10bf50-c4d4-4ed9-9bb9-103096bd6d11";
const requestId = "7c10bf50-c4d4-4ed9-9bb9-103096bd6d12";
const sourceId = "7c10bf50-c4d4-4ed9-9bb9-103096bd6d13";

function facts(): EditorialFacts {
  return { subject: "ทุนวิจัย", key_points: "เปิดรับผู้สมัครตามประกาศ", category: "ทุน", scholarship_type: "research", audience: "staff", funding_type: "grant", study_level: "doctoral", eligibility: "บุคลากร", detail_url: "https://example.org/scholarship", apply_url: "" };
}
function locales(): ContentLocales {
  return { th: { title: "ทุนวิจัย", summary: "", body: "", coverage: "" }, en: { title: "", summary: "", body: "", coverage: "" } };
}
function deadline(): EditorialDeadline {
  return { kind: "scholarship_owner", applicability: "specified", reason: "", cycle_key: "2028", raw_text: "ปิดรับ 29 กุมภาพันธ์ 2028", precision: "date_only", date: "2028-02-29", time: null, timezone: null, instant: null, source_verification_id: sourceId };
}
function source(): SourceInput {
  return { title: "Official announcement", publisher: "Research institution", requested_url: "https://example.org/announcement", final_url: "https://example.org/announcement", observed_on: "2026-10-21", valid_until: "2026-11-21", official: true, result: "verified", note: "Human checked the announcement" };
}
function draft() {
  return { op: "save_draft", work_item_id: workItemId, expected_revision: 1, idempotency_key: requestId, channel: "website", facts: facts(), source_verification_ids: [sourceId], deadlines: [], locales: locales() };
}
function detail(): ContentDetail {
  return { kind: "scholarship", record_id: recordId, baseline: { title_th: "ทุนเดิม", publication_status: "draft", public_visible: false, facts: facts(), locales: locales() }, work_item: null, snapshot: null, sources: [], versions: [], reviews: [] };
}

describe("deadline authoring contracts", () => {
  it("preserves a real leap day and the source's date-only precision without inventing a time", () => {
    expect(deadlineSchema.parse(deadline())).toEqual(deadline());
  });

  it.each(["2027-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-01", "2026-1-02"])("rejects the impossible or ambiguous calendar date %s", (date) => {
    expect(deadlineSchema.safeParse({ ...deadline(), date }).success).toBe(false);
  });

  it.each([
    { time: "17:00" }, { timezone: "Asia/Bangkok" }, { instant: "2028-02-29T17:00:00+07:00" },
  ])("rejects invented time information on a date-only deadline (%j)", (extra) => {
    expect(deadlineSchema.safeParse({ ...deadline(), ...extra }).success).toBe(false);
  });

  it("allows a local time whose timezone has not yet been established without normalizing an instant", () => {
    const input = { ...deadline(), precision: "local_datetime", time: "17:30", timezone: null };
    expect(deadlineSchema.parse(input)).toEqual(input);
  });

  it.each([
    { time: null }, { time: "24:00" }, { time: "12:60" }, { time: "17:00", timezone: "Unknown/Invented" },
    { time: "17:00", instant: "2028-02-29T10:00:00Z" },
  ])("rejects incomplete or contradictory local date/time values (%j)", (extra) => {
    expect(deadlineSchema.safeParse({ ...deadline(), precision: "local_datetime", ...extra }).success).toBe(false);
  });

  it.each(["2028-02-29T17:00:00+07:00", "2028-02-29T10:00:00Z"])("accepts an explicit instant unchanged: %s", (instant) => {
    const input = { ...deadline(), precision: "instant", date: null, instant };
    expect(deadlineSchema.parse(input)).toEqual(input);
  });

  it.each(["2028-02-29T17:00:00", "2027-02-29T17:00:00+07:00", "2028-02-29"])("rejects an instant without a real date and explicit offset: %s", (instant) => {
    expect(deadlineSchema.safeParse({ ...deadline(), precision: "instant", date: null, instant }).success).toBe(false);
  });

  it("requires a reason and no misleading date fields when a deadline level does not apply", () => {
    const input = { ...deadline(), applicability: "not_applicable", reason: "สมัครโดยตรงกับเจ้าของทุน", raw_text: "", date: null, source_verification_id: null };
    expect(deadlineSchema.parse(input)).toEqual(input);
    expect(deadlineSchema.safeParse({ ...input, reason: " " }).success).toBe(false);
    expect(deadlineSchema.safeParse({ ...input, date: "2028-02-29" }).success).toBe(false);
    expect(deadlineSchema.safeParse({ ...input, source_verification_id: sourceId }).success).toBe(false);
  });

  it("requires raw wording for a specified deadline and rejects duplicate levels in one snapshot", () => {
    expect(deadlineSchema.safeParse({ ...deadline(), raw_text: " " }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), deadlines: [deadline(), deadline()] }).success).toBe(false);
  });
});

describe("manual source and command validation", () => {
  it("preserves an explicitly unverified, nonofficial manual observation", () => {
    const input = { ...source(), official: false, result: "unverified" };
    expect(sourceSchema.parse(input)).toEqual(input);
  });

  it.each(["javascript:alert(1)", "data:text/html,example", "file:///C:/private.txt", "https://person:secret@example.org/source", "https://person@example.org/source", "/relative/source"])("rejects unsafe or credential-bearing source URL %s", (url) => {
    expect(sourceSchema.safeParse({ ...source(), requested_url: url }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...source(), final_url: url }).success).toBe(false);
    expect(factsSchema.safeParse({ ...facts(), detail_url: url }).success).toBe(false);
    expect(factsSchema.safeParse({ ...facts(), apply_url: url }).success).toBe(false);
  });

  it("rejects impossible observation dates and review dates before the observation", () => {
    expect(sourceSchema.safeParse({ ...source(), observed_on: "2026-02-30" }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...source(), valid_until: "2026-10-20" }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...source(), valid_until: source().observed_on }).success).toBe(true);
  });

  it("requires a title for a new record but lets an existing record derive its identity", () => {
    const open = { op: "open", kind: "news", record_id: null, title_th: "เรื่องใหม่", idempotency_key: requestId };
    expect(commandSchema.parse(open)).toEqual(open);
    expect(commandSchema.safeParse({ ...open, title_th: "  " }).success).toBe(false);
    expect(commandSchema.safeParse({ ...open, record_id: recordId, title_th: "" }).success).toBe(true);
    expect(commandSchema.safeParse({ ...open, record_id: "not-a-uuid" }).success).toBe(false);
    expect(commandSchema.safeParse({ ...open, kind: "events" }).success).toBe(false);
  });

  it("allows unfinished bilingual copy in a draft without filling or translating the missing locale", () => {
    const input = draft();
    expect(commandSchema.parse(input)).toEqual(input);
    expect(commandSchema.safeParse({ ...input, locales: { ...input.locales, th: { ...input.locales.th, title: "" } } }).success).toBe(false);
    expect(commandSchema.safeParse({ ...input, locales: { th: input.locales.th } }).success).toBe(false);
  });

  it("rejects forged actor data, missing revision guards, and publication operations at the boundary", () => {
    expect(commandSchema.safeParse({ ...draft(), actor_id: sourceId }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), expected_revision: -1 }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), expected_revision: 1.5 }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), expected_revision: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), expected_revision: undefined }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), op: "publish" }).success).toBe(false);
    expect(commandSchema.safeParse({ ...draft(), facts: { ...facts(), internal_note: "private" } }).success).toBe(false);
  });
});

describe("safe read contracts and existing content", () => {
  it("preserves old long text and historically malformed URLs when reading a canonical baseline", () => {
    const input = detail();
    input.baseline.title_th = "ชื่อเดิม".repeat(100);
    input.baseline.facts.subject = "ชื่อเดิม".repeat(100);
    input.baseline.facts.detail_url = "legacy link without scheme";
    input.baseline.facts.apply_url = "old-url-that-needs-human-review";
    input.baseline.locales.th.body = "เนื้อหาเดิม\n".repeat(3000);
    input.baseline.locales.en.summary = "Existing long summary. ".repeat(500);
    const parsed = detailSchema.parse(input);
    expect(parsed).toEqual(input);
    expect(factsSchema.safeParse(parsed.baseline.facts).success).toBe(false);
  });

  it("requires exact public-facing DTO keys without silently exposing unexpected private data", () => {
    const input = detail();
    expect(detailSchema.safeParse({ ...input, internal_note: "private" }).success).toBe(false);
    expect(detailSchema.safeParse({ ...input, baseline: { ...input.baseline, internal_note: "private" } }).success).toBe(false);
    expect(detailSchema.safeParse({ ...input, baseline: { ...input.baseline, facts: { ...input.baseline.facts, source_token: "private" } } }).success).toBe(false);
    expect(detailSchema.safeParse({ ...input, baseline: { ...input.baseline, locales: { ...input.baseline.locales, fr: input.baseline.locales.en } } }).success).toBe(false);
  });

  it("bounds each list response to twenty records and requires real versioned command results", () => {
    const row = { id: recordId, title_th: "เรื่อง", updated_at: "2026-10-21T00:00:00Z", publication_status: "draft", work_item_id: null, state: "not_started" };
    expect(listSchema.safeParse({ rows: Array.from({ length: 20 }, () => row), total: 41, page: 2, page_size: 20 }).success).toBe(true);
    expect(listSchema.safeParse({ rows: Array.from({ length: 21 }, () => row), total: 41, page: 2, page_size: 20 }).success).toBe(false);
    expect(listSchema.safeParse({ rows: [row], total: 1, page: 1, page_size: 1000 }).success).toBe(false);
    expect(commandResultSchema.safeParse({ work_item_id: workItemId, record_id: recordId, row_version: 2 }).success).toBe(true);
    expect(commandResultSchema.safeParse({ work_item_id: workItemId, record_id: recordId, row_version: 0 }).success).toBe(false);
    expect(commandResultSchema.safeParse({ work_item_id: workItemId, record_id: recordId, row_version: 2, sql: "private" }).success).toBe(false);
  });
});
