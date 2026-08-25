-- Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('operator', 'admin')
  )
$$;

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Backfill: existing accounts keep working as operators
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'operator'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- zones
DROP POLICY IF EXISTS "zones authenticated write" ON public.zones;
DROP POLICY IF EXISTS "zones authenticated update" ON public.zones;
DROP POLICY IF EXISTS "zones authenticated delete" ON public.zones;
CREATE POLICY "zones operator insert" ON public.zones FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "zones operator update" ON public.zones FOR UPDATE TO authenticated USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "zones operator delete" ON public.zones FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- cameras
DROP POLICY IF EXISTS "cameras authenticated write" ON public.cameras;
DROP POLICY IF EXISTS "cameras authenticated update" ON public.cameras;
DROP POLICY IF EXISTS "cameras authenticated delete" ON public.cameras;
CREATE POLICY "cameras operator insert" ON public.cameras FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "cameras operator update" ON public.cameras FOR UPDATE TO authenticated USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "cameras operator delete" ON public.cameras FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- incidents
DROP POLICY IF EXISTS "incidents authenticated write" ON public.incidents;
DROP POLICY IF EXISTS "incidents authenticated update" ON public.incidents;
DROP POLICY IF EXISTS "incidents authenticated delete" ON public.incidents;
CREATE POLICY "incidents operator insert" ON public.incidents FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "incidents operator update" ON public.incidents FOR UPDATE TO authenticated USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "incidents operator delete" ON public.incidents FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- evidence
DROP POLICY IF EXISTS "evidence authenticated write" ON public.evidence;
DROP POLICY IF EXISTS "evidence authenticated update" ON public.evidence;
DROP POLICY IF EXISTS "evidence authenticated delete" ON public.evidence;
CREATE POLICY "evidence operator insert" ON public.evidence FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "evidence operator update" ON public.evidence FOR UPDATE TO authenticated USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "evidence operator delete" ON public.evidence FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- frame_metrics
DROP POLICY IF EXISTS "frame_metrics authenticated write" ON public.frame_metrics;
DROP POLICY IF EXISTS "frame_metrics authenticated delete" ON public.frame_metrics;
CREATE POLICY "frame_metrics operator insert" ON public.frame_metrics FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "frame_metrics operator delete" ON public.frame_metrics FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- operator_actions
DROP POLICY IF EXISTS "actions authenticated write" ON public.operator_actions;
DROP POLICY IF EXISTS "actions authenticated delete" ON public.operator_actions;
CREATE POLICY "actions operator insert" ON public.operator_actions FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "actions operator delete" ON public.operator_actions FOR DELETE TO authenticated USING (public.is_operator(auth.uid()));

-- datasets (admin only)
DROP POLICY IF EXISTS "datasets authenticated write" ON public.datasets;
DROP POLICY IF EXISTS "datasets authenticated update" ON public.datasets;
CREATE POLICY "datasets admin insert" ON public.datasets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "datasets admin update" ON public.datasets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- model_evals (admin only)
DROP POLICY IF EXISTS "evals authenticated write" ON public.model_evals;
CREATE POLICY "evals admin insert" ON public.model_evals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));