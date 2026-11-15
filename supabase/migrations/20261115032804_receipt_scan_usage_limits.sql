-- Durable paid-scanning limits: 5 requests per authenticated user and 100 requests
-- total per UTC day. The function reserves usage atomically before OpenAI is called.
CREATE TABLE IF NOT EXISTS public.receipt_scan_usage (
  usage_day date NOT NULL,
  bucket text NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (usage_day, bucket),
  CHECK (bucket = 'global' OR bucket ~ '^user:[0-9a-fA-F-]{36}$')
);

ALTER TABLE public.receipt_scan_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own receipt scan usage" ON public.receipt_scan_usage;
CREATE POLICY "Users can read their own receipt scan usage"
  ON public.receipt_scan_usage
  FOR SELECT TO authenticated
  USING (bucket = 'user:' || (SELECT auth.uid())::text);

REVOKE ALL ON TABLE public.receipt_scan_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_receipt_scan()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  current_day date := (pg_catalog.now() AT TIME ZONE 'utc')::date;
  user_bucket text;
  user_count integer;
  global_count integer;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Old counters are no longer needed after the UTC day changes.
  DELETE FROM public.receipt_scan_usage WHERE usage_day < current_day;

  user_bucket := 'user:' || current_user_id::text;
  INSERT INTO public.receipt_scan_usage (usage_day, bucket, request_count)
  VALUES (current_day, 'global', 0), (current_day, user_bucket, 0)
  ON CONFLICT (usage_day, bucket) DO NOTHING;

  -- Lock both buckets in stable order so concurrent requests cannot exceed either cap.
  SELECT request_count INTO global_count
  FROM public.receipt_scan_usage
  WHERE usage_day = current_day AND bucket = 'global'
  FOR UPDATE;

  SELECT request_count INTO user_count
  FROM public.receipt_scan_usage
  WHERE usage_day = current_day AND bucket = user_bucket
  FOR UPDATE;

  IF global_count >= 100 OR user_count >= 5 THEN
    RETURN false;
  END IF;

  UPDATE public.receipt_scan_usage
  SET request_count = request_count + 1
  WHERE usage_day = current_day AND bucket IN ('global', user_bucket);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_receipt_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_receipt_scan() TO authenticated;
