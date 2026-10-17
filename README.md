# effort-or-luck

努力か，運か — a browser game about job hunting in Japan. You live one student's year, from April of the third year of university to June 1st of the fourth, making a few choices each month. At the end you learn that 100 versions of you, each with a different allowance from home, made the same choices, and you can keep their luck fixed and change only how they chose.

## Development

Requires Node.js 24 and pnpm. With Nix and direnv, `direnv allow` provides both.

```sh
pnpm install
pnpm dev      # local dev server
pnpm check    # format, lint, typecheck, tests, unused-code check
pnpm build    # static site in dist/
pnpm preview  # serve dist/ locally
```

## Layout

- `src/engine/` — the calculation: lives, scenes, choices, and the 100 selves. Pure TypeScript with no text or UI.
- `src/copy/` — all Japanese wording, built from what the engine reports.
- `src/data/` — statistics shown in the game, each with its source.
- `src/components/` — the React game screen; `src/pages/` — Astro pages.
- `docs/adr/` — architecture decisions.

## License

Source code is licensed under the [MIT License](LICENSE). Original written content and media are excluded from the MIT License; see [CONTENT_LICENSE.md](CONTENT_LICENSE.md).
