# AGENTS.md

## Project Overview

Tablaria is a full-stack inventory management web application.

The main goal is to allow users to:

- Register and authenticate.
- Create and manage their own inventory tables.
- Define columns for their tables.
- Create, edit and delete records.
- Search, filter and sort inventory data.
- Manage their inventory through a flexible table-based interface.

The project is divided into:

- `frontend/` — React + TypeScript application.
- `backend/` — NestJS API.
- PostgreSQL — primary database.
- Docker — development and deployment environment.

The MVP should prioritize a functional, maintainable core over unnecessary complexity.

---

# General Development Rules

## Before Making Changes

1. Inspect the existing code before modifying it.
2. Reuse existing components, utilities and patterns when possible.
3. Do not introduce a new library if the existing stack already provides a suitable solution.
4. Do not rewrite working code without a concrete reason.
5. Keep changes focused on the requested task.
6. Avoid speculative features.
7. If a requirement is ambiguous, prefer the simplest implementation consistent with the existing architecture.

## Code Quality

- Prefer readable and explicit code over clever abstractions.
- Follow the conventions already established in the project.
- Use meaningful names for variables, functions, components and files.
- Keep functions and components reasonably small.
- Avoid duplicated business logic.
- Do not leave unused imports, variables or dependencies.
- Do not leave debugging statements such as `console.log` in production code.
- Handle errors explicitly.
- Do not silently ignore errors.

## TypeScript

- Use TypeScript throughout the frontend and backend.
- Avoid `any` unless there is a strong technical reason.
- Prefer precise types and interfaces.
- Do not use unnecessary type assertions.
- Reuse existing types instead of creating duplicates.
- Keep API request and response types consistent between frontend and backend.

## Comments

- Code should be self-explanatory whenever possible.
- Do not add comments for obvious code.
- Use comments only when they explain non-obvious decisions or complex logic.
- All code comments must be written in English.

---

# Architecture

## Project Structure

The project should maintain a clear separation between frontend and backend:

```text
tablaria/
├── tablaria-frontend/
├── tablaria-backend/
├── docs/
├── docker-compose.yml
├── AGENTS.md
└── README.md
```

Do not mix frontend and backend responsibilities.

## Backend Responsibilities

The backend is responsible for:

- Authentication and authorization.
- Business logic.
- Database access.
- Data validation.
- Inventory/table management.
- API responses.
- Security-sensitive operations.

The frontend must never be responsible for enforcing authorization.

## Frontend Responsibilities

The frontend is responsible for:

- User interface.
- Client-side navigation.
- Form handling.
- Displaying API data.
- Client-side validation where appropriate.
- Loading and error states.
- Table interactions.
- Managing UI state.

---

# Frontend

## Stack

The frontend uses:

- React
- TypeScript
- React Router
- TanStack Table
- Tailwind CSS
- shadcn/ui

Do not introduce another UI component library unless explicitly requested.

## React

- Prefer functional components.
- Use hooks appropriately.
- Avoid unnecessary `useEffect`.
- Avoid excessive prop drilling.
- Extract reusable components when they have a clear purpose.
- Do not create abstractions merely to reduce a few lines of code.

## Routing

Use React Router for application navigation.

Prefer nested routes and layouts for authenticated application areas.

Example:

```tsx
<Route path="/app" element={<AppLayout />}>
  <Route path="dashboard" element={<DashboardPage />} />
  <Route path="tables" element={<TablesPage />} />
  <Route path="tables/:tableId" element={<TablePage />} />
</Route>
```

Use route parameters for resources identified by IDs:

```text
/tables/:tableId
```

Use `Link` for normal navigation.

Use `useNavigate` when navigation is triggered programmatically.

Do not use manual `window.location` navigation for internal routes.

## Components

Prefer a structure similar to:

```text
src/
├── components/
├── features/
├── layouts/
├── pages/
├── routes/
├── hooks/
├── lib/
├── types/
└── main.tsx
```

Feature-specific components should stay close to their feature when appropriate.

Avoid putting all components into one global directory if the application becomes large.

## TanStack Table

Use TanStack Table for inventory/data-table functionality.

Keep table configuration separate from unrelated UI logic when it becomes complex.

Do not duplicate sorting, filtering or pagination logic unnecessarily.

