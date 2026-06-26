# Vercel Deployments Viewer

A self-hosted dashboard for viewing and managing [Vercel](https://vercel.com)
deployments — without giving everyone a paid Vercel seat. Built with
[Nuxt 4](https://nuxt.com).

This dashboard is particularly useful for project management environments where **Vercel**, **Jira**, and **GitHub** are used together.

Connect it to a Vercel project with an API token, protect it behind simple
auth, and let PMs, QA, designers, or clients watch deployments, read build
logs, cancel builds, and trigger redeploys — with optional GitHub PR and Jira
ticket context surfaced inline.

## Features

- 📋 List deployments for a Vercel project, with status, branch, and commit info
- 🔍 Inspect a single deployment and stream its build logs
- 🚀 Force / redeploy a branch (directly via the GitHub Git Database API)
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

To enable this feature, simply configure the following variables in your `.env`:
1. `GITHUB_TOKEN` — a fine-grained Personal Access Token (PAT) with **`Contents: read & write`** permissions on the deployment repository.
2. `GITHUB_OWNER` / `GITHUB_REPO` — the owner and name of the repository.

The dashboard's **force-deploy** button then calls the GitHub API to fetch the latest commit ref, create a new commit object pointing to the same file tree, and update the branch reference to push it. Vercel detects this new commit and starts a fresh deployment instantly.

```
Dashboard "Force deploy"  ──GitHub API (Git Data)──▶  Push empty commit to branch
   (no Vercel seat needed)                                │ (as github-actions[bot])
                                                          ▼
                                                   Vercel sees the push  ──▶  builds & deploys
```

> If you don't need force-deploy, skip the `GITHUB_*` variables entirely — everything else still works.

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
| `GITHUB_TOKEN` | ⬜ | Fine-grained PAT with `Contents: read & write` (for force-deploy via API) |
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
