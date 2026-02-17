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
