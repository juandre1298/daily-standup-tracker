# Daily Standup Tracker

A simple, fast, real-time web tool to keep track of who already spoke during daily standups.

- **Checkboxes**: Click any participant to mark them as having spoken.
- **Immediate Sync**: Real-time synchronization across all team members via Supabase Realtime.
- **Absent Toggle**: Mark members absent without deleting them.
- **Add / Remove**: Add new team members and remove members.
- **Reset**: One-click reset to start a fresh daily standup.
- **Tailwind CSS**: Simple and clean styling.
- **100% Free Hosting**: Deploy to Vercel, Netlify, or Cloudflare Pages.

---

## 1. Supabase Database Setup (30 Seconds)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** and run the query from [`supabase_schema.sql`](file:///home/juan/dev/daily_tracker/supabase_schema.sql):

```sql
-- 1. Create participants table
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  has_spoken BOOLEAN NOT NULL DEFAULT FALSE,
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security & open access
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to participants" 
ON public.participants FOR ALL USING (true) WITH CHECK (true);

-- 3. Enable Realtime updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
```

---

## 2. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Set up .env with Supabase credentials
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start development server
npm run dev
```

You can also enter your Supabase URL & Anon Key directly in the app UI by clicking the database icon at the top right.

---

## 3. Free Hosting Deployment

- **Vercel**: Import this Git repository, set the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and deploy with 1 click.
- **Netlify**: Connect your repository, set the build command to `npm run build` and publish directory to `dist`.
