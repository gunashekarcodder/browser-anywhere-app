import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Zone = {
  id: string;
  name: string;
  ward: string | null;
  drainage_risk: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export type Camera = {
  id: string;
  name: string;
  camera_type: string;
  source_url: string | null;
  lat: number | null;
  lng: number | null;
  zone_id: string | null;
  status: string;
  notes: string | null;
};

export type Incident = {
  id: string;
  zone_id: string | null;
  camera_id: string | null;
  status: string;
  severity_score: number;
  severity_band: string;
  water_coverage: number;
  road_blocked_ratio: number;
  persistence_seconds: number;
  people_count: number;
  vehicle_count: number;
  model_version: string;
  ai_verified: boolean;
  ai_summary: string | null;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  resolution_note: string | null;
  deleted_at: string | null;
  archived_at: string | null;
};

export type Evidence = {
  id: string;
  incident_id: string | null;
  image_url: string | null;
  water_coverage: number;
  severity_score: number;
  caption: string | null;
  captured_at: string;
};

export type FrameMetric = {
  id: string;
  camera_id: string | null;
  incident_id: string | null;
  water_coverage: number;
  road_coverage: number;
  texture_score: number;
  severity_score: number;
  people_count: number;
  vehicle_count: number;
  verdict: string;
  source_label: string | null;
  created_at: string;
};

export type OperatorAction = {
  id: string;
  incident_id: string | null;
  action_type: string;
  actor: string;
  note: string | null;
  created_at: string;
};

export type Dataset = {
  id: string;
  name: string;
  source_url: string;
  licence: string | null;
  images_count: number | null;
  videos_count: number | null;
  purpose: string | null;
  status: string;
  notes: string | null;
};

export type ModelEval = {
  id: string;
  model_version: string;
  split: string;
  metric_name: string;
  metric_value: number;
  sample_count: number | null;
  notes: string | null;
  created_at: string;
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export const zonesQuery = queryOptions({
  queryKey: ["zones"],
  queryFn: async () =>
    unwrap<Zone[]>(await supabase.from("zones").select("*").order("name")) as Zone[],
});

export const camerasQuery = queryOptions({
  queryKey: ["cameras"],
  queryFn: async () =>
    unwrap<Camera[]>(await supabase.from("cameras").select("*").order("name")) as Camera[],
});

export const incidentsQuery = queryOptions({
  queryKey: ["incidents"],
  queryFn: async () =>
    unwrap<Incident[]>(
      await supabase.from("incidents").select("*").order("last_seen", { ascending: false }),
    ) as Incident[],
  refetchInterval: 5000,
});

export const evidenceQuery = queryOptions({
  queryKey: ["evidence"],
  queryFn: async () =>
    unwrap<Evidence[]>(
      await supabase
        .from("evidence")
        .select("*")
        .order("captured_at", { ascending: false })
        .limit(600),
    ) as Evidence[],
  refetchInterval: 8000,
});

export const frameMetricsQuery = queryOptions({
  queryKey: ["frame_metrics"],
  queryFn: async () =>
    unwrap<FrameMetric[]>(
      await supabase
        .from("frame_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ) as FrameMetric[],
  refetchInterval: 5000,
});

export const actionsQuery = queryOptions({
  queryKey: ["operator_actions"],
  queryFn: async () =>
    unwrap<OperatorAction[]>(
      await supabase
        .from("operator_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ) as OperatorAction[],
  refetchInterval: 8000,
});

export const datasetsQuery = queryOptions({
  queryKey: ["datasets"],
  queryFn: async () =>
    unwrap<Dataset[]>(await supabase.from("datasets").select("*").order("name")) as Dataset[],
});

export const evalsQuery = queryOptions({
  queryKey: ["model_evals"],
  queryFn: async () =>
    unwrap<ModelEval[]>(
      await supabase.from("model_evals").select("*").order("created_at", { ascending: false }),
    ) as ModelEval[],
});
