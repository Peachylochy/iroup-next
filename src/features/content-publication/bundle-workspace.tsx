"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, FileCheck2, ImageOff, Info, PackageCheck, RefreshCw } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { freezePublicationBundle, verifyPublicationBundle } from "./actions";
import type { PublicationActionState, PublicationBundle, PublicationCommand, PublicationDetail, PublicationVerifyState } from "./types";
import styles from "./bundle-workspace.module.css";

type Viewer = { displayName: string; email: string; role: string };
type Locale = "th" | "en";
type ChannelFilter = "all" | "website" | "facebook";

const channelLabels = { website: "เว็บไซต์", facebook: "Facebook" };
const issueLabels: Record<string, string> = {
  CONTENT_NOT_APPROVED: "เนื้อหาหรือแหล่งข้อมูลที่อ้างอิงต้องตรวจอนุมัติใหม่",
  BRIEF_NOT_APPROVED: "บรีฟภาพที่อ้างอิงต้องตรวจอนุมัติใหม่",
  ASSET_SET_NOT_APPROVED: "ชุดภาพที่อ้างอิงต้องตรวจอนุมัติใหม่",
  ASSET_NOT_READY: "ภาพที่อ้างอิงยังไม่พร้อมใช้งาน ต้องกลับไปตรวจไฟล์ภาพ",
};
const initialFreezeState: PublicationActionState = {};
const initialVerifyState: PublicationVerifyState = {};
const buttonClass = (secondary = false) => buttonVariants({ variant: secondary ? "outline" : "default", size: "lg" });
const refreshCodes = new Set(["STALE_REVISION", "CONTENT_CONFLICT", "PUBLICATION_CONFLICT", "IDEMPOTENCY_CONFLICT", "BUNDLE_STALE", "CONTENT_NOT_APPROVED", "BRIEF_NOT_APPROVED", "ASSET_SET_NOT_APPROVED"]);

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ไม่ระบุเวลา" : new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(date);
}

function bundleUrl(detail: PublicationDetail, id: string) {
  return `/content-production/${detail.work_item.kind}/${detail.work_item.record_id}/publication?bundle=${id}`;
}

function StateBadge({ state }: { state: PublicationBundle["state"] }) {
  return <span className={cn(styles.badge, state === "current" ? styles.current : styles.stale)}>
    {state === "current" ? "อ้างอิงฉบับปัจจุบัน" : "ต้องเตรียมชุดใหม่"}
  </span>;
}

function StaleReasons({ issues }: { issues: string[] }) {
  const labels = [...new Set(issues.map((issue) => issueLabels[issue] ?? "ข้อมูลที่อ้างอิงเปลี่ยนไป ต้องตรวจฉบับปัจจุบันก่อนเตรียมชุดใหม่"))];
  return <div className={cn(styles.notice, styles.staleNotice)}>
    <Info aria-hidden="true" />
    <div><p>ชุดนี้เก็บไว้เป็นประวัติ ยังอ่านเนื้อหาและดูภาพตามที่บันทึกไว้ได้</p>
      {labels.length ? <ul className={styles.reasonList}>{labels.map((label) => <li key={label}>{label}</li>)}</ul> : <p>กลับไปตรวจเนื้อหา บรีฟ และชุดภาพฉบับปัจจุบันก่อนเตรียมชุดใหม่</p>}
    </div>
  </div>;
}

