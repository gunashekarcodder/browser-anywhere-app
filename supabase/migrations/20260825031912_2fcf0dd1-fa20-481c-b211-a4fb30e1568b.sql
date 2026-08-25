CREATE POLICY "actions authenticated delete" ON public.operator_actions FOR DELETE TO authenticated USING (true);
GRANT DELETE ON public.operator_actions TO authenticated;