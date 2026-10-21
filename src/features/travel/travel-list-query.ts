import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { travelWorkflowLabels, type TravelListState } from "./travel-list-state";
import type { TravelListResult } from "./travel-list-types";

const count = z.number().int().nonnegative();
const nullableText = z.string().nullable();
const workflowStatuses = Object.keys(travelWorkflowLabels) as [
  keyof typeof travelWorkflowLabels, ...Array<keyof typeof travelWorkflowLabels>,
];
const option = z.object({ id: z.string(), label: z.string() }).strict();
// Strict DTO validation fails a drifting RPC contract rather than forwarding
// unexpected fields (for example private notes) into a client component.
const resultSchema: z.ZodType<TravelListResult> = z.object({
  rows: z.array(z.object({
    id: z.string(), project_name: z.string(), title_en: nullableText,
    country_name: nullableText, partner_name: nullableText, owner_unit_name: nullableText,
    start_date: nullableText, end_date: nullableText, fiscal_year: z.number().int().nullable(),
    workflow_status: z.enum(workflowStatuses), participant_count: count, updated_at: z.string(),
  }).strict()).max(20),
  total: count,
  page: z.number().int().positive(),
  pageSize: z.literal(20),
  summary: z.object({ total: count, active: count, underReview: count }).strict(),
  filters: z.object({ countries: z.array(option), units: z.array(option), years: z.array(z.number().int()) }).strict(),
}).strict();

export async function getTravelList(state: TravelListState): Promise<TravelListResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("travel_list_v2", {
    p_q: state.q,
    p_status: state.status,
    p_country: state.country || null,
    p_unit: state.unit || null,
    p_year: state.year ? Number(state.year) : null,
    p_sort: state.sort,
    p_page: state.page,
  });

  if (error) throw new Error(`Unable to load Travel list: ${error.message}`);
  const parsed = resultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid Travel list response");
  return parsed.data;
}