function FreezeForm({ detail }: { detail: PublicationDetail }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(detail.candidates[0]?.asset_set_id ?? "");
  const [state, dispatch, pending] = useActionState(freezePublicationBundle, initialFreezeState);
  const [transitionPending, startTransition] = useTransition();
  const request = useRef<{ signature: string; key: string } | null>(null);
  const publicationPath = `/content-production/${detail.work_item.kind}/${detail.work_item.record_id}/publication`;
  const selected = detail.candidates.find((candidate) => candidate.asset_set_id === selectedId);
  const busy = pending || transitionPending;
  const conflict = Boolean(state.code && refreshCodes.has(state.code));

  useEffect(() => {
    if (!state.success || !state.result) return;
    request.current = null;
    router.push(`${publicationPath}?bundle=${state.result.bundle_id}`, { scroll: false });
    router.refresh();
  }, [publicationPath, router, state.result, state.success]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const command: PublicationCommand = {
      op: "freeze_bundle", work_item_id: detail.work_item.id,
      expected_revision: detail.work_item.row_version, asset_set_id: selected.asset_set_id, idempotency_key: "",
    };
    const signature = JSON.stringify(command);
    if (!request.current || request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    const data = new FormData(event.currentTarget);
    data.set("command", JSON.stringify({ ...command, idempotency_key: request.current.key }));
    startTransition(() => dispatch(data));
  }

  return <form onSubmit={submit} className={styles.stack} data-testid="bundle-freeze-form" aria-busy={busy}>
    <input type="hidden" name="command" value="" />
    <fieldset disabled={busy} className={styles.stack}>
      <label className={styles.field}>เลือกเนื้อหาและชุดภาพที่อนุมัติแล้ว
        <select name="asset_set_id" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required>
          {!selectedId ? <option value="">เลือกชุดภาพ</option> : null}
          {selectedId && !selected ? <option value={selectedId} disabled>ชุดภาพที่เลือกต้องตรวจใหม่ — โปรดเลือกฉบับปัจจุบัน</option> : null}
          {detail.candidates.map((candidate) => <option value={candidate.asset_set_id} key={candidate.asset_set_id}>
            {channelLabels[candidate.channel]} · เนื้อหาฉบับที่ {candidate.content_version_number} · {candidate.brief_title} · ชุดภาพฉบับที่ {candidate.asset_set_version_number}
          </option>)}
        </select>
      </label>
      {selected ? <div className={styles.selection} data-testid="bundle-selected-candidate">
        <PackageCheck aria-hidden="true" />
        <div><h3>{selected.brief_title}</h3><p className={styles.meta}>{channelLabels[selected.channel]} · เนื้อหาฉบับที่ {selected.content_version_number} · ชุดภาพฉบับที่ {selected.asset_set_version_number} · {selected.image_count} ภาพ</p></div>
      </div> : <p className={styles.hint}>ต้องมีเนื้อหา บรีฟ และชุดภาพที่อนุมัติและยังเป็นปัจจุบันก่อนบันทึกชุดเตรียมเผยแพร่</p>}
      <p className={styles.hint}>เมื่อบันทึกแล้ว เนื้อหาและรายการภาพในชุดจะคงเดิม หากมีการแก้ไข ให้ตรวจอนุมัติฉบับใหม่และเตรียมชุดใหม่</p>
      <div className={styles.actions}><button type="submit" className={buttonClass()} disabled={!selected}><PackageCheck aria-hidden="true" /> บันทึกชุดเตรียมเผยแพร่</button></div>
    </fieldset>
    {busy ? <p role="status" className={styles.hint}>กำลังตรวจและบันทึกชุดเตรียมเผยแพร่</p> : null}
    {state.error ? <div role="alert" className={styles.error} data-testid="bundle-command-error"><div><p>{state.error}</p>{conflict ? <p>รายการที่เลือกยังอยู่ โหลดข้อมูลล่าสุดเพื่อตรวจว่าชุดนี้ยังใช้ได้ก่อนลองอีกครั้ง</p> : null}</div></div> : null}
    {conflict ? <div><button type="button" className={buttonClass(true)} onClick={() => router.refresh()} disabled={busy}><RefreshCw aria-hidden="true" /> โหลดข้อมูลล่าสุด</button></div> : null}
    {state.success ? <p role="status" className={styles.success}><CheckCircle2 aria-hidden="true" /><span>{state.result?.reused ? "เปิดชุดที่บันทึกไว้แล้ว ข้อมูลฉบับนี้มีอยู่ในประวัติ" : "บันทึกชุดเตรียมเผยแพร่แล้ว"}</span></p> : null}
  </form>;
}

function VerifyForm({ detail, bundle }: { detail: PublicationDetail; bundle: PublicationBundle }) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(verifyPublicationBundle, initialVerifyState);
  const [transitionPending, startTransition] = useTransition();
  const busy = pending || transitionPending;
  const isCurrent = bundle.state === "current";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCurrent || busy) return;
    const data = new FormData(event.currentTarget);
    data.set("command", JSON.stringify({ work_item_id: detail.work_item.id, bundle_id: bundle.id }));
    startTransition(() => dispatch(data));
  }

  return <form className={styles.stack} onSubmit={submit} aria-busy={busy} data-testid="bundle-verify-form">
    <input type="hidden" name="command" value="" />
    <div className={styles.verifyHeading}><div><h3>ตรวจไฟล์ภาพที่บันทึกไว้</h3><p className={styles.hint}>ตรวจว่าไฟล์แต่ละภาพยังตรงกับชุดนี้ และข้อมูลที่อ้างอิงยังเป็นปัจจุบัน</p></div>
      <button type="submit" className={buttonClass(true)} disabled={busy || !isCurrent} data-testid="bundle-verify-button"><FileCheck2 aria-hidden="true" /> ตรวจไฟล์ภาพอีกครั้ง</button>
    </div>
    {!isCurrent ? <p className={styles.hint}>ชุดประวัตินี้ต้องเตรียมใหม่จากฉบับที่อนุมัติปัจจุบันก่อนตรวจความพร้อม</p> : null}
    {busy ? <p role="status" className={styles.hint}>กำลังตรวจไฟล์ภาพและข้อมูลที่อ้างอิง</p> : null}
    {!busy && state.error ? <p role="alert" className={styles.error} data-testid="bundle-verify-error">{state.error}</p> : null}
    {!busy && state.code && refreshCodes.has(state.code) ? <div><button type="button" className={buttonClass(true)} onClick={() => router.refresh()}><RefreshCw aria-hidden="true" /> โหลดข้อมูลล่าสุด</button></div> : null}
    {!busy && isCurrent && state.success && state.result?.bundle_id === bundle.id && state.result.digest === bundle.digest ? <div className={styles.success} role="status" data-testid="bundle-verify-result"><CheckCircle2 aria-hidden="true" /><div><p>ตรวจครบ {state.result.checked_assets} ภาพ · {formatDate(state.result.checked_at)}</p><p>ผลนี้ยืนยัน ณ เวลาที่ตรวจเท่านั้น ควรตรวจอีกครั้งก่อนดำเนินการขั้นถัดไป และยังไม่มีการเผยแพร่</p></div></div> : null}
  </form>;
}

