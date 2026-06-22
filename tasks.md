Build a minimal Nuxt 4 project (latest stable, using the new app/ directory structure) that displays the list of deployments for a Vercel project. The Vercel API token must stay server-side and never be exposed to the browser.
Architecture

Use a Nitro server route at server/api/deployments.get.ts that reads VERCEL_TOKEN, PROJECT_ID, and an optional TEAM_ID from environment variables.
The server route calls GET https://api.vercel.com/v6/deployments?limit=50&projectId=<PROJECT_ID> (append &teamId=<TEAM_ID> when present) with the header Authorization: Bearer <VERCEL_TOKEN>.
The route must only return the specific fields the UI needs (do not proxy the entire Vercel response back to the client). For each deployment return: state/readyState, url, target, created/createdAt timestamp, inspectorUrl, git branch, commit SHA (short), commit message, and commit author. Pull git fields from meta (handle the github*, gitlab*, and bitbucket* prefixes).
Provide a .env.example listing VERCEL_TOKEN, PROJECT_ID, TEAM_ID.

Frontend page (app/pages/index.vue)

Fetch from the local /api/deployments route (never call Vercel directly from the client).
Render a table with columns in this exact order: Branch → URL → Branch/Commit (commit SHA + message) → Created At → Commit Author.
The Created At column should show both the formatted date/time and a relative "how many minutes/hours ago" value within the same cell (e.g. "Mar 12, 14:32 · 8m ago"). Implement the relative-time formatting with Intl.RelativeTimeFormat.
Show the deployment state as a colored status badge (READY = green, ERROR = red, BUILDING = amber, CANCELED = grey, QUEUED/INITIALIZING = blue).
Add a search box above the table that filters rows live (client-side) across branch, URL, commit message, and commit author.
Add a Refresh button and optional auto-refresh.
Make the URL and inspector links clickable (open in new tab, rel="noopener").
Use a clean dark UI consistent with Vercel's aesthetic. Handle loading, empty, and error states gracefully.

Setup

Scaffold with Nuxt 4 (app code lives in app/, server routes stay in server/api/).
Should run with npm install && npm run dev.
Deployable to Vercel/Netlify for free (token sits in the host's env vars), or run locally and expose via ngrok with basic auth.
Keep dependencies minimal — just Nuxt 4, no UI framework needed.