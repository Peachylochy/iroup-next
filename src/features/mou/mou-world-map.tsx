"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  Globe,
  Handshake,
  Landmark,
  Layers,
  MapPin,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CountryStat, ContinentStat } from "./mou-analytics-query";

type Props = {
  countryStats: CountryStat[];
  continentStats: ContinentStat[];
  totalAgreementsCount: number;
};

export function MouWorldMap({ countryStats, continentStats, totalAgreementsCount }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<CountryStat | null>(null);

  const activeCountriesCount = countryStats.length;

  return (
    <div className="space-y-6">
      {/* Top Stat Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCountriesCount}</p>
              <p className="text-xs text-muted-foreground">ประเทศคู่ความร่วมมือทั่วโลก</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAgreementsCount}</p>
              <p className="text-xs text-muted-foreground">ข้อตกลงความร่วมมือทั้งหมด</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {countryStats.reduce((acc, curr) => acc + curr.activeMous, 0)}
              </p>
              <p className="text-xs text-muted-foreground">MOU สถานะมีผลบังคับใช้ (Active)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {continentStats.filter((c) => c.countryCount > 0).length} / 6
              </p>
              <p className="text-xs text-muted-foreground">ทวีปที่มีความร่วมมือ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continents Overview Pill Strip */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            กระจายตามทวีป (Continents Overview)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {continentStats.map((c) => (
              <div
                key={c.code}
                className="p-3 rounded-lg border bg-card/60 flex flex-col justify-between space-y-1"
              >
                <span className="text-xs font-semibold text-foreground truncate">{c.nameTh}</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold text-primary">{c.totalMous}</span>
                  <span className="text-[11px] text-muted-foreground">{c.countryCount} ประเทศ</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interactive Country Cards Grid */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            รายชื่อประเทศที่มีความร่วมมือ (Partner Countries)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            คลิกที่ประเทศเพื่อดูรายชื่อองค์กรคู่สัญญาและรายการ MOU ทั้งหมด
          </CardDescription>
        </CardHeader>
        <CardContent>
          {countryStats.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
              ยังไม่มีข้อมูลประเทศคู่สัญญา
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {countryStats.map((country) => (
                <button
                  key={country.iso2}
                  type="button"
                  onClick={() => setSelectedCountry(country)}
                  className="p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-all text-left flex flex-col justify-between group space-y-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                        {country.nameTh}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {country.iso2}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground truncate">{country.nameEn}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs w-full">
                    <span className="text-muted-foreground">
                      MOU: <strong className="text-foreground">{country.totalMous} ฉบับ</strong>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Active: {country.activeMous}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Country Detail Dialog */}
      {selectedCountry && (
        <Dialog open={Boolean(selectedCountry)} onOpenChange={(open) => !open && setSelectedCountry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5 text-primary" />
                {selectedCountry.nameTh} ({selectedCountry.nameEn})
              </DialogTitle>
              <DialogDescription>
                พบข้อตกลงความร่วมมือทั้งหมด {selectedCountry.totalMous} ฉบับ (มีผลบังคับใช้ {selectedCountry.activeMous} ฉบับ)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
              {selectedCountry.agreements.map((agreement) => {
                const partner = agreement.agreement_partners[0];
                const org = partner?.partner_organizations;
                const orgName =
                  partner?.partner_name_en_snapshot ||
                  org?.name_en ||
                  partner?.partner_name_th_snapshot ||
                  org?.name_th ||
                  "องค์กรคู่สัญญา";

                const ownerUnit = agreement.agreement_units.find((u) => u.is_owner)?.organization_units?.name_th;

                return (
                  <div key={agreement.id} className="p-3 rounded-lg border bg-card/60 space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground">{agreement.title_th}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {agreement.status}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{orgName}</span>
                      {ownerUnit && (
                        <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                          <Building2 className="w-3 h-3" /> {ownerUnit}
                        </span>
                      )}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-muted-foreground">
                      <span>
                        ปีงบประมาณ: {agreement.fiscal_year || "-"}
                      </span>
                      <Link
                        href={`/mou/${agreement.id}`}
                        className={buttonVariants({ variant: "ghost", size: "xs", className: "gap-1 text-primary" })}
                        onClick={() => setSelectedCountry(null)}
                      >
                        ดูรายละเอียด <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