function FrozenImage({ image, locale }: { image: PublicationBundle["payload"]["images"][number]; locale: Locale }) {
  const [failed, setFailed] = useState(false);
  const description = locale === "th" ? image.alt_text_th : image.alt_text_en;
  return <li className={styles.imageCard} data-testid={`bundle-image-${image.asset_id}`}>
    <div className={styles.imageFrame}>
      {failed ? <div className={styles.imageFallback} role="status"><ImageOff aria-hidden="true" /><p>เปิดภาพไม่ได้ในขณะนี้</p><p>ลองตรวจไฟล์ภาพอีกครั้ง</p></div> : <Image src={`/api/content-visual/assets/${image.asset_id}`} alt={description} width={image.width} height={image.height} unoptimized onError={() => setFailed(true)} />}
    </div>
    <div className={styles.imageBody}><h4>{image.order}. {image.label}</h4><p className={styles.meta}>{image.width} × {image.height} พิกเซล</p>
      <p className={styles.copy} lang={locale}><span className={styles.copyLabel}>{locale === "th" ? "คำอธิบายภาพ: " : "Image description: "}</span>{description}</p>
      {image.attribution ? <p className={styles.copy}><span className={styles.copyLabel}>เครดิตภาพ: </span>{image.attribution}</p> : null}
    </div>
  </li>;
}