Prefer server-side operations when datasets become too large for efficient client-side processing.

## Styling

Use Tailwind CSS for styling.

Use shadcn/ui for reusable interface primitives.

Prefer composition over modifying third-party components directly.

Do not introduce arbitrary custom CSS when Tailwind can handle the requirement cleanly.

Maintain consistent:

- spacing
- typography
- borders
- radius
- states
- responsive behavior

## Internationalization

Spanish is the primary language.

The application should be designed so English can be added without rewriting the UI.

Do not hard-code architecture that makes future translations difficult.

Avoid mixing translation keys with business logic.

---

# Backend

## Stack

The backend uses:

- NestJS
- TypeScript
- PostgreSQL
- Docker

## NestJS Structure

Prefer NestJS modules organized around application features.

Example:

```text
src/
├── auth/
├── users/
├── tables/
├── columns/
├── records/
├── database/
├── common/
└── app.module.ts
```

Avoid creating modules solely because a file has become large.

Modules should represent meaningful application responsibilities.

## Controllers

Controllers should remain thin.

Controllers should:

- Receive HTTP requests.
- Validate/transform input through DTOs and pipes.
- Call services.
- Return appropriate responses.

Business logic should not be implemented directly inside controllers.

## Services

Services contain application/business logic.

Keep database-specific operations separated where appropriate.

Avoid putting unrelated responsibilities into one service.

## DTOs

Use DTOs for API input.

Validate external input at the API boundary.

Do not trust data received from the frontend.

## Database

PostgreSQL is the primary database.

Database operations must be performed through the backend.

Never expose database credentials to the frontend.

Avoid dynamically generating arbitrary SQL from raw user input.

All user-provided identifiers and values must be validated appropriately.

## Data Model

The inventory system should remain flexible without unnecessarily creating a physical PostgreSQL table for every user-created inventory table.

Prefer a metadata-based architecture for user-defined tables and columns.

The exact implementation should remain consistent with the existing database design.

Do not redesign the entire data model unless explicitly requested.

---

# API

Use REST conventions consistently.

Example:

```text
GET    /tables
POST   /tables
GET    /tables/:id
PATCH  /tables/:id
DELETE /tables/:id
```

For nested resources:

```text
GET    /tables/:tableId/records
POST   /tables/:tableId/records
PATCH  /tables/:tableId/records/:recordId
DELETE /tables/:tableId/records/:recordId
```

Use appropriate HTTP status codes.

Do not return inconsistent response structures between endpoints without a reason.

---

# Authentication & Authorization

Authentication must be handled by the backend.

Protected resources must verify the authenticated user.

Every operation involving user-owned data must verify ownership or authorization.

Never rely solely on frontend route protection.

The frontend may hide unauthorized UI, but the backend must enforce authorization.

Never expose:

- passwords
- password hashes
- secrets
- database credentials
- private tokens

in API responses or client-side code.

---

# Error Handling

The backend should return meaningful HTTP errors.

The frontend should provide useful feedback to users.

Do not expose internal stack traces, SQL errors or sensitive implementation details to clients.

Handle:

- validation errors
- authentication errors
- authorization errors
- missing resources
- database failures
- unexpected server errors

appropriately.

---

# State Management

Do not introduce a global state manager unless there is a demonstrated need.

Prefer:

- React local state for local UI state.
- URL state for shareable/filterable navigation state.
- Server-state solutions for API data.
- Context only when state genuinely needs to be shared across a broad component tree.

Avoid storing duplicated server data in multiple places.

---

# Security

Treat all client input as untrusted.

Always validate:

- request bodies
- route parameters
- query parameters
- uploaded files
- user-controlled identifiers

Prevent:

- SQL injection
- XSS
- broken access control
- insecure direct object references
- accidental data exposure

Never commit secrets to Git.

Use environment variables for:

- database credentials
- JWT secrets
- API keys
- external service credentials

Provide `.env.example` when environment variables are required.

---

# Docker

The project should be runnable through Docker when practical.

Keep development and production configuration clearly separated.

Do not hard-code:

- ports
- credentials
- hostnames
- environment-specific configuration

when they should be configurable.

Keep Dockerfiles simple and reproducible.

---

# Testing

