import { Building2, Award } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { FacultyStat } from "./mou-analytics-query";

type Props = {
  facultyStats: FacultyStat[];
  totalAgreementsCount: number;
  onSelectFaculty?: (unitId: string) => void;
};

export function MouFacultyBreakdown({
  facultyStats,
  totalAgreementsCount,
  onSelectFaculty,
}: Props) {
  const maxMous = facultyStats[0]?.totalMous || 1;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          สรุปความร่วมมือตามคณะ / หน่วยงาน ม.พะเยา (Faculty Breakdown)
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          แสดงจำนวนและสัดส่วนข้อตกลงความร่วมมือที่แต่ละคณะ/หน่วยงานได้รับมอบหมายหรือเป็นเจ้าของหลัก
        </CardDescription>
      </CardHeader>
      <CardContent>
        {facultyStats.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            ยังไม่มีข้อมูลหน่วยงานรับผิดชอบ
          </div>
        ) : (
          <div className="space-y-4">
            {facultyStats.map((fac, idx) => {
              const percentage =
                totalAgreementsCount > 0
                  ? Math.round((fac.totalMous / totalAgreementsCount) * 100)
                  : 0;

              const barWidthPercentage = Math.round((fac.totalMous / maxMous) * 100);

              return (
                <div
                  key={fac.unitId}
                  className="space-y-1.5 p-3 rounded-lg border bg-card/40 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-center">
                        #{idx + 1}
                      </span>
                      <span>{fac.nameTh}</span>
                      {fac.code && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {fac.code}
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                          <Award className="w-3 h-3" /> อันดับ 1
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        เจ้าของหลัก: <strong className="text-foreground">{fac.ownerCount}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectFaculty?.(fac.unitId)}
                        className="font-semibold text-primary hover:underline"
                      >
                        {fac.totalMous} ฉบับ ({percentage}%)
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidthPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