function BundlePreview({ detail, bundle }: { detail: PublicationDetail; bundle: PublicationBundle }) {
  const [locale, setLocale] = useState<Locale>("th");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function changeTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextLocale: Locale = event.key === "Home" ? "th" : event.key === "End" ? "en" : locale === "th" ? "en" : "th";
    setLocale(nextLocale);
    tabRefs.current[nextLocale === "th" ? 0 : 1]?.focus();
  }

  return <section className={styles.panel} aria-labelledby="bundle-preview-heading" data-testid="bundle-preview" data-bundle-id={bundle.id} data-state={bundle.state}>
    <div className={styles.rowHeading}><div><h2 id="bundle-preview-heading">ชุดฉบับที่ {bundle.version_number} · {channelLabels[bundle.channel]}</h2><p className={styles.meta}>เนื้อหาฉบับที่ {bundle.content_version_number} · ชุดภาพฉบับที่ {bundle.asset_set_version_number} · บันทึก {formatDate(bundle.created_at)}</p></div><StateBadge state={bundle.state} /></div>
    {bundle.state === "stale" ? <StaleReasons issues={bundle.issues} /> : null}
    <p className={styles.hint}>แสดงข้อความและลำดับภาพที่บันทึกไว้ในชุดนี้ สำหรับตรวจทานก่อนดำเนินการขั้นถัดไป</p>
    <div className={styles.tabs} role="tablist" aria-label="ภาษาของเนื้อหาในชุด">
      {(["th", "en"] as const).map((language, index) => <button key={language} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`bundle-tab-${language}`} aria-controls={`bundle-locale-${language}`} aria-selected={locale === language} tabIndex={locale === language ? 0 : -1} className={cn(styles.tab, locale === language && styles.activeTab)} onClick={() => setLocale(language)} onKeyDown={changeTab} lang={language}>{language === "th" ? "ไทย" : "English"}</button>)}
    </div>
    {(["th", "en"] as const).map((language) => {
      const copy = bundle.payload.locales[language];
      return <div key={language} id={`bundle-locale-${language}`} role="tabpanel" aria-labelledby={`bundle-tab-${language}`} tabIndex={0} hidden={locale !== language} lang={language} className={styles.localePanel}>
        <dl className={styles.copyFields}>
          <div><dt>{language === "th" ? "หัวเรื่อง" : "Title"}</dt><dd className={styles.frozenTitle} data-testid={`bundle-title-${language}`}>{copy.title}</dd></div>
          <div><dt>{language === "th" ? "คำโปรย" : "Summary"}</dt><dd className={styles.copy}>{copy.summary || (language === "th" ? "ไม่ได้ระบุคำโปรย" : "No summary provided")}</dd></div>
          <div><dt>{language === "th" ? "เนื้อหา" : "Body"}</dt><dd className={styles.copy} data-testid={`bundle-body-${language}`}>{copy.body}</dd></div>
          {copy.coverage ? <div><dt>{language === "th" ? "สิทธิประโยชน์ / ความครอบคลุม" : "Coverage"}</dt><dd className={styles.copy}>{copy.coverage}</dd></div> : null}
        </dl>
      </div>;
    })}
    <div className={styles.separator} />
    <h3 className={styles.subheading}>ภาพตามลำดับในชุด · {bundle.payload.images.length} ภาพ</h3>
    <ol className={styles.imageGrid}>{bundle.payload.images.map((image) => <FrozenImage key={image.asset_id} image={image} locale={locale} />)}</ol>
    <div className={styles.separator} />
    <VerifyForm key={`${bundle.id}:${detail.work_item.row_version}`} detail={detail} bundle={bundle} />
  </section>;
}

