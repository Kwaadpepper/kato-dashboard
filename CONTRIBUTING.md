# Contributing to Kato

Thank you for your interest in contributing!

## Ways to contribute

- **Bug reports** — open an issue using the Bug Report template
- **Feature requests** — open an issue using the Feature Request template
- **New monitoring adapters** — see the adapter guide in the README
- **Translations** — add a locale file in `src/lib/i18n/locales/`
- **Bug fixes / improvements** — open a pull request

## Development setup

```bash
git clone https://github.com/Kwaadpepper/kato-dashboard.git
cd kato-dashboard
npm install
cp .env.example .env
npm run dev
```

## Before submitting a PR

```bash
npm test          # unit tests
npm run check     # TypeScript / Svelte type checking
npm run lint      # ESLint
```

All three must pass. Please keep pull requests focused on a single topic.

## Branching

- `main` — stable, always deployable
- Feature branches: `feat/<short-description>`
- Bug fix branches: `fix/<short-description>`

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`

## Adding a monitoring adapter

See the **"Adding a Custom Monitoring Adapter"** section in [README.md](README.md). Once implemented:

1. Add an entry in `src/hooks.server.ts`
2. Document the required env vars in `.env.example` and the README config table
3. Add at least one unit test under `src/lib/server/adapters/`

## License

By contributing, you agree your changes will be released under the [MIT License](LICENSE).
