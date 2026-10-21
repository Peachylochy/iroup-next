"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, FilePenLine, Plus } from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { buttonVariants } from "@/components/ui/button";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import { contentStateLabels, type ContentKind, type ContentListResult } from "./types";
import styles from "./content-editor.module.css";

export function ContentProductionWorkspace({ kind, access, viewer, result }: {
  kind: ContentKind;
  access: CurrentUserAccess;
  viewer: { displayName: string; email: string; role: string };
  result: ContentListResult;
}) {
  const title = kind === "scholarship" ? "ทุนการศึกษา" : "ข่าวประชาสัมพันธ์";
  const readOnly = !access.modules[kind].create && !access.modules[kind].update && !access.modules[kind].publish;
  const pages = Math.max(1, Math.ceil(result.total / result.page_size));
  const first = result.total ? (result.page - 1) * result.page_size + 1 : 0;
  return <WorkspaceChrome access={access} viewer={viewer} title="จัดทำเนื้อหา" activePath="/content-production" hidePlaceholderControls>
    <main className={styles.main}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>งานประชาสัมพันธ์</p><h1>จัดทำเนื้อหา</h1><p className={styles.description}>เตรียมข้อเท็จจริง แหล่งข้อมูล และร่างสองภาษาสำหรับเว็บไซต์และ Facebook</p></div>{access.modules[kind].create ? <Link className={cn(buttonVariants({ size: "lg" }), styles.primaryLink)} href={`/content-production/${kind}/new`}><Plus aria-hidden="true" /> เริ่มเรื่องใหม่</Link> : null}</header>
      <nav className={styles.statusLine} aria-label="ประเภทเนื้อหา"><div className={styles.statusLine}>{access.modules.scholarship.view ? <Link href="/content-production?kind=scholarship" aria-current={kind === "scholarship" ? "page" : undefined} className={cn(buttonVariants({ variant: kind === "scholarship" ? "default" : "outline", size: "lg" }), styles.primaryLink)}>ทุนการศึกษา</Link> : null}{access.modules.news.view ? <Link href="/content-production?kind=news" aria-current={kind === "news" ? "page" : undefined} className={cn(buttonVariants({ variant: kind === "news" ? "default" : "outline", size: "lg" }), styles.primaryLink)}>ข่าวประชาสัมพันธ์</Link> : null}</div><Link href={kind === "scholarship" ? "/scholarships" : "/news"} className={styles.backLink}><ArrowLeft aria-hidden="true" /> รายการ{title}เดิม</Link></nav>
      {readOnly ? <p className={styles.notice} data-testid="content-readonly"><Eye aria-hidden="true" /><span>สิทธิ์อ่านอย่างเดียว คุณดูร่างเนื้อหาและประวัติการตรวจได้</span></p> : null}
      <section className={styles.panel} aria-labelledby="content-list-heading"><div className={styles.sectionHeading}><div><h2 id="content-list-heading">รายการ{title}</h2><p>สถานะในหน้านี้เป็นสถานะการจัดทำเนื้อหา การอนุมัติยังไม่เผยแพร่</p></div><span className={styles.badge}>{result.total.toLocaleString("th-TH")} รายการ</span></div>
        {result.rows.length ? <div data-testid="content-list">{result.rows.map((record) => <article className={styles.listRow} key={record.id}><div><h3>{record.title_th}</h3><p>{record.work_item_id ? "มีพื้นที่จัดทำเนื้อหาแล้ว" : "พร้อมนำข้อมูลเดิมมาเริ่มจัดทำร่าง"}</p></div><span className={cn(styles.badge, record.state === "approved" ? styles.approved : record.state === "stale" ? styles.warning : undefined)}>{contentStateLabels[record.state]}</span><Link className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.primaryLink)} href={`/content-production/${kind}/${record.id}`} aria-label={`เปิดงาน ${record.title_th}`}>เปิดงาน <ArrowRight aria-hidden="true" /></Link></article>)}</div> : <div className={styles.empty}><FilePenLine aria-hidden="true" /><h3>ยังไม่มีรายการ{title}</h3><p>{access.modules[kind].create ? "เริ่มเรื่องใหม่เพื่อตรวจแหล่งข้อมูลและจัดทำร่างแรก" : "รายการจะแสดงเมื่อมีผู้จัดทำเรื่องใหม่"}</p></div>}
        {result.total ? <nav className={styles.statusLine} aria-label="หน้ารายการเนื้อหา"><p className={styles.meta}>รายการ {first}–{Math.min(result.total, first + result.rows.length - 1)} จาก {result.total} · หน้า {result.page} / {pages}</p><div className={styles.actions}>{result.page > 1 ? <Link className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.primaryLink)} href={`/content-production?kind=${kind}&page=${result.page - 1}`}>ก่อนหน้า</Link> : null}{result.page < pages ? <Link className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.primaryLink)} href={`/content-production?kind=${kind}&page=${result.page + 1}`}>ถัดไป</Link> : null}</div></nav> : null}
      </section>
    </main>
  </WorkspaceChrome>;
}
