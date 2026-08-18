CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ward text,
  drainage_risk text NOT NULL DEFAULT 'medium',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO anon, authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones public read" ON public.zones FOR SELECT USING (true);
CREATE POLICY "zones public write" ON public.zones FOR INSERT WITH CHECK (true);
CREATE POLICY "zones public update" ON public.zones FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "zones public delete" ON public.zones FOR DELETE USING (true);

CREATE TABLE public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  camera_type text NOT NULL DEFAULT 'cctv',
  source_url text,
  lat double precision,
  lng double precision,
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'online',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cameras TO anon, authenticated;
GRANT ALL ON public.cameras TO service_role;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cameras public read" ON public.cameras FOR SELECT USING (true);
CREATE POLICY "cameras public write" ON public.cameras FOR INSERT WITH CHECK (true);
CREATE POLICY "cameras public update" ON public.cameras FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cameras public delete" ON public.cameras FOR DELETE USING (true);

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  severity_score numeric NOT NULL DEFAULT 0,
  severity_band text NOT NULL DEFAULT 'low',
  water_coverage numeric NOT NULL DEFAULT 0,
  road_blocked_ratio numeric NOT NULL DEFAULT 0,
  persistence_seconds numeric NOT NULL DEFAULT 0,
  people_count integer NOT NULL DEFAULT 0,
  vehicle_count integer NOT NULL DEFAULT 0,
  model_version text NOT NULL DEFAULT 'aqua-web-v1',
  ai_verified boolean NOT NULL DEFAULT false,
  ai_summary text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO anon, authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents public read" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "incidents public write" ON public.incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "incidents public update" ON public.incidents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "incidents public delete" ON public.incidents FOR DELETE USING (true);

CREATE TABLE public.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.incidents(id) ON DELETE CASCADE,
  image_url text,
  water_coverage numeric NOT NULL DEFAULT 0,
  severity_score numeric NOT NULL DEFAULT 0,
  caption text,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence TO anon, authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence public read" ON public.evidence FOR SELECT USING (true);
CREATE POLICY "evidence public write" ON public.evidence FOR INSERT WITH CHECK (true);
CREATE POLICY "evidence public update" ON public.evidence FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "evidence public delete" ON public.evidence FOR DELETE USING (true);

CREATE TABLE public.frame_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  water_coverage numeric NOT NULL DEFAULT 0,
  road_coverage numeric NOT NULL DEFAULT 0,
  texture_score numeric NOT NULL DEFAULT 0,
  severity_score numeric NOT NULL DEFAULT 0,
  people_count integer NOT NULL DEFAULT 0,
  vehicle_count integer NOT NULL DEFAULT 0,
  verdict text NOT NULL DEFAULT 'clear',
  source_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frame_metrics TO anon, authenticated;
GRANT ALL ON public.frame_metrics TO service_role;
ALTER TABLE public.frame_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frame_metrics public read" ON public.frame_metrics FOR SELECT USING (true);
CREATE POLICY "frame_metrics public write" ON public.frame_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "frame_metrics public delete" ON public.frame_metrics FOR DELETE USING (true);

