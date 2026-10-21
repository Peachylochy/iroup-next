"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Eye, FileClock, Info, Save } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { executeContentCommand } from "./actions";
import {
  contentStateLabels,
  deadlineLabels,
  type ContentActionState,
  type ContentChannel,
  type ContentCommand,
  type ContentDetail,
  type ContentKind,
  type ContentLocales,
  type DeadlineKind,
  type EditorialDeadline,
  type EditorialFacts,
  type SourceVerification,
} from "./types";
import styles from "./content-editor.module.css";

type Viewer = { displayName: string; email: string; role: string };
const initialState: ContentActionState = {};
const channelLabels: Record<ContentChannel, string> = { website: "เว็บไซต์", facebook: "Facebook" };
const blankLocale = { title: "", summary: "", body: "", coverage: "" };
const blankLocales = (): ContentLocales => ({ th: { ...blankLocale }, en: { ...blankLocale } });
const value = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const optionalValue = (data: FormData, name: string) => value(data, name) || null;
const buttonClass = (secondary = false) => cn(buttonVariants({ variant: secondary ? "outline" : "default", size: "lg" }));

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: value.length === 10 ? "UTC" : "Asia/Bangkok" }).format(date);
}

function CommandForm({ testId, makeCommand, children, afterOpen = false, expectedRevision }: {
  testId: string;
  makeCommand: (data: FormData, key: string) => ContentCommand;
  children: ReactNode;
  afterOpen?: boolean;
  expectedRevision?: number;
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(executeContentCommand, initialState);
  const [transitionPending, startTransition] = useTransition();
  const request = useRef<{ signature: string; key: string } | null>(null);
  const openKind = useRef<ContentKind | null>(null);
  const busy = pending || transitionPending;

  useEffect(() => {
    if (!state.success || !state.result) return;
    request.current = null;
    if (afterOpen) {
      const kind = openKind.current;
      if (kind === "scholarship" || kind === "news") router.replace(`/content-production/${kind}/${state.result.record_id}`);
      else router.refresh();
    } else router.refresh();
  }, [afterOpen, router, state.result, state.success]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const candidate = makeCommand(data, "");
    const signature = JSON.stringify(candidate);
    if (!request.current || request.current.signature !== signature) {
      request.current = { signature, key: crypto.randomUUID() };
    }
    data.set("command", JSON.stringify({ ...candidate, idempotency_key: request.current.key }));
    if (candidate.op === "open") openKind.current = candidate.kind;
    startTransition(() => dispatch(data));
  }

  return (
    <form onSubmit={submit} className={styles.form} data-testid={testId} aria-busy={busy}>
      <input type="hidden" name="command" value="" />
      {expectedRevision !== undefined ? <input type="hidden" name="expected_revision" value={expectedRevision} /> : null}
      <fieldset disabled={busy} className={styles.stack}>{children}</fieldset>
      {busy ? <p role="status" className={styles.hint}>กำลังบันทึก กรุณารอสักครู่</p> : null}
      {state.error ? <div role="alert" className={styles.error} data-testid="content-command-error"><div>{state.error}{state.code === "CONTENT_CONFLICT" ? <p>ข้อมูลนี้มีการเปลี่ยนแปลงแล้ว จดข้อความที่ยังไม่ได้บันทึกไว้ก่อนโหลดข้อมูลล่าสุด</p> : null}</div></div> : null}
      {state.code === "CONTENT_CONFLICT" ? <button className={buttonClass(true)} type="button" onClick={() => router.refresh()}>โหลดข้อมูลล่าสุด</button> : null}
      {state.success ? <p role="status" className={styles.success}><CheckCircle2 aria-hidden="true" /> บันทึกเรียบร้อย</p> : null}
    </form>
  );
}

function SourceSection({ detail, canEdit }: { detail: ContentDetail; canEdit: boolean }) {
  const workItem = detail.work_item!;
  return (
    <section className={styles.panel} aria-labelledby="sources-heading">
      <div className={styles.sectionHeading}><div><h2 id="sources-heading">1. แหล่งข้อมูลและผลตรวจสอบ</h2><p>บันทึกสิ่งที่คุณตรวจจากต้นทางด้วยตนเอง แล้วเลือกแหล่งที่ใช้ประกอบร่างด้านล่าง</p></div></div>
      <div className={styles.stack}>
        {detail.sources.length ? <ul className={styles.sourceList}>{detail.sources.map((source) => <SourceItem source={source} key={source.id} />)}</ul> : <p className={styles.hint}>ยังไม่มีผลตรวจสอบแหล่งข้อมูล บันทึกร่างได้ แต่ต้องตรวจแหล่งข้อมูลทางการก่อนส่งตรวจ</p>}
        {canEdit ? <details open={!detail.sources.length}>
          <summary className={styles.sourceLink}>เพิ่มผลตรวจสอบแหล่งข้อมูล</summary>
          <div className={styles.separator} />
          <CommandForm key={workItem.row_version} testId="content-source-form" expectedRevision={workItem.row_version} makeCommand={(data, key) => ({
            op: "record_source", work_item_id: workItem.id, expected_revision: workItem.row_version, idempotency_key: key,
            source: {
              title: value(data, "title"), publisher: value(data, "publisher"), requested_url: value(data, "requested_url"),
              final_url: value(data, "final_url"), observed_on: value(data, "observed_on"), valid_until: value(data, "valid_until"),
              official: data.get("official") === "on", result: value(data, "result") as "verified" | "unverified", note: value(data, "note"),
            },
          })}>
            <div className={styles.grid}>
              <label className={styles.field}>ชื่อแหล่งข้อมูล<input name="title" required maxLength={500} /></label>
              <label className={styles.field}>หน่วยงานเจ้าของข้อมูล<input name="publisher" required maxLength={300} /></label>
              <label className={styles.field}>ลิงก์ที่เปิดตรวจ<input name="requested_url" type="url" required maxLength={2000} placeholder="https://…" /></label>
              <label className={styles.field}>ลิงก์หน้าที่ตรวจจริง<input name="final_url" type="url" required maxLength={2000} placeholder="ลิงก์ปลายทางหลังเปิดหน้าเว็บ" /></label>
              <label className={styles.field}>วันที่ตรวจ<input name="observed_on" type="date" required /></label>
              <label className={styles.field}>ใช้ผลตรวจนี้ได้ถึงวันที่<input name="valid_until" type="date" required /><small className={styles.hint}>กำหนดวันที่ควรตรวจใหม่ตามความเปลี่ยนแปลงของข้อมูล</small></label>
              <label className={styles.field}>ผลการตรวจ<select name="result" defaultValue="unverified"><option value="unverified">ยังยืนยันข้อมูลไม่ได้</option><option value="verified">ตรวจและยืนยันข้อมูลแล้ว</option></select></label>
              <label className={styles.check}><input name="official" type="checkbox" /> ฉันยืนยันว่าเป็นแหล่งข้อมูลทางการ</label>
              <label className={cn(styles.field, styles.wide)}>สิ่งที่ตรวจพบ / ข้อสังเกต<textarea name="note" rows={3} maxLength={4000} /></label>
            </div>
            <p className={styles.hint}>ผลตรวจแต่ละครั้งจะเก็บในประวัติ เมื่อข้อมูลเปลี่ยนให้เพิ่มผลตรวจครั้งใหม่</p>
            <div className={styles.actions}><button className={buttonClass(true)} type="submit">บันทึกผลตรวจแหล่งข้อมูล</button></div>
          </CommandForm>
        </details> : null}
      </div>
    </section>
  );
}

function SourceItem({ source }: { source: SourceVerification }) {
  const expired = source.valid_until < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return <li>
    <div className={styles.rowHeading}><strong>{source.title}</strong><span className={cn(styles.badge, expired ? styles.warning : undefined)}>{expired ? "ถึงเวลาตรวจใหม่" : source.result === "verified" ? "ตรวจด้วยตนเองแล้ว" : "ยังยืนยันไม่ได้"}{source.official ? " · ทางการ" : ""}</span></div>
    <a href={source.final_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>{source.final_url}</a>
    <p className={styles.meta}>{source.publisher} · ตรวจ {formatDate(source.observed_on)} · ใช้ได้ถึง {formatDate(source.valid_until)}</p>
    {source.note ? <p className={styles.copy}>{source.note}</p> : null}
  </li>;
}

function FactsFields({ kind, facts }: { kind: ContentKind; facts: EditorialFacts }) {
  return <div className={styles.grid}>
    <label className={cn(styles.field, styles.wide)}>เรื่อง / ชื่อโครงการตามต้นทาง<input name="fact_subject" defaultValue={facts.subject} required maxLength={500} /></label>
    <label className={cn(styles.field, styles.wide)}>ข้อเท็จจริงสำคัญ<textarea name="fact_key_points" defaultValue={facts.key_points} rows={5} maxLength={10000} /><small className={styles.hint}>จดข้อมูลที่ยืนยันได้ เช่น ใคร ทำอะไร ที่ไหน และเงื่อนไขสำคัญ แยกจากข้อความประชาสัมพันธ์</small></label>
    <label className={styles.field}>หมวดหมู่<input name="fact_category" defaultValue={facts.category} maxLength={200} /></label>
    {kind === "scholarship" ? <>
      <label className={styles.field}>ประเภททุน<input name="fact_scholarship_type" defaultValue={facts.scholarship_type} maxLength={200} /></label>
      <label className={styles.field}>กลุ่มเป้าหมาย<select name="fact_audience" defaultValue={facts.audience}><option value="student">นิสิต</option><option value="staff">บุคลากร</option><option value="both">นิสิตและบุคลากร</option><option value="external">บุคคลภายนอก</option></select></label>
      <label className={styles.field}>ประเภทเงินทุน<input name="fact_funding_type" defaultValue={facts.funding_type} maxLength={200} /></label>
      <label className={styles.field}>ระดับการศึกษา<input name="fact_study_level" defaultValue={facts.study_level} maxLength={200} /></label>
      <label className={cn(styles.field, styles.wide)}>คุณสมบัติผู้สมัคร<textarea name="fact_eligibility" defaultValue={facts.eligibility} rows={3} maxLength={5000} /></label>
    </> : null}
    <label className={styles.field}>ลิงก์รายละเอียดทางการ<input name="fact_detail_url" defaultValue={facts.detail_url} type="url" maxLength={2000} /></label>
    {kind === "scholarship" ? <label className={styles.field}>ลิงก์สมัคร<input name="fact_apply_url" defaultValue={facts.apply_url} type="url" maxLength={2000} /></label> : null}
  </div>;
}

function DeadlineFields({ kind, deadline, sources }: { kind: DeadlineKind; deadline?: EditorialDeadline; sources: SourceVerification[] }) {
  const [applicability, setApplicability] = useState<EditorialDeadline["applicability"] | "pending">(deadline?.applicability ?? "pending");
  const [precision, setPrecision] = useState(deadline?.precision ?? "date_only");
  const prefix = `deadline_${kind}_`;
  return <fieldset className={styles.deadline}>
    <legend>{deadlineLabels[kind]}</legend>
    <div className={styles.grid}>
      <label className={styles.field}>การใช้กำหนดเวลาระดับนี้<select name={`${prefix}applicability`} value={applicability} onChange={(event) => setApplicability(event.target.value as EditorialDeadline["applicability"] | "pending")}><option value="pending">ยังไม่ได้ตรวจ (เก็บเป็นร่าง)</option><option value="specified">ระบุกำหนดเวลา</option><option value="not_applicable">ไม่ใช้กับทุนรอบนี้</option></select></label>
      {applicability !== "pending" ? <label className={styles.field}>รอบทุน / ปีที่ประกาศ<input name={`${prefix}cycle_key`} defaultValue={deadline?.cycle_key ?? ""} required maxLength={100} placeholder="เช่น 2027 หรือ รอบที่ 1/2570" /></label> : null}
      {applicability === "pending" ? <p className={cn(styles.hint, styles.wide)}>บันทึกร่างได้ก่อน เมื่อจะส่งตรวจต้องยืนยันกำหนดเวลาระดับนี้ หรือระบุว่าไม่ใช้กับทุนรอบนี้พร้อมเหตุผล</p> : applicability === "not_applicable" ? <label className={cn(styles.field, styles.wide)}>เหตุผลที่ไม่ใช้กำหนดเวลาระดับนี้<textarea name={`${prefix}reason`} defaultValue={deadline?.reason ?? ""} required rows={2} maxLength={2000} /></label> : <>
        <label className={cn(styles.field, styles.wide)}>ข้อความกำหนดเวลาจากต้นทาง<textarea name={`${prefix}raw_text`} defaultValue={deadline?.raw_text ?? ""} rows={2} required maxLength={4000} /></label>
        <label className={styles.field}>ความละเอียดที่ต้นทางระบุ<select name={`${prefix}precision`} value={precision} onChange={(event) => setPrecision(event.target.value as EditorialDeadline["precision"])}><option value="date_only">วันที่เท่านั้น</option><option value="local_datetime">วันที่และเวลาท้องถิ่น</option><option value="instant">วันเวลาพร้อมเขตเวลาที่แน่นอน</option></select></label>
        <label className={styles.field}>แหล่งที่ยืนยันกำหนดเวลานี้<select name={`${prefix}source_verification_id`} defaultValue={deadline?.source_verification_id ?? ""}><option value="">ยังไม่ได้เลือก</option>{sources.map((source) => <option value={source.id} key={source.id}>{source.title} · {formatDate(source.observed_on)}</option>)}</select></label>
        {precision !== "instant" ? <label className={styles.field}>วันที่ปิดรับตามต้นทาง<input name={`${prefix}date`} type="date" defaultValue={deadline?.date ?? ""} required /></label> : null}
        {precision === "local_datetime" ? <>
          <label className={styles.field}>เวลาท้องถิ่น<input name={`${prefix}time`} type="time" step="1" defaultValue={deadline?.time ?? ""} required /></label>
          <label className={styles.field}>เขตเวลาตามต้นทาง<input name={`${prefix}timezone`} defaultValue={deadline?.timezone ?? ""} maxLength={100} placeholder="เช่น Asia/Bangkok หรือเว้นว่างถ้ายังไม่ยืนยัน" /><small className={styles.hint}>เว้นว่างได้ในร่าง หากยังไม่มีข้อมูลยืนยัน</small></label>
        </> : null}
        {precision === "instant" ? <label className={cn(styles.field, styles.wide)}>วันเวลาพร้อมค่าชดเชยเขตเวลา<input name={`${prefix}instant`} defaultValue={deadline?.instant ?? ""} required maxLength={50} placeholder="เช่น 2027-01-31T17:00:00+07:00" /><small className={styles.hint}>ใช้รูปแบบนี้เฉพาะเมื่อยืนยันวัน เวลา และเขตเวลาจากต้นทางแล้ว</small></label> : null}
      </>}
    </div>
  </fieldset>;
}

function parseDeadline(data: FormData, kind: DeadlineKind): EditorialDeadline | null {
  const prefix = `deadline_${kind}_`;
  const applicability = value(data, `${prefix}applicability`) as EditorialDeadline["applicability"] | "pending";
  if (applicability === "pending") return null;
  const precision = (value(data, `${prefix}precision`) || "date_only") as EditorialDeadline["precision"];
  return {
    kind, applicability, precision, reason: value(data, `${prefix}reason`), cycle_key: value(data, `${prefix}cycle_key`),
    raw_text: value(data, `${prefix}raw_text`), date: optionalValue(data, `${prefix}date`), time: optionalValue(data, `${prefix}time`),
    timezone: optionalValue(data, `${prefix}timezone`), instant: optionalValue(data, `${prefix}instant`), source_verification_id: optionalValue(data, `${prefix}source_verification_id`),
  };
}

function DraftSection({ detail, canEdit, channel, onChannelChange }: { detail: ContentDetail; canEdit: boolean; channel: ContentChannel; onChannelChange: (channel: ContentChannel) => void }) {
  const workItem = detail.work_item!;
  const facts = detail.snapshot?.facts ?? detail.baseline.facts;
  const [copies, setCopies] = useState<Record<ContentChannel, ContentLocales>>(() => ({
    website: detail.versions.find((version) => version.channel === "website" && version.is_latest)?.locales ?? blankLocales(),
    facebook: detail.versions.find((version) => version.channel === "facebook" && version.is_latest)?.locales ?? blankLocales(),
  }));
  const locales = copies[channel];
  function setCopy(locale: "th" | "en", field: keyof ContentLocales["th"], text: string) {
    setCopies((current) => ({ ...current, [channel]: { ...current[channel], [locale]: { ...current[channel][locale], [field]: text } } }));
  }

  return <section className={styles.panel} aria-labelledby="draft-heading">
    <div className={styles.sectionHeading}><div><h2 id="draft-heading">2. ข้อเท็จจริงและร่างเนื้อหา</h2><p>ข้อเท็จจริงใช้ร่วมกัน ส่วนข้อความภาษาไทยและภาษาอังกฤษเก็บแยกตามช่องทาง</p></div><span className={styles.badge}>บันทึกเป็นฉบับใหม่ทุกครั้ง</span></div>
    <CommandForm testId="content-draft-form" expectedRevision={workItem.row_version} makeCommand={(data, key) => ({
      op: "save_draft", work_item_id: workItem.id, expected_revision: workItem.row_version, idempotency_key: key, channel,
      facts: {
        subject: value(data, "fact_subject"), key_points: value(data, "fact_key_points"), category: value(data, "fact_category"),
        scholarship_type: value(data, "fact_scholarship_type"), audience: (value(data, "fact_audience") || "student") as EditorialFacts["audience"],
        funding_type: value(data, "fact_funding_type"), study_level: value(data, "fact_study_level"), eligibility: value(data, "fact_eligibility"), detail_url: value(data, "fact_detail_url"), apply_url: value(data, "fact_apply_url"),
      },
      source_verification_ids: data.getAll("selected_source").map(String),
      deadlines: detail.kind === "scholarship" ? (Object.keys(deadlineLabels) as DeadlineKind[]).map((kind) => parseDeadline(data, kind)).filter((deadline): deadline is EditorialDeadline => deadline !== null) : [],
      locales: {
        th: { title: value(data, "th_title"), summary: value(data, "th_summary"), body: value(data, "th_body"), coverage: value(data, "th_coverage") },
        en: { title: value(data, "en_title"), summary: value(data, "en_summary"), body: value(data, "en_body"), coverage: value(data, "en_coverage") },
      },
    })}>
      <fieldset disabled={!canEdit} className={styles.stack}>
        <h3 className={styles.subheading}>ข้อเท็จจริงของเรื่องนี้</h3>
        <FactsFields kind={detail.kind} facts={facts} />
        <fieldset className={styles.stack}><legend>แหล่งที่ใช้ในร่างฉบับนี้</legend>{detail.sources.length ? detail.sources.map((source) => <label key={source.id} className={styles.check}><input name="selected_source" type="checkbox" value={source.id} defaultChecked={detail.snapshot?.source_verification_ids.includes(source.id) ?? false} />{source.title} · ตรวจ {formatDate(source.observed_on)}{source.result !== "verified" ? " · ยังยืนยันไม่ได้" : ""}</label>) : <p className={styles.hint}>เพิ่มผลตรวจแหล่งข้อมูลในส่วนที่ 1 ก่อนเลือก</p>}</fieldset>
        {detail.kind === "scholarship" ? <div className={styles.stack}><h3 className={styles.subheading}>กำหนดเวลาทุนสามระดับ</h3><p className={styles.hint}>เก็บแต่ละระดับแยกกัน หากต้นทางระบุเพียงวันที่ให้เลือก “วันที่เท่านั้น” โดยไม่เพิ่มเวลาหรือเขตเวลา</p>{(Object.keys(deadlineLabels) as DeadlineKind[]).map((kind) => <DeadlineFields key={kind} kind={kind} deadline={detail.snapshot?.deadlines.find((deadline) => deadline.kind === kind)} sources={detail.sources} />)}</div> : null}
        <div className={styles.separator} />
        <div className={styles.rowHeading}><h3 className={styles.subheading}>ข้อความสำหรับช่องทาง</h3><label className={styles.field}>ช่องทาง<select name="channel" value={channel} onChange={(event) => onChannelChange(event.target.value as ContentChannel)}><option value="website">เว็บไซต์</option><option value="facebook">Facebook</option></select></label></div>
        <p className={styles.hint}>บันทึกเฉพาะช่องทางที่เลือก ภาษาไทยและอังกฤษต้องเขียนแยกกัน ไม่แปลหรือสร้างข้อความให้อัตโนมัติ</p>
        {canEdit && !detail.versions.some((version) => version.channel === channel) ? <div><button type="button" className={buttonClass(true)} onClick={() => setCopies((current) => ({ ...current, [channel]: { th: { ...detail.baseline.locales.th }, en: { ...detail.baseline.locales.en } } }))}>นำข้อความเดิมมาเป็นต้นฉบับร่างช่องทางนี้</button><p className={styles.hint}>ตรวจและปรับเนื้อหาให้เหมาะกับช่องทางก่อนส่งตรวจ</p></div> : null}
        <div className={styles.localeGrid}>{(["th", "en"] as const).map((locale) => <div className={styles.localePanel} key={locale} lang={locale}><h3>{locale === "th" ? "ภาษาไทย" : "English"}</h3><div className={styles.stack}>
          <label className={styles.field}>{locale === "th" ? "หัวเรื่องภาษาไทย" : "English title"}<input name={`${locale}_title`} value={locales[locale].title} onChange={(event) => setCopy(locale, "title", event.target.value)} required={locale === "th"} maxLength={500} /></label>
          <label className={styles.field}>{locale === "th" ? "สรุปภาษาไทย" : "English summary"}<textarea name={`${locale}_summary`} value={locales[locale].summary} onChange={(event) => setCopy(locale, "summary", event.target.value)} rows={3} maxLength={4000} /></label>
          <label className={styles.field}>{locale === "th" ? "เนื้อหาภาษาไทย" : "English body"}<textarea name={`${locale}_body`} value={locales[locale].body} onChange={(event) => setCopy(locale, "body", event.target.value)} rows={9} maxLength={20000} /></label>
          {detail.kind === "scholarship" ? <label className={styles.field}>{locale === "th" ? "สิทธิประโยชน์ทุนภาษาไทย" : "Scholarship coverage in English"}<textarea name={`${locale}_coverage`} value={locales[locale].coverage} onChange={(event) => setCopy(locale, "coverage", event.target.value)} rows={3} maxLength={10000} /></label> : null}
        </div></div>)}</div>
        <p className={styles.hint}>เก็บร่างที่ยังไม่ครบได้ ก่อนส่งตรวจต้องมีหัวเรื่องและเนื้อหาครบทั้งสองภาษา และเลือกแหล่งข้อมูลทางการที่ยังใช้ได้</p>
        {canEdit ? <div className={styles.actions}><button className={buttonClass()} type="submit"><Save aria-hidden="true" /> บันทึกร่างใหม่</button></div> : null}
      </fieldset>
    </CommandForm>
  </section>;
}

function VersionHistory({ detail, canEdit, canApprove }: { detail: ContentDetail; canEdit: boolean; canApprove: boolean }) {
  const workItem = detail.work_item!;
  return <section className={styles.panel} aria-labelledby="history-heading">
    <div className={styles.sectionHeading}><div><h2 id="history-heading">3. ประวัติร่างและการตรวจเนื้อหา</h2><p>ตรวจข้อความฉบับที่บันทึกไว้ก่อนตัดสินใจ การอนุมัติในขั้นนี้เป็นการอนุมัติเนื้อหาเพื่อใช้ในงานขั้นต่อไป</p></div></div>
    {detail.versions.length ? <ol className={styles.history}>{detail.versions.map((version) => {
      const current = version.is_latest && version.snapshot_id === workItem.current_snapshot_id && version.state !== "stale";
      const reviews = detail.reviews.filter((review) => review.version_id === version.id);
      return <li className={styles.historyItem} key={version.id} data-testid={`content-version-${version.id}`}>
        <div className={styles.rowHeading}><div><h3>{channelLabels[version.channel]} · ฉบับที่ {version.version_number}</h3><p className={styles.meta}>บันทึก {formatDate(version.created_at)}{version.is_latest ? " · ฉบับล่าสุดของช่องทาง" : ""}</p></div><span className={cn(styles.badge, version.state === "approved" ? styles.approved : version.state === "stale" ? styles.warning : undefined)}>{contentStateLabels[version.state]}</span></div>
        {!current ? <p className={styles.hint}>เก็บไว้เป็นประวัติ หากต้องการใช้ต่อให้บันทึกร่างจากข้อมูลล่าสุดและส่งตรวจใหม่</p> : null}
        <details><summary>อ่านเนื้อหาทั้งสองภาษา</summary><div className={styles.localeGrid}>{(["th", "en"] as const).map((locale) => <div className={styles.localePanel} key={locale} lang={locale}><h3>{locale === "th" ? "ภาษาไทย" : "English"}</h3><h4>{version.locales[locale].title || "ยังไม่มีหัวเรื่อง"}</h4>{version.locales[locale].summary ? <p className={styles.copy}>{version.locales[locale].summary}</p> : null}<p className={styles.copy}>{version.locales[locale].body || "ยังไม่มีเนื้อหา"}</p>{version.locales[locale].coverage ? <p className={styles.copy}>{version.locales[locale].coverage}</p> : null}</div>)}</div></details>
        {reviews.length ? <div className={styles.stack}>{reviews.map((review) => <p className={styles.meta} key={review.id}>{review.decision === "submitted" ? "ส่งตรวจ" : review.decision === "approved" ? "อนุมัติเนื้อหา" : "ส่งกลับแก้ไข"} · {formatDate(review.created_at)}{review.note ? ` — ${review.note}` : ""}</p>)}</div> : null}
        {current && ((canEdit && (version.state === "draft" || version.state === "returned")) || (canApprove && version.state === "under_review")) ? <div className={styles.stack}><div className={styles.separator} /><CommandForm testId={`content-review-${version.id}`} expectedRevision={workItem.row_version} makeCommand={(data, key) => ({ op: "review", work_item_id: workItem.id, expected_revision: workItem.row_version, idempotency_key: key, version_id: version.id, decision: value(data, "decision") as "submit" | "approve" | "return", note: value(data, "note") })}>
          <label className={styles.field}>หมายเหตุการตรวจ<textarea name="note" rows={2} maxLength={4000} placeholder="ระบุสิ่งที่ต้องแก้ไขเมื่อส่งกลับ" /></label>
          <div className={styles.actions}>{canEdit && (version.state === "draft" || version.state === "returned") ? <button className={buttonClass()} name="decision" value="submit" type="submit">ส่งตรวจเนื้อหา</button> : null}{canApprove && version.state === "under_review" ? <><button className={buttonClass(true)} name="decision" value="return" type="submit">ส่งกลับแก้ไข</button><button className={buttonClass()} name="decision" value="approve" type="submit">อนุมัติเนื้อหา</button></> : null}</div>
        </CommandForm></div> : null}
      </li>;
    })}</ol> : <div className={styles.empty}><FileClock aria-hidden="true" /><h3>ยังไม่มีร่างที่บันทึก</h3><p>บันทึกร่างแรกเพื่อเริ่มเก็บประวัติและส่งตรวจเนื้อหา</p></div>}
  </section>;
}

export function ContentEditor({ kind, access, viewer, detail }: { kind: ContentKind; access: CurrentUserAccess; viewer: Viewer; detail: ContentDetail | null }) {
  const [channel, setChannel] = useState<ContentChannel>("website");
  const title = kind === "scholarship" ? "ทุนการศึกษา" : "ข่าวประชาสัมพันธ์";
  const canEdit = access.modules[kind].update;
  const canOpen = detail ? canEdit : access.modules[kind].create;
  const canApprove = access.modules[kind].publish;

  return <WorkspaceChrome access={access} viewer={viewer} title="จัดทำเนื้อหา" activePath="/content-production" hidePlaceholderControls>
    <main className={styles.main}>
      <header className={styles.heading}><div><Link href={`/content-production?kind=${kind}`} className={styles.backLink}><ArrowLeft aria-hidden="true" /> กลับไปรายการจัดทำเนื้อหา</Link><p className={styles.eyebrow}>จัดทำเนื้อหา · {title}</p><h1>{detail?.baseline.title_th || `เริ่มจัดทำ${title}`}</h1><p className={styles.description}>ตรวจแหล่งข้อมูล เขียนร่างสองภาษา และส่งให้ผู้มีสิทธิ์ตรวจเนื้อหา</p></div></header>
      <p className={styles.notice}><Info aria-hidden="true" /><span>พื้นที่นี้ใช้จัดทำและอนุมัติร่าง การอนุมัติเนื้อหายังไม่เผยแพร่ไปเว็บไซต์หรือ Facebook</span></p>
      {!canEdit && detail ? <p className={styles.notice} data-testid="content-readonly"><Eye aria-hidden="true" /><span>{canApprove ? "คุณดูข้อมูลและตรวจอนุมัติร่างที่ส่งตรวจได้" : "สิทธิ์อ่านอย่างเดียว คุณดูข้อเท็จจริง แหล่งข้อมูล และประวัติเนื้อหาได้"}</span></p> : null}
      {!detail?.work_item ? <section className={styles.panel}><div className={styles.sectionHeading}><div><h2>{detail ? "เริ่มพื้นที่จัดทำเนื้อหาของรายการนี้" : `สร้างรายการ${title}`}</h2><p>{detail ? "เก็บข้อมูลเดิมไว้เป็นต้นฉบับ และเริ่มตรวจแหล่งข้อมูลเพื่อจัดทำร่างใหม่" : "ตั้งชื่อเรื่องก่อน แล้วเติมข้อเท็จจริงและร่างเนื้อหาได้ในขั้นต่อไป"}</p></div></div>{canOpen ? <CommandForm testId="content-open-form" afterOpen makeCommand={(data, key) => ({ op: "open", kind, record_id: detail?.record_id ?? null, title_th: detail?.baseline.title_th ?? value(data, "title_th"), idempotency_key: key })}>{!detail ? <label className={styles.field}>ชื่อเรื่องภาษาไทย<input name="title_th" required maxLength={500} /></label> : null}<div className={styles.actions}><button className={buttonClass()} type="submit">เริ่มจัดทำเนื้อหา</button></div></CommandForm> : <p className={styles.hint}>รายการนี้ยังไม่ได้เริ่มจัดทำร่าง ผู้มีสิทธิ์แก้ไขสามารถเริ่มจัดทำได้</p>}</section> : <>
        <SourceSection detail={detail} canEdit={canEdit} />
        <DraftSection key={detail.versions.filter((version) => version.is_latest).map((version) => version.id).sort().join(":") || "initial"} detail={detail} canEdit={canEdit} channel={channel} onChannelChange={setChannel} />
        <VersionHistory key={`history-${detail.work_item.row_version}`} detail={detail} canEdit={canEdit} canApprove={canApprove} />
      </>}
    </main>
  </WorkspaceChrome>;
}