function BundleHistory({ detail }: { detail: PublicationDetail }) {
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const bundles = detail.bundles.filter((bundle) => channel === "all" || bundle.channel === channel);
  return <section className={styles.panel} aria-labelledby="bundle-history-heading">
    <div className={styles.rowHeading}><div><h2 id="bundle-history-heading">ประวัติชุดเตรียมเผยแพร่</h2><p className={styles.hint}>เลือกเปิดตรวจเนื้อหาและภาพในแต่ละฉบับ</p></div>
      <label className={cn(styles.field, styles.filter)}>ช่องทาง<select name="bundle_channel_filter" value={channel} onChange={(event) => setChannel(event.target.value as ChannelFilter)}><option value="all">ทุกช่องทาง</option><option value="website">เว็บไซต์</option><option value="facebook">Facebook</option></select></label>
    </div>
    {bundles.length ? <ol className={styles.history}>{bundles.map((bundle) => <li key={bundle.id} className={cn(styles.historyItem, detail.selected?.id === bundle.id && styles.selectedHistory)} data-testid={`bundle-history-${bundle.id}`}>
      <div className={styles.rowHeading}><div><h3>ชุดฉบับที่ {bundle.version_number} · {channelLabels[bundle.channel]}</h3><p className={styles.meta}>เนื้อหาฉบับที่ {bundle.content_version_number} · ชุดภาพฉบับที่ {bundle.asset_set_version_number} · {formatDate(bundle.created_at)}</p></div><StateBadge state={bundle.state} /></div>
      <div className={styles.historyLink}><Link href={bundleUrl(detail, bundle.id)} aria-current={detail.selected?.id === bundle.id ? "page" : undefined} className={buttonClass(true)} scroll={false}><Eye aria-hidden="true" /> เปิดชุดฉบับที่ {bundle.version_number}</Link></div>
    </li>)}</ol> : <p className={styles.empty}>{detail.bundles.length ? "ยังไม่มีชุดที่บันทึกสำหรับช่องทางนี้" : "ยังไม่มีชุดเตรียมเผยแพร่ที่บันทึก"}</p>}
  </section>;
}

export function BundleWorkspace({ detail, access, viewer }: { detail: PublicationDetail; access: CurrentUserAccess; viewer: Viewer }) {
  const moduleAccess = access.modules[detail.work_item.kind];
  const canFreeze = access.profile.active && moduleAccess.view && moduleAccess.publish;
  const coreUrl = `/content-production/${detail.work_item.kind}/${detail.work_item.record_id}`;

  return <WorkspaceChrome access={access} viewer={viewer} title="ชุดเตรียมเผยแพร่" activePath="/content-production" hidePlaceholderControls>
    <main className={styles.main} data-testid="bundle-workspace" data-revision={detail.work_item.row_version}>
      <header className={styles.heading}>
        <Link href={`${coreUrl}/visual`} className={styles.backLink}><ArrowLeft aria-hidden="true" /> กลับไปบรีฟและจัดการภาพ</Link>
        <p className={styles.eyebrow}>จัดทำเนื้อหา · {detail.work_item.kind === "scholarship" ? "ทุนการศึกษา" : "ข่าวประชาสัมพันธ์"}</p>
        <h1>ชุดเตรียมเผยแพร่</h1><p className={styles.description}>บันทึกเนื้อหาและรายการภาพของฉบับที่อนุมัติไว้เป็นชุดเดียวกัน พร้อมเปิดตรวจทั้งสองภาษา</p>
      </header>
      <p className={styles.notice}><Info aria-hidden="true" /><span>พื้นที่นี้เป็นส่วนตัว การอนุมัติ บันทึกชุด และตรวจไฟล์ภาพ ยังไม่เผยแพร่ไปเว็บไซต์หรือ Facebook</span></p>
      <section className={styles.panel} aria-labelledby="bundle-freeze-heading">
        <div className={styles.sectionHeading}><h2 id="bundle-freeze-heading">เตรียมชุดจากฉบับที่อนุมัติ</h2><p>เลือกชุดภาพที่ผ่านการตรวจแล้ว ระบบจะใช้เนื้อหาฉบับที่ผูกกับบรีฟนั้น</p></div>
        {canFreeze ? <FreezeForm detail={detail} /> : <p className={styles.notice} data-testid="bundle-readonly"><Eye aria-hidden="true" /><span>คุณเปิดอ่านชุดที่บันทึกและตรวจไฟล์ภาพได้ การบันทึกชุดใหม่ใช้สิทธิ์อนุมัติของ{detail.work_item.kind === "scholarship" ? "ทุนการศึกษา" : "ข่าวประชาสัมพันธ์"}</span></p>}
        <div className={styles.helpLinks}><Link href={coreUrl}>เปิดเนื้อหาและแหล่งข้อมูล</Link><Link href={`${coreUrl}/visual`}>เปิดบรีฟและชุดภาพ</Link></div>
      </section>
      {detail.selected ? <BundlePreview key={detail.selected.id} detail={detail} bundle={detail.selected} /> : null}
      <BundleHistory detail={detail} />
    </main>
  </WorkspaceChrome>;
}