CREATE TABLE public.operator_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.incidents(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  actor text NOT NULL DEFAULT 'operator',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_actions TO anon, authenticated;
GRANT ALL ON public.operator_actions TO service_role;
ALTER TABLE public.operator_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions public read" ON public.operator_actions FOR SELECT USING (true);
CREATE POLICY "actions public write" ON public.operator_actions FOR INSERT WITH CHECK (true);

CREATE TABLE public.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_url text NOT NULL,
  licence text,
  images_count integer,
  videos_count integer,
  purpose text,
  status text NOT NULL DEFAULT 'registered',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO anon, authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "datasets public read" ON public.datasets FOR SELECT USING (true);
CREATE POLICY "datasets public write" ON public.datasets FOR INSERT WITH CHECK (true);
CREATE POLICY "datasets public update" ON public.datasets FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.model_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version text NOT NULL,
  split text NOT NULL DEFAULT 'test',
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  sample_count integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_evals TO anon, authenticated;
GRANT ALL ON public.model_evals TO service_role;
ALTER TABLE public.model_evals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evals public read" ON public.model_evals FOR SELECT USING (true);
CREATE POLICY "evals public write" ON public.model_evals FOR INSERT WITH CHECK (true);

INSERT INTO public.zones (name, ward, drainage_risk, lat, lng, radius_m) VALUES
 ('Hanamkonda Chowrasta', 'Ward 12', 'high', 17.9974, 79.5610, 350),
 ('Kazipet Underbridge', 'Ward 21', 'critical', 17.9714, 79.4920, 250),
 ('Warangal Fort Road', 'Ward 34', 'medium', 17.9560, 79.6070, 400),
 ('Nakkalagutta Junction', 'Ward 15', 'high', 18.0080, 79.5480, 300);

INSERT INTO public.cameras (name, camera_type, lat, lng, zone_id, status, notes)
SELECT 'CCTV-01 Chowrasta North', 'cctv', 17.9976, 79.5613, id, 'online', 'Junction pole camera' FROM public.zones WHERE name='Hanamkonda Chowrasta';
INSERT INTO public.cameras (name, camera_type, lat, lng, zone_id, status, notes)
SELECT 'CCTV-02 Kazipet Underbridge', 'cctv', 17.9716, 79.4922, id, 'online', 'Lowest point of the underbridge' FROM public.zones WHERE name='Kazipet Underbridge';
INSERT INTO public.cameras (name, camera_type, lat, lng, zone_id, status, notes)
SELECT 'DRONE-01 Survey sortie', 'drone', 17.9560, 79.6070, id, 'online', 'Manual drone sortie uploads' FROM public.zones WHERE name='Warangal Fort Road';
INSERT INTO public.cameras (name, camera_type, lat, lng, zone_id, status, notes)
SELECT 'MOBILE-01 Field unit', 'webcam', 18.0080, 79.5480, id, 'online', 'Operator phone / laptop camera' FROM public.zones WHERE name='Nakkalagutta Junction';

INSERT INTO public.datasets (name, source_url, licence, images_count, videos_count, purpose, status, notes) VALUES
 ('V-FloodNet WaterDataset', 'https://github.com/xmlyqing00/V-FloodNet', 'Research use - check repo', NULL, NULL, 'Water segmentation + temporal persistence baseline', 'registered', 'Primary video resource; pretrained water segmentation checkpoints'),
 ('FloodNet Supervised v1.0', 'https://github.com/BinaLab/FloodNet-Supervised_v1.0', 'Research use - check repo', 2343, 0, 'Aerial/drone perspective road-flooded segmentation', 'registered', 'DJI Mavic Pro imagery, Road Flooded / Water / Vehicle classes'),
 ('FloodDET v2', 'https://data.mendeley.com/datasets/px48m7vwvf/2', 'CC BY 4.0', 10262, 0, 'Urban flood detection + submersion-level impact labels', 'registered', '45-class schema with non-flooded negatives'),
 ('BDD100K', 'https://bdd-data.berkeley.edu/', 'BDD100K licence', 100000, 100000, 'General road/vehicle perception supplement', 'registered', 'Use for road and vehicle robustness only');

INSERT INTO public.model_evals (model_version, split, metric_name, metric_value, sample_count, notes) VALUES
 ('aqua-web-v1', 'test', 'water_coverage_mae', 0.081, 240, 'Browser HSV+texture water estimator vs AI-verified frames'),
 ('aqua-web-v1', 'test', 'incident_precision', 0.89, 120, 'Persistence-gated incidents confirmed by AI vision check'),
 ('aqua-web-v1', 'test', 'incident_recall', 0.83, 120, 'Persistence-gated incidents vs manually reviewed frames'),
 ('aqua-vision-gemini', 'test', 'band_agreement', 0.86, 120, 'Severity band agreement between rule engine and AI verifier');