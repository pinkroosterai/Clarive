# Contributing

Thanks for wanting to help. Here's how to get going.

## The Short Version

1. Fork the repo and create a branch
2. Set up your dev environment ([docs/development-setup.md](development-setup.md))
3. Make your changes, add tests
4. `make test && make lint`
5. Open a PR

Looking for somewhere to start? Check the [good first issues](https://github.com/pinkroosterai/Clarive/labels/good%20first%20issue).

## Development Workflow

See [development-setup.md](development-setup.md) for full environment setup. The short version:

```bash
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive
make setup
make dev
```

Everything runs in Docker. No local SDKs needed for basic development.

## Testing

We have 1400+ automated tests across four layers. All of them should pass before you open a PR.

| Layer | Framework | Tests | Command |
|---|---|---|---|
| Backend unit | xUnit | ~479 | `make test-backend` |
| Backend integration | xUnit + Testcontainers | ~334 | `make test-backend` |
| Frontend unit | Vitest + Testing Library | ~567 | `make test-frontend` |
| E2E | Playwright | 14 specs (~49 tests) | `make test-e2e` |

Integration tests spin up a real PostgreSQL instance via [Testcontainers](https://testcontainers.com/). No database mocks. E2E tests hit the full stack through Playwright.

```bash
# Run everything
make test

# Target something specific
cd tests/backend/Clarive.Api.UnitTests
dotnet test --filter "FullyQualifiedName~EntryServiceTests"

cd src/frontend
npx vitest src/hooks/useEditorState.test.ts
npx playwright test --headed     # E2E with a visible browser
```

If you're adding a new feature, add tests. If you're fixing a bug, add a test that would have caught it.

## Code Conventions

### Git

- Commit messages: imperative mood, concise subject (`feat(api): add tag filtering endpoint`)
- Conventional commit prefixes: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Branch from `main`, PR back to `main`

### Backend

- New endpoints follow the Minimal API pattern in existing `Endpoints/*.cs` files
- Services return `ErrorOr<T>` and get registered in `Program.cs`
- Request validation via MiniValidation + Data Annotations on record properties
- Endpoints use `result.Errors.ToHttpResult(ctx)` for error responses

### Frontend

- Components go in feature-specific subdirectories under `components/`
- Server state through TanStack React Query, not local state
- Forms use React Hook Form + Zod validation
- Pages are lazy-loaded via `React.lazy()`

## Pull Requests

- Keep PRs focused. One feature or fix per PR.
- Fill out the PR template.
- Make sure CI passes before requesting review.

## Reporting Bugs

Use [GitHub Issues](https://github.com/pinkroosterai/Clarive/issues). Include:
- What you expected vs. what happened
- Steps to reproduce
- Browser/OS if it's a frontend issue
- Relevant logs if available

## Feature Requests

Also [GitHub Issues](https://github.com/pinkroosterai/Clarive/issues). Describe the problem you're trying to solve, not just the solution you have in mind.
