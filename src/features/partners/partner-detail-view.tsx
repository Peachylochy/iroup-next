"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock,
  Clock3,
  ExternalLink,
  Globe,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { WorkspaceChrome } from "@/components/app-shell/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CurrentUserAccess } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

import {
  deletePartnerContactAction,
  logPartnerInteractionAction,
  savePartnerContactAction,
} from "./actions";
import type {
  PartnerContact,
  PartnerInteraction,
  LinkedAgreement,
  PartnerOrganization,
} from "./partner-query";

type Props = {
  access: CurrentUserAccess;
  partner: PartnerOrganization;
  agreements: LinkedAgreement[];
  contacts: PartnerContact[];
  interactions: PartnerInteraction[];
  viewer: { displayName: string; email: string; role: string };
};

const verificationBadgeMap = {
  verified: { label: "ยืนยันแล้ว", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200" },
  pending_verification: { label: "รอตรวจสอบ", icon: Clock3, className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200" },
  incomplete: { label: "ข้อมูลไม่ครบ", icon: CircleAlert, className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200" },
};

const relationshipRatingMap = {
  high: { label: "ระดับสูง (High)", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" },
  medium: { label: "ปานกลาง (Medium)", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  low: { label: "เริ่มต้น (Low)", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  unrated: { label: "ไม่ได้ระบุ", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

export function PartnerDetailView({
  access,
  partner,
  agreements,
  contacts,
  interactions,
  viewer,
}: Props) {
  const [activeTab, setActiveTab] = useState<"agreements" | "contacts" | "history">("agreements");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);

  const [contactState, saveContactFormAction, contactPending] = useActionState(
    savePartnerContactAction,
    {},
  );

  const [interactionState, logInteractionFormAction, interactionPending] = useActionState(
    logPartnerInteractionAction,
    {},
  );

  const [isDeleting, startDeleteTransition] = useTransition();

  const country = partner.countries[0];
  const canUpdate = Boolean(access.modules.mou?.update);
  const statusInfo = verificationBadgeMap[partner.verification_status];
  const StatusIcon = statusInfo.icon;

  const handleDeleteContact = (contactId: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผู้ติดต่อรายนี้?")) {
      startDeleteTransition(async () => {
        await deletePartnerContactAction(contactId, partner.id);
      });
    }
  };

  return (
    <WorkspaceChrome
      access={access}
      viewer={viewer}
      title={partner.name_th || partner.name_en || "องค์กรคู่สัญญา"}
      activePath="/mou/organizations"
    >
      <main className="module-main space-y-6">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/mou/organizations"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={14} /> กลับไปหน้ารายชื่อองค์กร
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="text-primary w-6 h-6" />
              {partner.name_th || partner.name_en}
            </h1>
            {partner.name_th && partner.name_en && (
              <p className="text-sm text-muted-foreground">{partner.name_en}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canUpdate && (
              <Link
                href={`/mou/organizations/${partner.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                แก้ไขข้อมูลองค์กร
              </Link>
            )}
          </div>
        </div>

        {/* Top Info Banner Card */}
        <Card className="border-border/60 bg-card">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs gap-1 font-medium", statusInfo.className)}>
                  <StatusIcon size={13} /> {statusInfo.label}
                </Badge>
                {partner.organization_type && (
                  <Badge variant="secondary" className="text-xs">
                    {partner.organization_type}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-primary" />
                  {[country?.name_th || country?.name_en, partner.city].filter(Boolean).join(", ") || "ไม่ระบุเมือง"}
                </span>
                {partner.website_url && (
                  <a
                    href={partner.website_url.startsWith("http") ? partner.website_url : `https://${partner.website_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe size={14} /> เว็บไซต์องค์กร <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-around border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:col-span-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{agreements.length}</p>
                <p className="text-xs text-muted-foreground">ข้อตกลง MOU</p>
              </div>
              <div className="text-center border-l border-border/60 pl-6">
                <p className="text-2xl font-bold text-foreground">{contacts.length}</p>
                <p className="text-xs text-muted-foreground">ผู้ติดต่อต่างประเทศ</p>
              </div>
              <div className="text-center border-l border-border/60 pl-6">
                <p className="text-2xl font-bold text-foreground">{interactions.length}</p>
                <p className="text-xs text-muted-foreground">ประวัติประสานงาน</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="border-b border-border/60 flex items-center justify-between">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("agreements")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "agreements"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText size={16} /> รายการ MOU ที่ลงนาม ({agreements.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "contacts"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Users size={16} /> ผู้ติดต่อต่างประเทศ ({contacts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "history"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock size={16} /> ประวัติประสานงาน ({interactions.length})
            </button>
          </div>

          {activeTab === "contacts" && canUpdate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingContact(null);
                setContactModalOpen(true);
              }}
              className="gap-1 mb-2"
            >
              <Plus size={14} /> เพิ่มผู้ติดต่อ
            </Button>
          )}

          {activeTab === "history" && canUpdate && contacts.length > 0 && (
            <Button
              size="sm"
              onClick={() => setInteractionModalOpen(true)}
              className="gap-1 mb-2"
            >
              <Plus size={14} /> บันทึกการประสานงาน
            </Button>
          )}
        </div>

        {/* Tab 1: Agreements */}
        {activeTab === "agreements" && (
          <div className="space-y-4">
            {agreements.length === 0 ? (
              <Card className="border-dashed border-border/60 text-center p-8">
                <CardContent className="space-y-2">
                  <FileText className="mx-auto text-muted-foreground w-8 h-8" />
                  <h3 className="font-semibold text-sm">ยังไม่มี MOU ที่เชื่อมโยงกับองค์กรนี้</h3>
                  <p className="text-xs text-muted-foreground">
                    สร้างรายการ MOU ใหม่และเลือกองค์กรนี้เป็นองค์กรคู่สัญญา
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {agreements.map((agreement) => (
                  <Card key={agreement.id} className="border-border/60 hover:bg-muted/30 transition-all">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {agreement.title_th || agreement.title_en}
                          </span>
                          {agreement.agreement_number && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {agreement.agreement_number}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ปีงบประมาณ {agreement.fiscal_year || "-"} · สถานะ: {agreement.status}
                        </p>
                      </div>

                      <Link
                        href={`/mou/${agreement.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1 shrink-0" })}
                      >
                        ดูรายละเอียด <ExternalLink size={12} />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Contacts */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            {contacts.length === 0 ? (
              <Card className="border-dashed border-border/60 text-center p-8">
                <CardContent className="space-y-2">
                  <Users className="mx-auto text-muted-foreground w-8 h-8" />
                  <h3 className="font-semibold text-sm">ยังไม่มีข้อมูลผู้ติดต่อต่างประเทศ</h3>
                  <p className="text-xs text-muted-foreground">
                    บันทึกผู้ติดต่อต่างประเทศเพื่อใช้ติดตามและประสานงานความร่วมมือ
                  </p>
                  {canUpdate && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingContact(null);
                        setContactModalOpen(true);
                      }}
                      className="gap-1 mt-2"
                    >
                      <Plus size={14} /> เพิ่มผู้ติดต่อแรก
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.map((contact) => {
                  const primaryEmail = contact.partner_contact_methods?.find((m) => m.method_type === "email")?.value;
                  const primaryPhone = contact.partner_contact_methods?.find((m) => m.method_type === "phone")?.value;
                  const relRating = relationshipRatingMap[contact.relationship_level] || relationshipRatingMap.unrated;

                  return (
                    <Card key={contact.id} className="border-border/60">
                      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-primary" /> {contact.full_name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {[contact.position_title, contact.department].filter(Boolean).join(" · ") || "ไม่ระบุตำแหน่ง"}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] font-normal", relRating.className)}>
                          {relRating.label}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="space-y-1 text-muted-foreground">
                          {primaryEmail && (
                            <p className="flex items-center gap-2">
                              <Mail size={13} className="text-primary shrink-0" />
                              <a href={`mailto:${primaryEmail}`} className="text-foreground hover:underline">
                                {primaryEmail}
                              </a>
                            </p>
                          )}
                          {primaryPhone && (
                            <p className="flex items-center gap-2">
                              <Phone size={13} className="text-primary shrink-0" />
                              <a href={`tel:${primaryPhone}`} className="text-foreground hover:underline">
                                {primaryPhone}
                              </a>
                            </p>
                          )}
                        </div>

                        {contact.internal_note && (
                          <p className="text-muted-foreground bg-muted/40 p-2 rounded text-[11px] italic">
                            &ldquo;{contact.internal_note}&rdquo;
                          </p>
                        )}

                        {canUpdate && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setEditingContact(contact);
                                setContactModalOpen(true);
                              }}
                            >
                              แก้ไข
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-red-600 hover:text-red-700"
                              disabled={isDeleting}
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 size={12} /> ลบ
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {interactions.length === 0 ? (
              <Card className="border-dashed border-border/60 text-center p-8">
                <CardContent className="space-y-2">
                  <Clock className="mx-auto text-muted-foreground w-8 h-8" />
                  <h3 className="font-semibold text-sm">ยังไม่มีบันทึกประวัติการประสานงาน</h3>
                  <p className="text-xs text-muted-foreground">
                    บันทึกเหตุการณ์ การส่งอีเมล ประชุม หรือการเข้าเยี่ยมชมกับผู้ติดต่อต่างประเทศ
                  </p>
                  {canUpdate && contacts.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => setInteractionModalOpen(true)}
                      className="gap-1 mt-2"
                    >
                      <Plus size={14} /> บันทึกการประสานงานแรก
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {interactions.map((item) => (
                  <Card key={item.id} className="border-border/60">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <MessageSquare size={13} className="text-primary" /> {item.context || "บันทึกการติดต่อ"}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar size={12} /> {item.occurred_on || "ไม่ระบุวันที่"}
                        </span>
                      </div>
                      {item.partner_contacts?.full_name && (
                        <p className="text-xs text-muted-foreground">
                          ผู้ติดต่อ: <strong className="text-foreground">{item.partner_contacts.full_name}</strong>
                        </p>
                      )}
                      {item.note && <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded">{item.note}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Add/Edit Contact */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "แก้ไขข้อมูลผู้ติดต่อ" : "เพิ่มผู้ติดต่อต่างประเทศใหม่"}</DialogTitle>
            <DialogDescription>
              บันทึกข้อมูลบุคคลติดต่อของ {partner.name_th || partner.name_en} เพื่อใช้ประสานงาน
            </DialogDescription>
          </DialogHeader>

          <form action={saveContactFormAction} className="space-y-4 text-xs pt-2">
            <input type="hidden" name="partner_organization_id" value={partner.id} />
            {editingContact && <input type="hidden" name="contact_id" value={editingContact.id} />}

            <div className="space-y-1">
              <label className="font-medium">ชื่อ–นามสกุลผู้ติดต่อ <span className="text-red-500">*</span></label>
              <Input
                name="full_name"
                defaultValue={editingContact?.full_name || ""}
                placeholder="e.g. Prof. Dr. John Smith"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium">ตำแหน่ง (Position Title)</label>
                <Input
                  name="position_title"
                  defaultValue={editingContact?.position_title || ""}
                  placeholder="e.g. Vice President for International Affairs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium">คณะ/หน่วยงาน (Department)</label>
                <Input
                  name="department"
                  defaultValue={editingContact?.department || ""}
                  placeholder="e.g. Faculty of Science"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium">อีเมลหลัก (Primary Email)</label>
                <Input
                  name="email"
                  type="email"
                  defaultValue={editingContact?.partner_contact_methods?.find((m) => m.method_type === "email")?.value || ""}
                  placeholder="contact@university.edu"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium">เบอร์โทรศัพท์ (Primary Phone)</label>
                <Input
                  name="phone"
                  defaultValue={editingContact?.partner_contact_methods?.find((m) => m.method_type === "phone")?.value || ""}
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium">ระดับความสัมพันธ์ (Relationship Level)</label>
              <select
                name="relationship_level"
                defaultValue={editingContact?.relationship_level || "unrated"}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                <option value="unrated">ไม่ได้ระบุ</option>
                <option value="high">ระดับสูง (High) - ติดต่อสม่ำเสมอ/สนิทสนม</option>
                <option value="medium">ปานกลาง (Medium) - ประสานงานทั่วไป</option>
                <option value="low">เริ่มต้น (Low) - เพิ่งเริ่มติดต่อ</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium">บันทึกเพิ่มเติมภายใน (Internal Note)</label>
              <textarea
                name="internal_note"
                rows={2}
                defaultValue={editingContact?.internal_note || ""}
                placeholder="บันทึกข้อความเฉพาะเจ้าหน้าที่..."
                className="w-full rounded-md border border-input bg-transparent p-2 text-xs"
              />
            </div>

            {contactState?.error && (
              <p className="text-red-600 bg-red-50 p-2 rounded text-xs">{contactState.error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setContactModalOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={contactPending}>
                {contactPending ? "กำลังบันทึก..." : "บันทึกข้อมูลผู้ติดต่อ"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Log Interaction */}
      <Dialog open={interactionModalOpen} onOpenChange={setInteractionModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>บันทึกประวัติการประสานงาน</DialogTitle>
            <DialogDescription>
              บันทึกเหตุการณ์ ประชุม หรือส่งอีเมลกับผู้ติดต่อต่างประเทศของ {partner.name_th || partner.name_en}
            </DialogDescription>
          </DialogHeader>

          <form action={logInteractionFormAction} className="space-y-4 text-xs pt-2">
            <input type="hidden" name="partner_organization_id" value={partner.id} />

            <div className="space-y-1">
              <label className="font-medium">เลือกผู้ติดต่อ <span className="text-red-500">*</span></label>
              <select
                name="partner_contact_id"
                required
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.position_title ? `(${c.position_title})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium">วันที่ทำกิจกรรม <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  name="occurred_on"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium">ช่องทางการติดต่อ</label>
                <select
                  name="interaction_type"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
                >
                  <option value="email">อีเมล (Email)</option>
                  <option value="meeting">ประชุมออนไลน์/ในสถานที่ (Meeting)</option>
                  <option value="visit">การเข้าเยี่ยมชมมหาวิทยาลัย (Visit)</option>
                  <option value="phone">โทรศัพท์ (Call)</option>
                  <option value="other">อื่นๆ (Other)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium">หัวข้อ/บริบทการประสานงาน <span className="text-red-500">*</span></label>
              <Input
                name="context"
                placeholder="e.g. ประชุมหารือการจัดทำร่าง MOU แลกเปลี่ยนนิสิต"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium">รายละเอียดผลการหารือ/ข้อสรุป</label>
              <textarea
                name="note"
                rows={3}
                placeholder="สรุปประเด็นสำคัญ หรือสิ่งที่ต้องดำเนินการต่อ..."
                className="w-full rounded-md border border-input bg-transparent p-2 text-xs"
              />
            </div>

            {interactionState?.error && (
              <p className="text-red-600 bg-red-50 p-2 rounded text-xs">{interactionState.error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setInteractionModalOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={interactionPending}>
                {interactionPending ? "กำลังบันทึก..." : "บันทึกประวัติ"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </WorkspaceChrome>
  );
}
