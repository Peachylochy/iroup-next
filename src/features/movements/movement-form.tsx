"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { MasterSearchSelect } from "@/components/forms/master-search-select";
import {
  PersonMasterSearch,
  type PersonMasterResult,
} from "@/components/forms/person-master-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deriveThaiFiscalYear } from "@/features/mobility/fiscal-year";
import type { MobilityFormOptions } from "@/features/mobility/mobility-query";

import {
  saveStaffMovement,
  type StaffMovementFormState,
} from "./actions";
import {
  staffMovementModules,
  type StaffMovementModule,
} from "./config";
import type { StaffMovementRecord } from "./movement-query";

type Participant = {
  person_id: string | null;
  full_name_snapshot: string;
  organization_unit_id_snapshot: string | null;
  organization_unit_name_snapshot: string;
  position_snapshot: string;
  participant_role: string;
};

type Funding = {
  budget_type: string;
  source_name: string;
  amount: string;
  currency: string;
  note: string;
};

const initialState: StaffMovementFormState = {};

export function StaffMovementForm({
  module,
  movement,
  options,
}: {
  module: StaffMovementModule;
  movement: StaffMovementRecord | null;
  options: MobilityFormOptions;
}) {
  const config = staffMovementModules[module];
  const [state, formAction, pending] = useActionState(
    saveStaffMovement,
    initialState,
  );
  const [startDate, setStartDate] = useState(movement?.start_date || "");
  const [participants, setParticipants] = useState<Participant[]>(() =>
    movement?.movement_participants.map((item) => ({
      person_id: item.person_id,
      full_name_snapshot: item.full_name_snapshot,
      organization_unit_id_snapshot: item.organization_unit_id_snapshot,
      organization_unit_name_snapshot:
        item.organization_unit_name_snapshot || "",
      position_snapshot: item.position_snapshot || "",
      participant_role: item.participant_role || "ผู้เดินทาง",
    })) || [],
  );
  const [funding, setFunding] = useState<Funding[]>(() =>
    movement?.movement_funding.map((item) => ({
      budget_type: item.budget_type,
      source_name: item.source_name || "",
      amount: item.amount?.toString() || "",
      currency: item.currency,
      note: item.note || "",
    })) || [],
  );
  const isLocked = Boolean(
    movement && movement.workflow_status !== "draft",
  );
  const fiscalYear = useMemo(
    () => deriveThaiFiscalYear(startDate) || String(movement?.fiscal_year || ""),
    [movement?.fiscal_year, startDate],
  );

  useEffect(() => {
    if (state.success && state.id && !movement) {
      window.location.assign(`${config.route}/${state.id}`);
    }
  }, [config.route, movement, state.id, state.success]);

  const addParticipant = () =>
    setParticipants((items) => [
      ...items,
      {
        person_id: null,
        full_name_snapshot: "",
        organization_unit_id_snapshot: null,
        organization_unit_name_snapshot: "",
        position_snapshot: "",
        participant_role: "ผู้เดินทาง",
      },
    ]);
  const addFunding = () =>
    setFunding((items) => [
      ...items,
      {
        budget_type: "",
        source_name: "",
        amount: "",
        currency: "THB",
        note: "",
      },
    ]);

  return (
    <main className="module-main mou-form-page">
      <div className="module-page-heading">
        <div>
          <Link className="back-link" href={config.route}>
            <ArrowLeft /> กลับไปรายการ{config.title}
          </Link>
          <p className="module-eyebrow">การเดินทางและ Mobility</p>
          <h1>{movement ? `แก้ไข${config.itemLabel}` : `เพิ่ม${config.itemLabel}`}</h1>
          <p>{config.description}</p>
        </div>
      </div>

      <form action={formAction} className="mou-editor-form">
        <input type="hidden" name="movement_module" value={module} />
        <input type="hidden" name="movement_id" value={movement?.id || ""} />
        <input type="hidden" name="updated_at" value={movement?.updated_at || ""} />
        <input
          type="hidden"
          name="participants_json"
          value={JSON.stringify(participants)}
        />
        <input
          type="hidden"
          name="funding_json"
          value={JSON.stringify(
            funding.map((item) => ({
              ...item,
              amount: item.amount ? Number(item.amount) : null,
            })),
          )}
        />
        <input type="hidden" name="fiscal_year" value={fiscalYear} />

        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>1</span>
            <div>
              <h2>ข้อมูลโครงการและวัตถุประสงค์</h2>
              <p>บันทึกชื่อเรื่อง ประเภท และปลายทางของการเดินทาง</p>
            </div>
          </div>
          <div className="mou-form-grid">
            <label className="mou-field mou-field-wide">
              ชื่อโครงการหรือเรื่องที่เดินทาง *
              <Input
                name="project_name"
                defaultValue={movement?.project_name || ""}
                required
                disabled={isLocked}
              />
            </label>
            <label className="mou-field mou-field-wide">
              ชื่อภาษาอังกฤษ
              <Input
                name="title_en"
                defaultValue={movement?.title_en || ""}
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              ทิศทาง
              <select
                name="direction"
                defaultValue={movement?.direction || "outbound"}
                disabled={isLocked}
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
                <option value="bilateral">Bilateral</option>
                <option value="not_applicable">ไม่ระบุทิศทาง</option>
              </select>
            </label>
            <label className="mou-field">
              ประเภทกิจกรรม
              <Input
                name="activity_type"
                defaultValue={movement?.activity_type || ""}
                placeholder="ประชุม อบรม วิจัย หรือปฏิบัติงาน"
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              รูปแบบ
              <Input
                name="mobility_mode"
                defaultValue={movement?.mobility_mode || ""}
                placeholder="Exchange, Training, Official travel"
                disabled={isLocked}
              />
            </label>
            <label className="mou-field mou-field-wide">
              วัตถุประสงค์
              <textarea
                name="purpose"
                rows={3}
                defaultValue={movement?.purpose || ""}
                disabled={isLocked}
              />
            </label>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>2</span>
            <div>
              <h2>ปลายทางและหน่วยงานเจ้าของ</h2>
              <p>ค้นหาจาก Data Master กลางของระบบ</p>
            </div>
          </div>
          <div className="mou-form-grid">
            <label className="mou-field">
              ประเทศ
              <MasterSearchSelect
                name="country_id"
                value={movement?.country_id || ""}
                options={options.countries.map((item) => ({
                  value: item.id,
                  label: item.name_th,
                  description: item.name_en,
                }))}
                placeholder="ค้นหาประเทศ"
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              เมือง
              <Input
                name="city"
                defaultValue={movement?.city || ""}
                disabled={isLocked}
              />
            </label>
            <label className="mou-field mou-field-wide">
              องค์กรหรือสถาบันปลายทาง
              <MasterSearchSelect
                name="partner_organization_id"
                value={movement?.partner_organization_id || ""}
                options={options.partners.map((item) => ({
                  value: item.id,
                  label: item.name_th || item.name_en,
                  description: item.name_th ? item.name_en : null,
                }))}
                placeholder="ค้นหาองค์กร (เว้นว่างได้หากไม่ทราบ)"
                disabled={isLocked}
              />
            </label>
            <label className="mou-field mou-field-wide">
              หน่วยงานเจ้าของ ม.พะเยา *
              <MasterSearchSelect
                name="owner_unit_id"
                value={movement?.owner_unit_id || ""}
                options={options.units.map((item) => ({
                  value: item.id,
                  label: item.name_th,
                  description: item.name_en,
                }))}
                placeholder="ค้นหาหน่วยงาน"
                required
                disabled={isLocked}
              />
            </label>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>3</span>
            <div>
              <h2>วันเดินทางและเอกสารอนุมัติ</h2>
              <p>ปีงบประมาณคำนวณจากวันเริ่มเดินทางโดยอัตโนมัติ</p>
            </div>
          </div>
          <div className="mou-form-grid">
            <label className="mou-field">
              วันไป *
              <Input
                type="date"
                name="start_date"
                defaultValue={startDate}
                onChange={(event) => setStartDate(event.currentTarget.value)}
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              วันกลับ *
              <Input
                type="date"
                name="end_date"
                defaultValue={movement?.end_date || ""}
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              เวลาออกเดินทาง
              <Input
                type="datetime-local"
                name="departure_at"
                defaultValue={movement?.departure_at?.slice(0, 16) || ""}
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              เวลากลับ
              <Input
                type="datetime-local"
                name="return_at"
                defaultValue={movement?.return_at?.slice(0, 16) || ""}
                disabled={isLocked}
              />
            </label>
            <label className="mou-field">
              ปีงบประมาณ
              <Input readOnly value={fiscalYear} />
            </label>
            <label className="mou-field">
              เลขที่หนังสือ/คำสั่งอนุมัติ
              <Input
                name="approval_reference"
                defaultValue={movement?.approval_reference || ""}
                disabled={isLocked}
              />
            </label>
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>4</span>
            <div>
              <h2>ผู้เดินทาง</h2>
              <p>ค้นหาบุคลากรจาก Data Master หรือกรอกชื่อภายนอกด้วยตนเอง</p>
            </div>
          </div>
          <div className="space-y-3">
            {participants.map((participant, index) => (
              <div className="mobility-participant-editor" key={index}>
                <div className="mobility-participant-master">
                  <PersonMasterSearch
                    personType="staff"
                    disabled={isLocked}
                    selected={
                      participant.person_id
                        ? {
                            id: participant.person_id,
                            personType: "staff",
                            sourceIdentifier: null,
                            fullNameTh: participant.full_name_snapshot,
                            fullNameEn: null,
                            organizationUnitId:
                              participant.organization_unit_id_snapshot,
                            organizationUnitName:
                              participant.organization_unit_name_snapshot ||
                              null,
                            programOrPosition:
                              participant.position_snapshot || null,
                          }
                        : null
                    }
                    onSelect={(person: PersonMasterResult | null) =>
                      setParticipants((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? person
                              ? {
                                  ...item,
                                  person_id: person.id,
                                  full_name_snapshot:
                                    person.fullNameTh ||
                                    person.fullNameEn ||
                                    "",
                                  organization_unit_id_snapshot:
                                    person.organizationUnitId,
                                  organization_unit_name_snapshot:
                                    person.organizationUnitName || "",
                                  position_snapshot:
                                    person.programOrPosition || "",
                                }
                              : { ...item, person_id: null }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <Input
                  placeholder="ชื่อ-นามสกุล *"
                  value={participant.full_name_snapshot}
                  disabled={isLocked}
                  onChange={(event) =>
                    setParticipants((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              full_name_snapshot: event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="หน่วยงาน"
                  value={participant.organization_unit_name_snapshot}
                  disabled={isLocked}
                  onChange={(event) =>
                    setParticipants((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              organization_unit_name_snapshot:
                                event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="ตำแหน่ง"
                  value={participant.position_snapshot}
                  disabled={isLocked}
                  onChange={(event) =>
                    setParticipants((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              position_snapshot: event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isLocked}
                  onClick={() =>
                    setParticipants((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 /> ลบ
                </Button>
              </div>
            ))}
            {!isLocked ? (
              <Button type="button" variant="outline" onClick={addParticipant}>
                <Plus /> เพิ่มผู้เดินทาง
              </Button>
            ) : null}
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>5</span>
            <div>
              <h2>งบประมาณ</h2>
              <p>เพิ่มได้หลายแหล่งงบประมาณ หรือเว้นว่างได้</p>
            </div>
          </div>
          <div className="space-y-3">
            {funding.map((item, index) => (
              <div
                className="grid grid-cols-1 gap-3 border border-border p-3 md:grid-cols-4"
                key={index}
              >
                <Input
                  placeholder="ประเภทงบ"
                  value={item.budget_type}
                  disabled={isLocked}
                  onChange={(event) =>
                    setFunding((items) =>
                      items.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, budget_type: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="แหล่งงบประมาณ"
                  value={item.source_name}
                  disabled={isLocked}
                  onChange={(event) =>
                    setFunding((items) =>
                      items.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, source_name: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="จำนวนเงิน"
                  value={item.amount}
                  disabled={isLocked}
                  onChange={(event) =>
                    setFunding((items) =>
                      items.map((value, itemIndex) =>
                        itemIndex === index
                          ? { ...value, amount: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isLocked}
                  onClick={() =>
                    setFunding((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 /> ลบ
                </Button>
              </div>
            ))}
            {!isLocked ? (
              <Button type="button" variant="outline" onClick={addFunding}>
                <Plus /> เพิ่มแหล่งงบ
              </Button>
            ) : null}
          </div>
        </section>

        <section className="mou-form-section">
          <div className="mou-form-section-heading">
            <span>6</span>
            <div>
              <h2>หมายเหตุภายใน</h2>
              <p>ไม่แสดงข้อมูลส่วนนี้ใน Public Portal</p>
            </div>
          </div>
          <textarea
            name="internal_note"
            rows={4}
            defaultValue={movement?.internal_note || ""}
            disabled={isLocked}
          />
        </section>

        {state.error ? (
          <p className="mou-form-message is-error">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mou-form-message is-success">
            <CheckCircle2 /> บันทึกข้อมูลเรียบร้อย
          </p>
        ) : null}
        {!isLocked ? (
          <div className="mou-form-actions">
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="outline"
              disabled={pending}
            >
              <Save /> บันทึกร่าง
            </Button>
            <Button
              type="submit"
              name="intent"
              value="review"
              disabled={pending}
            >
              <FileCheck2 /> บันทึกและส่งตรวจ
            </Button>
          </div>
        ) : null}
      </form>
    </main>
  );
}
