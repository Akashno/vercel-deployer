# Vercel Deployments Viewer

A self-hosted dashboard for viewing and managing [Vercel](https://vercel.com)
deployments — without giving everyone a paid Vercel seat. Built with
[Nuxt 4](https://nuxt.com).

Connect it to a Vercel project with an API token, protect it behind simple
auth, and let PMs, QA, designers, or clients watch deployments, read build
logs, cancel builds, and trigger redeploys — with optional GitHub PR and Jira
ticket context surfaced inline.

## Features

- 📋 List deployments for a Vercel project, with status, branch, and commit info
- 🔍 Inspect a single deployment and stream its build logs
- 🚀 Force / redeploy a branch (optionally via a GitHub Actions workflow)
- 🛑 Cancel in-progress builds
- 🌿 Browse branches
- 🔗 Inline GitHub PR links and Jira ticket links (auto-detected from branch names)
- 🔐 Username/password auth in front of the whole dashboard

## How force-deploy works (bypassing Vercel's seat restriction)

Vercel only lets **paid team members** trigger a deployment from the dashboard
or CLI. If you want non-seat users (PMs, QA, clients) to be able to redeploy a
branch — or you just want to re-run a build that was `CANCELED` or `BLOCKED`
without changing code — you normally can't, because triggering a deploy requires
a Vercel seat.

This tool works around that. Vercel *does* deploy on any **git push** to a
connected branch, regardless of who is logged into the dashboard. So instead of
asking Vercel to deploy, we push a harmless **empty commit** to the branch as
the `github-actions[bot]` identity:

```bash
git commit --allow-empty -m "chore: manual empty commit"
git push origin HEAD:<branch>
```

That produces a new commit SHA with zero file changes. Vercel sees a new push
and starts a fresh deployment — no paid seat involved, and no real change to your
code or history.

### Setting it up in your project

The empty commit is performed by a GitHub Actions workflow that lives **in the
repository you deploy to Vercel**. A ready-to-use copy is included here:
[`.github/workflows/empty-commit.yml`](./.github/workflows/empty-commit.yml).

**Why this workflow is required:** force-deploy does nothing on its own — the
dashboard has no way to push to your repo directly. This workflow is the piece
that actually performs the empty commit and push from inside GitHub Actions
(authenticated as `github-actions[bot]`), which is what Vercel accepts as a
deploy trigger. Without it installed in your deploy repo, the force-deploy
button has nothing to call.

1. Copy [`.github/workflows/empty-commit.yml`](./.github/workflows/empty-commit.yml)
   into your deployment repo at the same path.
2. Commit and push it to that repo.
3. In this dashboard's `.env`, set:
   - `GITHUB_TOKEN` — a fine-grained PAT with **`Actions: read & write`** on that repo
   - `GITHUB_OWNER` / `GITHUB_REPO` — pointing at that repo

The dashboard's **force-deploy** button then calls the workflow via the GitHub
API (`workflow_dispatch`). The workflow checks out the chosen branch, makes the
empty commit as `github-actions[bot]`, and pushes — and Vercel deploys.

```
Dashboard "Force deploy"  ──GitHub API──▶  Actions workflow in your deploy repo
   (no Vercel seat needed)                    │  empty commit as github-actions[bot]
                                              │  git push origin HEAD:<branch>
                                              ▼
                                       Vercel sees the push  ──▶  builds & deploys
```

> If you don't need force-deploy, skip the `GITHUB_*` variables and the workflow
> entirely — everything else still works.

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

| Variable | Required | Description |
|----------|----------|-------------|
| `VERCEL_TOKEN` | ✅ | Vercel API token ([create one](https://vercel.com/account/tokens)) |
| `PROJECT_ID` | ✅ | The Vercel project ID to monitor |
| `TEAM_ID` | ⬜ | Vercel team ID, if the project belongs to a team |
| `AUTH_USERNAME` | ✅ | Username for dashboard login |
| `AUTH_PASSWORD` | ✅ | Password for dashboard login |
| `AUTH_SECRET` | ✅ | Random secret used to sign the auth session |
| `GITHUB_TOKEN` | ⬜ | Fine-grained PAT with `Actions: read & write` (for force-deploy via Actions) |
| `GITHUB_OWNER` | ⬜ | GitHub repo owner |
| `GITHUB_REPO` | ⬜ | GitHub repo name |
| `JIRA_ORG` | ⬜ | Jira org subdomain, e.g. `acme` for `acme.atlassian.net` |
| `JIRA_EMAIL` | ⬜ | Jira account email |
| `JIRA_API_TOKEN` | ⬜ | Jira API token |

Generate `AUTH_SECRET` with:

```bash
openssl rand -hex 32
```

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
