## Bacancy Inventory – Zoho-style inventory SaaS

Next.js (App Router) + Supabase–powered inventory, sales, and purchase
management app with multi-organization support and Zoho-like UI.

### Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and set these env vars in `.env`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_REDIRECT_URLS=http://localhost:3000/
   ```

3. In Supabase SQL editor, run the contents of `supabase/schema.sql`
   once to create tables, RLS, and helper functions.

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` and register a new user to go through
   onboarding and create your first workspace.

### Deploying on Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, create a new project from the repo.
3. In the Vercel project settings → Environment Variables, add the same
   Supabase vars as above, using your production Supabase project values.
4. Trigger a deploy; once live, set `NEXT_PUBLIC_SITE_URL` to your
   Vercel URL (for example `https://your-app.vercel.app`) both in Vercel
   env and in Supabase Auth redirect URLs.

Vercel’s logs plus Supabase logs/console will give you basic monitoring
of API errors and slow queries.

### DB Agent (natural language to SQL)

A simple agent answers questions in plain English using your Supabase data: Groq turns the question into SQL, Supabase runs it via a read-only RPC.

1. **Env vars** (in `.env` or Vercel): `GROQ_API_KEY` (from Groq Console) and `SUPABASE_SERVICE_ROLE_KEY` (Supabase Project Settings → API, service_role). Never expose the service role key in the browser.

2. **One-time setup:** In Supabase SQL Editor, run the contents of `supabase/execute_sql_rpc.sql` to create the read-only `execute_sql` RPC (SELECT only, max 50 rows).

3. **API:** POST `/api/db-agent/chat` with body `{ "message": "Show top 5 customers by revenue" }`. Response: `{ "response": "...", "data": [...], "sql": "SELECT ..." }`.

4. **Example:** `curl -X POST http://localhost:3000/api/db-agent/chat -H "Content-Type: application/json" -d '{"message":"How many products?"}'`
