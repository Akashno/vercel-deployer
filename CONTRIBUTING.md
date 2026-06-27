# Contributing

Thanks for your interest in contributing! This project is a self-hosted Nuxt 4
dashboard for viewing Vercel Deployer. Contributions of all kinds are
welcome — bug reports, features, docs, and fixes.

## Getting set up

1. Fork and clone the repo.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your values (see the README for
   the full variable table).
4. Start the dev server: `npm run dev` → http://localhost:3000

## Before you open a pull request

- **Discuss big changes first.** For anything beyond a small fix, please open an
  issue to discuss the approach before investing time in a PR.
- **Keep PRs focused.** One logical change per PR is much easier to review.
- **Match the existing style.** Follow the conventions already in the codebase
  (Nuxt/Vue composition API, TypeScript, the existing file layout under
  `app/` and `server/`).
- **Verify it builds and runs.** Run `npm run build` and exercise the affected
  pages/endpoints locally.
- **Never commit secrets.** Confirm `.env` and any tokens stay untracked.

## Commit messages

Write clear, present-tense commit messages describing what changed and why
(e.g. `fix: cancel button stays disabled after redeploy`).

## Reporting bugs & requesting features

Use the issue templates under **New Issue**. Please include reproduction steps,
expected vs. actual behavior, and your environment for bugs.

## Code of conduct

By participating, you agree to uphold our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
