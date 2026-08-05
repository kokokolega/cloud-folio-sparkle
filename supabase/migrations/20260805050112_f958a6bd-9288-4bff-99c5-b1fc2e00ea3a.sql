REVOKE EXECUTE ON FUNCTION public.create_group(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text) TO authenticated;