Tests should be added when they provide meaningful confidence.

Prioritize:

1. Business-critical backend logic.
2. Authentication and authorization.
3. Inventory/table operations.
4. Important frontend interactions.
5. Utility functions.

Do not write tests solely to increase coverage numbers.

Tests should verify behavior rather than implementation details.

---

# Git

## Branches

- `develop` is the integration branch. All work starts from `develop`: create feature branches from it (`feat/...`, `fix/...`, `chore/...`) and open pull requests against `develop`.
- `main` is reserved for deployments. It is only updated by merging `develop` into `main` when a release is explicitly requested.
- Never commit directly to `main` or open feature pull requests against it.

## Reviews Before Opening a Pull Request

- Every pull request: run `/code-review` and fix confirmed findings.
- Pull requests touching the backend, authentication, authorization or data access: also run `/security-review`.
- Pull requests adding or changing UI: also run an accessibility check (WCAG 2.2) on the affected components.
- Before merging `develop` into `main`: run a full security audit (OWASP Top 10) of the project.
- Mention in the pull request description which reviews were run and what was fixed.

## Commits

Use small, focused commits.

Commit messages should describe the actual change.

Avoid commits containing unrelated modifications.

Do not commit:

- `.env`
- credentials
- build output
- dependency caches
- personal configuration
- unnecessary generated files

Before committing, verify that:

- the application builds
- relevant tests pass
- there are no obvious lint/type errors
- no secrets were accidentally added

---

# Dependencies

Before adding a dependency:

1. Check whether the functionality can be implemented using the existing stack.
2. Check whether an existing dependency already provides the functionality.
3. Consider bundle size and maintenance.
4. Prefer mature and actively maintained packages.
5. Avoid adding a dependency for a trivial utility.

Do not add dependencies automatically just because an AI-generated solution uses them.

---

# AI / Codex Development Rules

Codex should understand the existing architecture before implementing changes.

When working on a task:

1. Inspect relevant files.
2. Identify existing patterns.
3. Make the smallest reasonable change.
4. Reuse existing abstractions.
5. Run relevant checks.
6. Report important assumptions or remaining issues.

Do not blindly follow generated code.

If generated code introduces unnecessary complexity, simplify it.

Do not create large abstractions without a concrete requirement.

When a task can be solved with 20 lines of understandable code, do not turn it into a 200-line abstraction.

---

# MVP Scope

The MVP should focus on:

- User registration.
- Authentication.
- User-owned inventory tables.
- Table/column management.
- Record CRUD.
- Basic searching.
- Sorting.
- Filtering.
- A usable dashboard.
- Responsive UI.
- Basic error/loading states.

Avoid implementing prematurely:

- Real-time collaboration.
- Complex permissions.
- Advanced analytics.
- Notifications.
- AI features.
- Offline synchronization.
- Complex audit systems.

These can be introduced after the core product is stable.

---

# Future Features

Potential future functionality includes:

- Real-time multi-user editing.
- Presence indicators.
- Advanced permissions.
- Activity history.
- Import/export.
- Advanced filtering.
- Collaboration.
- Notifications.
- AI-assisted inventory management.

Future functionality must not complicate the MVP unnecessarily.

---

# Documentation

Important architectural decisions should be documented.

Use:

```text
docs/
├── ROADMAP.md
└── DECISIONS.md
```

`ROADMAP.md` should contain planned functionality.

`DECISIONS.md` should contain important architectural decisions and their reasoning.

Do not use `AGENTS.md` as a constantly changing task list.

`AGENTS.md` should primarily contain stable project rules and development conventions.

---

# Definition of Done

A task is considered complete when:

- The requested functionality works.
- Existing functionality has not been unnecessarily broken.
- TypeScript errors are resolved.
- Relevant tests pass.
- No obvious lint/build errors remain.
- No secrets are exposed.
- The implementation follows the project's existing architecture.
- The code is reasonably readable and maintainable.
- Documentation is updated when the change affects an important architectural decision.

---

# Final Principle

Build Tablaria as a real maintainable application, not as a demo full of unnecessary abstractions.

Prefer:

```text
Simple > Clever
Explicit > Magical
Reusable > Duplicated
Validated > Assumed
Maintainable > Over-engineered
Working MVP > Premature Features
```