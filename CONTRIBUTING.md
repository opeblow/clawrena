# Contributing to Alpha Scout

Thanks for your interest in contributing to Alpha Scout! This document provides
guidelines and information for contributors.

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/opeblow/alpha-scout.git
   cd alpha-scout
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Setup

```bash
npm run dev:backend   # Convex backend (requires convex dev)
npm run dev           # Vite frontend
npm run typecheck     # Type checking
npm run lint          # Linting
```

## Making Changes

- Write code that follows the existing style and conventions.
- Keep changes focused — one feature or fix per pull request.
- Add or update types where appropriate.
- Run `npm run typecheck` and `npm run lint` before committing.
- Write clear commit messages describing what changed and why.

## Pull Requests

1. Push your branch to your fork.
2. Open a pull request against `main` with a clear title and description.
3. Reference any related issues (e.g., `Fixes #42`).
4. Ensure CI passes before requesting review.

## Reporting Issues

Open an issue on GitHub with:
- A clear title and description.
- Steps to reproduce (if applicable).
- Expected vs actual behavior.
- Environment details (OS, Node version, etc.).

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you agree to abide by its terms.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
