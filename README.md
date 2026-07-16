# Vercel Deployer Viewer

A self-hosted dashboard for viewing and managing [Vercel](https://vercel.com)
deployments — without giving everyone a paid Vercel seat. Built with
[Nuxt 4](https://nuxt.com).

🚀 **[View Live Interactive Demo](https://akashno.github.io/vercel-deployer/)**

This dashboard is particularly useful for project management environments where **Vercel**, **Jira**, and **GitHub** are used together.

Connect it to one or more Vercel projects with API tokens, protect it behind
simple auth, and let PMs, QA, designers, or clients watch deployments, read
build logs, cancel builds, and trigger redeploys — with optional GitHub PR and
Jira ticket context surfaced inline.

## Features

- 🗂️ **Multiple projects** — monitor any number of Vercel projects from one dashboard and switch between them, each with its own Vercel / GitHub / Jira config
- 📋 List deployments for a Vercel project, with status, branch, and commit info
- 🔍 Inspect a single deployment and stream its build logs
- 🚀 Force / redeploy a branch (directly via the GitHub Git Database API)
- 🛑 Cancel in-progress builds
- 🌿 Browse branches
- 🔗 Inline GitHub PR links and Jira ticket links (auto-detected from branch names)
- 🔐 Username/password auth in front of the whole dashboard
- 👥 Team member credentials — generate individual credentials for team members directly from the dashboard

## How force-deploy works (bypassing Vercel's seat restriction)

Vercel only lets **paid team members** trigger a deployment from the dashboard
or CLI. If you want non-seat users (PMs, QA, clients) to be able to redeploy a
branch — or you just want to re-run a build that was `CANCELED` or `BLOCKED`
without changing code — you normally can't, because triggering a deploy requires
a Vercel seat.

This dashboard bypasses this by using the **GitHub Git Database API** to programmatically push a harmless **empty commit** to the branch as the `github-actions[bot]` identity:

```bash
git commit --allow-empty -m "chore: manual empty commit"
git push origin HEAD:<branch>
```

That produces a new commit SHA with zero file changes. Vercel sees a new push
and starts a fresh deployment — no paid seat involved, and no real change to your
code or history.

### Setting it up

Because the dashboard creates the commit directly via the GitHub API, you **do not need** to install any workflows or scripts in your deployment repository. 

To enable this feature, add a `github` block to the project in your `PROJECTS` config (see [Configuration](#configure)):
- `token` — a fine-grained Personal Access Token (PAT) with **`Contents: read & write`** permissions on the deployment repository.
- `owner` / `repo` — the owner and name of the repository.

The dashboard's **force-deploy** button then calls the GitHub API to fetch the latest commit ref, create a new commit object pointing to the same file tree, and update the branch reference to push it. Vercel detects this new commit and starts a fresh deployment instantly.

```
Dashboard "Force deploy"  ──GitHub API (Git Data)──▶  Push empty commit to branch
   (no Vercel seat needed)                                │ (as github-actions[bot])
                                                          ▼
                                                   Vercel sees the push  ──▶  builds & deploys
```

> If you don't need force-deploy, omit the `github` block from a project — everything else still works.

## Tech stack

- Nuxt 4 (Vue 3, Nitro server)
- TypeScript
- Vercel REST API, GitHub API, Jira API

## Getting started

### Prerequisites

- Node.js 20+ (developed on v22)
- A Vercel account with an API token and a project to monitor

### Install

```bash
git clone https://github.com/<your-username>/vercel-deployments.git
cd vercel-deployments
npm install
```

### Configure

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

There are just a few top-level environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PROJECTS` | ✅ | JSON array of the projects to monitor (see below) |
| `AUTH_USERNAME` | ✅ | Username for dashboard login (primary admin) |
| `AUTH_PASSWORD` | ✅ | Password for dashboard login (primary admin) |
| `AUTH_SECRET` | ✅ | Random secret used to sign the auth session |
| `TEAM_MEMBERS` | ⬜ | Additional team member credentials (generated from the dashboard's Team Management panel) |

Generate `AUTH_SECRET` with:

```bash
openssl rand -hex 32
```

#### The `PROJECTS` variable

All Vercel / GitHub / Jira configuration lives inside `PROJECTS` — a JSON array with one entry per project. Add a single entry to monitor one project, or several to switch between them in the dashboard:

```env
PROJECTS=[{"id":"marketing-site","name":"Marketing Site","vercel":{"token":"vcp_...","projectId":"prj_abc","teamId":"team_x"},"github":{"token":"github_pat_...","owner":"acme","repo":"marketing-site"},"jira":{"org":"acme","email":"bot@acme.com","apiToken":"..."}},{"id":"app","name":"Main App","vercel":{"token":"vcp_...","projectId":"prj_def"}}]
```

Per-project fields:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Unique slug used in the dashboard URL |
| `name` | ⬜ | Display name in the project switcher (defaults to `id`) |
| `vercel.token` | ✅ | Vercel API token ([create one](https://vercel.com/account/tokens)) |
| `vercel.projectId` | ✅ | The Vercel project ID to monitor |
| `vercel.teamId` | ⬜ | Vercel team ID, if the project belongs to a team |
| `github` | ⬜ | `{ token, owner, repo }` — enables force-deploy and PR cards. `token` is a fine-grained PAT with `Contents: read & write` |
| `jira` | ⬜ | `{ org, email, apiToken }` — enables Jira ticket links. `org` is the subdomain, e.g. `acme` for `acme.atlassian.net` |

Everyone with dashboard access sees the project switcher and all configured projects — there is no per-user, per-project access control.

> **Note on formatting:** `PROJECTS` must be valid JSON on a **single line** — most `.env` parsers only read an unquoted value up to the end of its line, so pretty-printing it across multiple lines will silently truncate it. A trailing comma before a `]` or `}` is tolerated.

### Run

```bash
npm run dev        # http://localhost:3000
```

### Build for production

```bash
npm run build
npm run preview
```

## Deployment

This is a standard Nuxt app and can be deployed anywhere Nitro runs (Vercel,
Node server, Docker, etc.). Make sure the environment variables above are set
in your hosting platform.

## Contributing

Issues and pull requests are welcome. Please open an issue to discuss any
significant changes before submitting a PR.

## License

[MIT](./LICENSE)
