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
