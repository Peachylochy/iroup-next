import type { TravelListState } from "./travel-list-state";

export type TravelListRow = {
  id: string;
  project_name: string;
  title_en: string | null;
  country_name: string | null;
  partner_name: string | null;
  owner_unit_name: string | null;
  start_date: string | null;
  end_date: string | null;
  fiscal_year: number | null;
  workflow_status: Exclude<TravelListState["status"], "">;
  participant_count: number;
  updated_at: string;
};
export type TravelFilterOption = { id: string; label: string };
export type TravelListResult = {
  rows: TravelListRow[];
  total: number;
  page: number;
  pageSize: 20;
  summary: { total: number; active: number; underReview: number };
  filters: { countries: TravelFilterOption[]; units: TravelFilterOption[]; years: number[] };
};
