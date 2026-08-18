-- Drop permissive public write policies
DROP POLICY IF EXISTS "zones public write" ON public.zones;
DROP POLICY IF EXISTS "zones public update" ON public.zones;
DROP POLICY IF EXISTS "zones public delete" ON public.zones;
DROP POLICY IF EXISTS "cameras public write" ON public.cameras;
DROP POLICY IF EXISTS "cameras public update" ON public.cameras;
DROP POLICY IF EXISTS "cameras public delete" ON public.cameras;
DROP POLICY IF EXISTS "incidents public write" ON public.incidents;
DROP POLICY IF EXISTS "incidents public update" ON public.incidents;
DROP POLICY IF EXISTS "incidents public delete" ON public.incidents;
DROP POLICY IF EXISTS "evidence public write" ON public.evidence;
DROP POLICY IF EXISTS "evidence public update" ON public.evidence;
DROP POLICY IF EXISTS "evidence public delete" ON public.evidence;
DROP POLICY IF EXISTS "frame_metrics public write" ON public.frame_metrics;
DROP POLICY IF EXISTS "frame_metrics public delete" ON public.frame_metrics;
DROP POLICY IF EXISTS "actions public write" ON public.operator_actions;
DROP POLICY IF EXISTS "datasets public write" ON public.datasets;
DROP POLICY IF EXISTS "datasets public update" ON public.datasets;
DROP POLICY IF EXISTS "evals public write" ON public.model_evals;

-- Authenticated-only write policies
CREATE POLICY "zones authenticated write" ON public.zones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "zones authenticated update" ON public.zones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "zones authenticated delete" ON public.zones FOR DELETE TO authenticated USING (true);

CREATE POLICY "cameras authenticated write" ON public.cameras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cameras authenticated update" ON public.cameras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cameras authenticated delete" ON public.cameras FOR DELETE TO authenticated USING (true);

CREATE POLICY "incidents authenticated write" ON public.incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "incidents authenticated update" ON public.incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "incidents authenticated delete" ON public.incidents FOR DELETE TO authenticated USING (true);

CREATE POLICY "evidence authenticated write" ON public.evidence FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "evidence authenticated update" ON public.evidence FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "evidence authenticated delete" ON public.evidence FOR DELETE TO authenticated USING (true);

CREATE POLICY "frame_metrics authenticated write" ON public.frame_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "frame_metrics authenticated delete" ON public.frame_metrics FOR DELETE TO authenticated USING (true);

CREATE POLICY "actions authenticated write" ON public.operator_actions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "datasets authenticated write" ON public.datasets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "datasets authenticated update" ON public.datasets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "evals authenticated write" ON public.model_evals FOR INSERT TO authenticated WITH CHECK (true);

-- Tighten grants: anon may only read
REVOKE INSERT, UPDATE, DELETE ON public.zones, public.cameras, public.incidents, public.evidence, public.frame_metrics, public.operator_actions, public.datasets, public.model_evals FROM anon;
GRANT SELECT ON public.zones, public.cameras, public.incidents, public.evidence, public.frame_metrics, public.operator_actions, public.datasets, public.model_evals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones, public.cameras, public.incidents, public.evidence, public.frame_metrics, public.operator_actions, public.datasets, public.model_evals TO authenticated;
GRANT ALL ON public.zones, public.cameras, public.incidents, public.evidence, public.frame_metrics, public.operator_actions, public.datasets, public.model_evals TO service_role;