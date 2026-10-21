export const TRAVEL_PAGE_SIZE = 20;
export const travelWorkflowLabels = {
  draft: "ร่าง",
  under_review: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  active: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  archived: "เก็บถาวร",
} as const;
export const travelSortLabels = {
  updated_desc: "แก้ไขล่าสุด",
  start_desc: "วันเดินทางล่าสุด",
  start_asc: "วันเดินทางเก่าสุด",
  name_asc: "ชื่อรายการ",
} as const;
export type TravelListState = {
  q: string;
  status: keyof typeof travelWorkflowLabels | "";
  country: string;
  unit: string;
  year: string;
  sort: keyof typeof travelSortLabels;
  page: number;
};
export type TravelSearchParams = Record<string, string | string[] | undefined>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTravelListState(params: TravelSearchParams): TravelListState {
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const status = first("status");
  const sort = first("sort");
  const page = first("page");
  const year = first("year");
  return {
    q: Array.from(first("q").trim()).slice(0, 200).join(""),
    status: Object.hasOwn(travelWorkflowLabels, status) ? status as TravelListState["status"] : "",
    country: uuid.test(first("country")) ? first("country").toLowerCase() : "",
    unit: uuid.test(first("unit")) ? first("unit").toLowerCase() : "",
    year: /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 3000 ? year : "",
    sort: Object.hasOwn(travelSortLabels, sort) ? sort as TravelListState["sort"] : "updated_desc",
    page: /^\d+$/.test(page) && Number.isSafeInteger(Number(page)) ? Math.min(1000000, Math.max(1, Number(page))) : 1,
  };
}

export function travelListHref(state: TravelListState, changes: Partial<TravelListState> = {}) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  for (const key of ["q", "status", "country", "unit", "year"] as const) {
    if (next[key]) params.set(key, next[key]);
  }
  if (next.sort !== "updated_desc") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  return `/travel${params.size ? `?${params}` : ""}`;
}
