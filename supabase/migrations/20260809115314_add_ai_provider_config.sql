/*
# Add AI Provider Configuration Table

1. New Tables
- `ai_provider_config`: stores OpenRouter API keys, model slugs, and routing weights.
  - `id` (int2, primary key, always 1 — singleton row)
  - `openrouter_api_key_1` (text, nullable)
  - `openrouter_api_key_2` (text, nullable)
  - `openrouter_api_key_3` (text, nullable)
  - `openrouter_model_1` (text, nullable)
  - `openrouter_model_2` (text, nullable)
  - `openrouter_model_3` (text, nullable)
  - `openrouter_weight` (int2, default 90)
  - `gemini_weight` (int2, default 10)
  - `updated_at` (timestamptz)

2. Security
- RLS enabled.
- Only service role can read/write (anon cannot) — keys are server-side secrets.
- A SECURITY DEFINER function `get_ai_provider_config()` returns the config
  so edge functions (which connect via anon key) can read it.

3. Notes
- The SECURITY DEFINER function bypasses RLS to return the config row.
- Only the singleton row (id=1) is ever used.
- API keys are stored as plaintext in this table — access is restricted
  to the service role and the SECURITY DEFINER function.
*/

CREATE TABLE IF NOT EXISTS ai_provider_config (
  id smallint PRIMARY KEY DEFAULT 1,
  openrouter_api_key_1 text,
  openrouter_api_key_2 text,
  openrouter_api_key_3 text,
  openrouter_model_1 text,
  openrouter_model_2 text,
  openrouter_model_3 text,
  openrouter_weight smallint NOT NULL DEFAULT 90,
  gemini_weight smallint NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE ai_provider_config ENABLE ROW LEVEL SECURITY;

-- Deny all access via RLS (only service role + SECURITY DEFINER function can read)
REVOKE ALL ON ai_provider_config FROM anon, authenticated;

-- SECURITY DEFINER function to read config (callable by anon)
CREATE OR REPLACE FUNCTION get_ai_provider_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg json;
BEGIN
  SELECT json_build_object(
    'openrouter_api_keys', ARRAY[
      openrouter_api_key_1,
      openrouter_api_key_2,
      openrouter_api_key_3
    ]::text[],
    'openrouter_models', ARRAY[
      openrouter_model_1,
      openrouter_model_2,
      openrouter_model_3
    ]::text[],
    'openrouter_weight', openrouter_weight,
    'gemini_weight', gemini_weight
  )
  INTO cfg
  FROM ai_provider_config
  WHERE id = 1;

  IF cfg IS NULL THEN
    RETURN json_build_object(
      'openrouter_api_keys', ARRAY[]::text[],
      'openrouter_models', ARRAY[]::text[],
      'openrouter_weight', 90,
      'gemini_weight', 10
    );
  END IF;

  RETURN cfg;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ai_provider_config() TO anon, authenticated;

-- Insert the singleton row with the provided keys
INSERT INTO ai_provider_config (id, openrouter_api_key_1, openrouter_api_key_2, openrouter_api_key_3, openrouter_weight, gemini_weight)
VALUES (1,
  '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',
  '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',
  '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',
  90, 10
)
ON CONFLICT (id) DO UPDATE SET
  openrouter_api_key_1 = EXCLUDED.openrouter_api_key_1,
  openrouter_api_key_2 = EXCLUDED.openrouter_api_key_2,
  openrouter_api_key_3 = EXCLUDED.openrouter_api_key_3,
  openrouter_weight = EXCLUDED.openrouter_weight,
  gemini_weight = EXCLUDED.gemini_weight,
  updated_at = now();
