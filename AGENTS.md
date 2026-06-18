# AGENTS.md

This repository uses a skill-driven execution model (OpenCode). Agents must strictly follow skills, architecture rules, and lifecycle constraints.

---

## Repository Structure

- `apps/client/angular/` → Angular 21 SSR frontend (standalone, signals, Tailwind)
- `apps/server/` → FastAPI backend (Python 3.13, SQLModel, Alembic, pgvector)
- `packages/ai/`, `packages/schemas/` → unused placeholders
- `playground/` → notebooks, experiments

Each app is independent. No shared workspace tooling.

---

## Core Rule

If a task matches a skill, it MUST be used.

Do not implement directly if a skill applies.

Skills live in:
skills/<skill-name>/SKILL.md

---

## Skill Execution Model

1. Detect intent
2. Map to skill
3. Invoke skill tool
4. Follow skill workflow exactly
5. Only implement after required phases are completed

---

## Lifecycle Mapping

- DEFINE → spec-driven-development
- PLAN → planning-and-task-breakdown
- BUILD → incremental-implementation + test-driven-development
- VERIFY → debugging-and-error-recovery
- REVIEW → code-review-and-quality
- SHIP → shipping-and-launch

---

## Intent → Skill Mapping

- Feature / new functionality → spec → implementation → tests
- Planning → planning-and-task-breakdown
- Bugs → debugging-and-error-recovery
- Refactor → code-simplification
- API design → api-and-interface-design
- UI work → frontend-ui-engineering
- Review → code-review-and-quality

---

## Forbidden Shortcuts

- “This is too small for a skill”
- “I’ll just implement quickly”
- “Skip planning”

All are invalid.

---

## Orchestration Model

### Layers

- Skills → execution workflows (primary)
- Personas (`agents/`) → role + output format only
- Commands (`.claude/commands/`) → orchestration entry points

---

## Rules

- Personas cannot orchestrate other personas
- Skills do not chain into other skills automatically
- No router agents allowed
- Only commands orchestrate workflows

---

## Multi-Agent Pattern

Only allowed pattern:

parallel execution → merge results

Used in `/ship`:

- code-reviewer
- security-auditor
- test-engineer

---

## Backend (FastAPI)

### Run

```bash
cd apps/server
uv venv .venv
source .venv/bin/activate
uv sync
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Tests

```bash
pytest
pytest src/tests/unit_tests/
```

### Lint

```bash
ruff check src/
ruff format --check src/
```

### DB

```bash
alembic revision --autogenerate -m "msg"
alembic upgrade head
```

- SQLModel + PostgreSQL (asyncpg)
- pgvector cosine similarity search
- embeddings:

  - recipes → OpenAI text-embedding-3-small
  - ingredients → nomic-embed-text-v1.5

---

## Frontend (Angular 21 SSR)

### Run

```bash
cd apps/client/angular
npm install
# Edit environment.ts with your real Supabase and API values
ng serve
```

### Rules

- Standalone components only
- OnPush change detection
- Signals only
- No `*ngIf`, `*ngFor`
- Use `@if`, `@for`, `@switch`
- `inject()` only
- No constructor DI
- Reactive forms only
- Lazy-loaded routes

### Stack

- Angular 21 SSR
- Tailwind CSS 4
- Spartan UI
- Supabase JS
- Vitest

---

## Shared Rules

- `.env*` ignored except `.env.example`
- `packages/` unused
- No shared monorepo tooling
- Apps remain fully independent

---

## Skill Authoring

### Structure

skills/<name>/
SKILL.md
scripts/ <name>.zip

### Requirements

- SKILL.md defines name, triggers, workflow, output, troubleshooting
- Scripts (if used):

  - bash only
  - set -e
  - stderr logs, stdout JSON
  - cleanup trap required

### Packaging

```bash
zip -r <name>.zip <name>/
```

### Install

```bash
cp -r skills/<name> ~/.claude/skills/
```

---

## Principle

Skills > direct implementation > ad-hoc reasoning

If a skill exists, it is mandatory.
