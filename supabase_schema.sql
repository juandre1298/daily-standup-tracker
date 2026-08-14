-- ==============================================================================
-- DAILY STANDUP TRACKER - SUPABASE SQL SCHEMA & SEED
-- ==============================================================================
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Create simple participants table
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  has_spoken BOOLEAN NOT NULL DEFAULT FALSE,
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) & allow open access for team standups
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to participants" ON public.participants;
CREATE POLICY "Allow public access to participants" 
ON public.participants FOR ALL USING (true) WITH CHECK (true);

-- 3. Enable Realtime updates for all browser instances
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

-- 4. Seed default team participants
INSERT INTO public.participants (name, has_spoken, is_absent) VALUES
  ('Juan Muñoz', FALSE, FALSE),
  ('Juan Salas', FALSE, FALSE),
  ('Abraham', FALSE, FALSE),
  ('Nikol', FALSE, FALSE),
  ('Cristhian', FALSE, FALSE),
  ('Miguel', FALSE, FALSE),
  ('John', FALSE, FALSE),
  ('Andy', FALSE, FALSE),
  ('Wes', FALSE, FALSE),
  ('George', FALSE, FALSE),
  ('Matt', FALSE, FALSE),
  ('Amellia', FALSE, FALSE)
ON CONFLICT DO NOTHING;
