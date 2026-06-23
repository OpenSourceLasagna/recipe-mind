# CulinarAI / RecipeMind API

A RAG-powered recipe management and AI cooking assistant with hybrid search, SSE streaming, and dynamic ingredient categorization.

## Overview

CulinarAI is a full-stack recipe platform that combines traditional CRUD operations with retrieval-augmented generation (RAG) to create an intelligent cooking assistant. Users can store recipes, search them using semantic and full-text hybrid search, and interact with an AI chef that can find recipes, fetch details, and propose modifications through a streaming chat interface.

The system targets home cooks and food enthusiasts who want more than a static recipe box. It learns ingredient categories dynamically as new recipes are added, so the taxonomy evolves with the data rather than relying on a fixed schema. The AI chef doesn't just answer questions. It executes tools, retrieves real recipes from the database, and proposes structured edits that users can review and apply.

What sets this apart from typical recipe apps is the depth of the search pipeline. Queries go through vector similarity search and PostgreSQL full-text search in parallel, get merged with normalized scoring, then reranked by a cross-encoder model. The result is a search experience that handles both semantic queries like "comforting winter soup" and exact matches like "chicken tikka masala" with equal competence.

## Architecture
### System Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client"]
        Angular["Angular 21 SPA (SSR)<br/>Standalone Components<br/>Signals · OnPush · resource()"]
    end

    subgraph Auth["🔐 Auth Layer"]
        SupabaseAuth["Supabase Auth<br/>JWT Verification · RLS<br/>Session Restore"]
    end

    subgraph Gateway["⚙️ FastAPI Backend"]
        MidW["Middleware Pipeline<br/>SecurityHeaders → TrustedHost<br/>RequestId → CORS → RateLimit"]
        Routers["API Routers<br/>/v1/users · /v1/recipes<br/>/v1/search · /v1/ai-chef"]
        SvcLayer["Service Layer<br/>AIChefService · HybridSearchService<br/>RerankingService · CategoryMatchingService<br/>RecipeIngestionService · RecipeExtractionService"]
        Repos["Repository Layer<br/>RecipeRepo · IngredientCategoryRepo<br/>QueryCacheRepo"]
    end

    subgraph Data["💾 Data Layer"]
        PG[("PostgreSQL + pgvector<br/>pgvector cosine · tsvector GIN<br/>IVFFlat index<br/>RLS policies")]
    end

    subgraph AI["🤖 AI Services"]
        OpenAI["OpenAI<br/>GPT-5.4-nano · Responses API<br/>text-embedding-3-small<br/>Moderation API"]
        LocalModels["Local Models (CPU)<br/>nomic-embed-text-v1.5 (768d)<br/>cross-encoder ms-marco-MiniLM-L-6-v2<br/>Llama-Prompt-Guard-2-86M (ONNX)"]
    end

    Angular -->|"JWT (Bearer)"| SupabaseAuth
    Angular -->|"HTTP REST + SSE"| MidW
    SupabaseAuth -->|"verify token"| MidW
    MidW --> Routers
    Routers --> SvcLayer
    SvcLayer --> Repos
    Repos --> PG
    SvcLayer -->|"GPT-5 · Embeddings · Moderation"| OpenAI
    SvcLayer -->|"Ingredient Embeddings · Reranking · Prompt Guard"| LocalModels
```

### AI Chef — SSE Streaming & Safety Pipeline

```mermaid
sequenceDiagram
    actor User
    participant Angular as Angular SPA
    participant Router as FastAPI /v1/ai-chef
    participant RateLimit as Rate Limiter<br/>Token Bucket
    participant Moderation as Safety Pipeline<br/>Prompt Guard + Moderation
    participant AIChef as AIChefService
    participant OpenAI as OpenAI Responses API
    participant Tools as ToolExecutor
    participant DB as PostgreSQL

    User->>Angular: Type cooking question
    Angular->>Router: POST /chat (SSE stream, Bearer JWT)

    par Safety Check (parallel)
        Router->>RateLimit: Check per-user RPM
        Router->>Moderation: Prompt Guard (ONNX local)
        Router->>Moderation: Moderation API (OpenAI)
    end

    alt Rate limited or blocked
        Router-->>Angular: SSE error event
        Angular-->>User: Error message
    end

    Router->>AIChef: stream_chat(request, user_id)
    AIChef->>Angular: SSE status: "moderating"
    AIChef->>Angular: SSE status: "thinking"

    loop Tool Loop (max 5 iterations)
        AIChef->>OpenAI: responses.stream()<br/>json_schema strict mode
        OpenAI-->>AIChef: text_delta events
        AIChef->>Angular: SSE text_delta (streaming reply)

        alt model calls function
            OpenAI-->>AIChef: function_call event
            AIChef->>Angular: SSE status: "searching" / "fetching"
            AIChef->>Tools: execute_tool(name, args)
            Tools->>DB: hybrid search / get by id
            DB-->>Tools: results
            Tools-->>AIChef: tool output (JSON)

            par Moderate tool output
                AIChef->>Moderation: Prompt Guard
                AIChef->>Moderation: Moderation API
            end

            AIChef->>OpenAI: continue stream with tool result
        end
    end

    OpenAI-->>AIChef: final structured output
    AIChef->>Angular: SSE text: AI reply
    AIChef->>Angular: SSE recipe_list (matching recipes)
    opt recipe modifications proposed
        AIChef->>Angular: SSE recipe_draft (diff patch)
    end
    AIChef->>Angular: SSE stream complete

    Angular-->>User: Display reply + recipes + diff
```

### Hybrid Search Pipeline

```mermaid
flowchart LR
    Q["🔍 User Query"] --> Cache{"Cache<br/>hit?"}

    Cache -->|"yes"| Embedding["Cached<br/>embedding"]
    Cache -->|"no"| OpenAIE["OpenAI<br/>text-embedding-3-small<br/>(1536 dimensions)"]
    OpenAIE --> Embedding

    Embedding --> PgVec
    Q --> Fts

    subgraph DualPath["Dual-Path Retrieval (parallel)"]
        direction LR
        PgVec["pgvector<br/>cosine similarity<br/>IVFFlat index"]
        Fts["tsvector<br/>full-text search<br/>GIN index"]
    end

    PgVec --> Merge
    Fts --> Merge

    Merge["Min-Max Normalization<br/>50/50 Weighted Merge<br/>Top 200 candidates"]

    Merge --> Rerank["Cross-Encoder Reranking<br/>ms-marco-MiniLM-L-6-v2<br/>Filter by score threshold"]

    Rerank --> Sort["Sort & Paginate<br/>(relevance or field-based)"]

    Sort --> Results["📋 Ranked Results<br/>+ total count"]
```

The frontend uses standalone components with OnPush change detection, signals for state management, and the resource() API for declarative SSE streaming. SSR with hydration handles initial page loads. The backend follows a repository pattern with a service layer, and FastAPI's Depends system acts as a DI composition root with typed aliases like `RecipeRepo = Annotated[RecipeRepository, Depends(...)]`.

## Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| Python 3.13 | Runtime |
| FastAPI | Web framework |
| SQLModel / SQLAlchemy 2.0 | ORM (async) |
| PostgreSQL + pgvector | Database with vector similarity search |
| Supabase Auth | JWT authentication with Row Level Security |
| Alembic | Database migrations (async) |
| OpenAI API | GPT-5.4-nano for chat, text-embedding-3-small for recipe embeddings |
| sentence-transformers | nomic-embed-text-v1.5 for ingredient embeddings |
| cross-encoder/ms-marco-MiniLM-L-6-v2 | Reranking search results |
| ONNX Runtime | Local prompt guard model (Llama-Prompt-Guard-2-86M) |
| scikit-learn | AgglomerativeClustering for ingredient categories |
| NLTK | WordNet lemmatizer for ingredient normalization |
| pytest + pytest-asyncio | Testing |
| Ruff | Linting and formatting |
| uv | Package management |

### Frontend

| Technology | Purpose |
|------------|---------|
| Angular 21 (SSR) | Framework with server-side rendering |
| TypeScript 5.9 | Language |
| Tailwind CSS 4 | Utility-first styling |
| Spartan UI | Component library |
| Supabase JS | Auth client |
| ngx-markdown | Markdown rendering |
| Vitest | Unit testing |
| Playwright | E2E testing |
| npm | Package management |

## Key Features

### 1. Hybrid Recipe Search

Dual-path retrieval combining vector similarity search (pgvector cosine distance) and PostgreSQL full-text search (tsvector with GIN index). Results are merged with min-max normalization, weighted 50/50, then reranked by a cross-encoder model. Query embeddings are cached in a dedicated table to avoid redundant API calls.

**Files:** `apps/server/src/services/search/hybrid_search_service.py`, `apps/server/src/services/search/reranking_service.py`

### 2. AI Chef Chat

Streaming chat interface using Server-Sent Events (SSE). The AI chef has access to two tools: `search_recipes` and `get_recipe_by_id`. It operates in a tool loop (up to 5 iterations) where it can call tools, receive results, and continue reasoning. Output is structured using OpenAI's Responses API with json_schema strict mode, enforcing fields like `text`, `recipe_ids`, and `recipe_patch`. The frontend consumes the stream using Angular's resource() API with abort signal handling.

**Files:** `apps/server/src/services/ai_chef/ai_chef_service.py`, `apps/client/angular/src/app/features/chat/chat.service.ts`

### 3. Recipe CRUD

Create, update, and delete recipes with a full embedding pipeline. When a recipe is saved, it goes through normalization (lemmatization via NLTK WordNet), serialization to two formats (keyword-dense for embedding, full-structural for reranking), embedding generation (OpenAI text-embedding-3-small for the recipe, local nomic model for each ingredient), and ingredient categorization.

**Files:** `apps/server/src/routers/recipe_management.py`, `apps/server/src/services/recipe_ingestion_service.py`

### 4. Ingredient Categorization

Multi-phase categorization that runs automatically when new ingredients are added. Phase 1 matches by normalized name. Phase 2 checks centroid proximity (cosine similarity >= 0.55). Phase 3 clusters remaining ingredients using AgglomerativeClustering with average linkage and cosine distance (threshold 0.49). Phase 4 processes clusters into categories, assigning singletons to a "Misc" category or merging them with existing categories if similarity >= 0.6. Phase 5 uses GPT-4o-mini to generate human-readable names for new clusters.

**Files:** `apps/server/src/services/category_matching_service.py`

### 5. Authentication

Supabase JWT authentication with Row Level Security (RLS) policies enforced at the database level. The frontend restores sessions on app initialization using APP_INITIALIZER. HTTP interceptors attach the JWT to API requests and inject recipe context when the user is viewing a specific recipe.

**Files:** `apps/client/angular/src/app/core/auth/auth.service.ts`, `apps/client/angular/src/app/core/interceptors/api-auth-interceptor.ts`

### 6. Safety Pipeline

Three-layer safety system for the AI chef. Layer 1: per-user token bucket rate limiter (configurable RPM). Layer 2: local ONNX prompt guard model (Llama-Prompt-Guard-2-86M) that detects prompt injection and jailbreak attempts. Layer 3: OpenAI Moderation API for content policy violations. All three run in parallel for the moderation checks, and the system fails open (allows the request) if any service is unavailable.

**Files:** `apps/server/src/services/ai_chef/rate_limiter.py`, `apps/server/src/services/ai_chef/prompt_guard_service.py`, `apps/server/src/services/ai_chef/moderation_service.py`

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.13+
- PostgreSQL with pgvector extension enabled
- Supabase account (for auth)
- OpenAI API key

### Backend Setup

```bash
cd apps/server
uv venv
source .venv/bin/activate
uv sync

# Copy environment file and fill in your values
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start the server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd apps/client/angular
npm install

# Edit src/environments/environment.ts with your values:
# - supabaseUrl: your Supabase project URL
# - supabasePubKey: your Supabase anon key
# - apiUrl: http://localhost:8000 (or your backend URL)

ng serve
```

The frontend runs on `http://localhost:4200` by default.

### Database Setup

The backend expects a PostgreSQL database with the pgvector extension. Create the database and enable the extension:

```sql
CREATE DATABASE recipemind;
\c recipemind
CREATE EXTENSION IF NOT EXISTS vector;
```

Then run migrations:

```bash
cd apps/server
alembic upgrade head
```

## Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| SUPABASE_URL | Supabase project URL | https://your-project.supabase.co |
| SUPABASE_KEY | Supabase anon key | sb_publishable_... |
| DATABASE_URL | PostgreSQL connection string | postgresql+asyncpg://user:pass@localhost:5432/recipemind |
| OPENAI_API_KEY | OpenAI API key | sk-... |
| EMBEDDING_MODEL_NAME | OpenAI embedding model | text-embedding-3-small |
| EMBEDDING_SIZE | Embedding dimensions | 1536 |
| LOCAL_MODEL_PATH | Path to local models | ./local_models |
| LOCAL_EMBEDDING_MODEL_NAME | Local embedding model | nomic-ai/nomic-embed-text-v1.5 |
| LOCAL_EMBEDDING_SIZE | Local embedding dimensions | 768 |
| RERANKING_MODEL_NAME | Cross-encoder model | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| CORS_ORIGINS | Allowed origins (JSON array) | ["http://localhost:4200"] |
| AI_CHEF_MODEL_NAME | GPT model for AI chef | gpt-5.4-nano |
| AI_CHEF_RATE_LIMIT_RPM | Rate limit (requests per minute) | 10 |
| PROMPT_GUARD_MODEL_NAME | ONNX prompt guard model | gravitee-io/Llama-Prompt-Guard-2-86M-onnx |
| PROMPT_GUARD_THRESHOLD | Prompt guard sensitivity | 0.6 |
| MODERATION_THRESHOLD | Moderation sensitivity | 0.5 |

### Frontend (src/environments/environment.ts)

| Variable | Description | Example |
|----------|-------------|---------|
| production | Production mode flag | false |
| supabaseUrl | Supabase project URL | https://your-project.supabase.co |
| supabasePubKey | Supabase anon key | sb_publishable_... |
| apiUrl | Backend API URL | http://localhost:8000 |

## Testing

### Backend

```bash
cd apps/server

# Run all tests
pytest

# Run unit tests only
pytest src/tests/unit_tests/

# Run with coverage
pytest --cov=src
```

### Frontend

```bash
cd apps/client/angular

# Run unit tests (Vitest)
ng test

# Run E2E tests (Playwright)
npx playwright test

# Run E2E tests in CI mode (specific projects)
npm run test:e2e:ci
```

## Project Structure

```
agent-chat/
├── apps/
│   ├── server/                          # FastAPI backend
│   │   ├── src/
│   │   │   ├── main.py                  # App entry point, lifespan, routers
│   │   │   ├── core/                    # Config, settings
│   │   │   ├── database/
│   │   │   │   ├── db.py                # Async session factory
│   │   │   │   └── repositories/        # Data access layer
│   │   │   ├── dependencies/            # DI composition root
│   │   │   ├── models/                  # SQLModel tables
│   │   │   ├── routers/                 # API endpoints
│   │   │   ├── schemas/                 # Pydantic schemas
│   │   │   ├── services/
│   │   │   │   ├── ai_chef/             # AI chat, tools, safety
│   │   │   │   ├── search/              # Hybrid search, reranking
│   │   │   │   ├── embeddings/          # OpenAI + local embedders
│   │   │   │   ├── category_matching_service.py
│   │   │   │   ├── normalization_service.py
│   │   │   │   ├── recipe_ingestion_service.py
│   │   │   │   └── recipe_serializer.py
│   │   │   ├── tests/
│   │   │   └── utils/
│   │   ├── alembic/                     # Database migrations
│   │   ├── pyproject.toml
│   │   └── .env.example
│   │
│   └── client/
│       └── angular/                     # Angular 21 SSR frontend
│           ├── src/
│           │   ├── app/
│           │   │   ├── app.config.ts    # DI providers, interceptors
│           │   │   ├── app.routes.ts    # Route definitions
│           │   │   ├── core/
│           │   │   │   ├── auth/        # Auth service, guards
│           │   │   │   ├── interceptors/
│           │   │   │   ├── layout/      # Auth + workspace layouts
│           │   │   │   └── services/
│           │   │   ├── features/
│           │   │   │   ├── auth/        # Login, registration
│           │   │   │   ├── chat/        # AI chef chat
│           │   │   │   ├── create-recipes/
│           │   │   │   └── dashboard/   # Recipe list, detail
│           │   │   └── shared/          # Shared components, pipes
│           │   └── environments/
│           ├── angular.json
│           ├── package.json
│           └── tailwind.config.js
│
└── packages/                            # Unused placeholders
```

## Design Decisions

### 1. Dual Embedding Strategy

Recipes use OpenAI text-embedding-3-small (1536 dimensions) for rich semantic search. Ingredients use a local nomic-embed-text-v1.5 model (768 dimensions) for cost-efficient clustering. The local model runs on CPU and avoids API costs for high-volume ingredient embedding operations.

### 2. Recipe Serializer Dual Format

Recipes are serialized to two formats. `to_vector_markdown` produces a keyword-dense representation optimized for embedding (title, origin, difficulty, ingredient names). `to_rerank_markdown` produces a full structural snapshot with quantities, units, and instruction steps for cross-encoder reranking. This separation ensures each model gets the input format it works best with.

### 3. OpenAI Responses API

The AI chef uses the OpenAI Responses API (not Chat Completions) with structured output enforcement. The json_schema strict mode guarantees the model returns the expected fields (`text`, `recipe_ids`, `recipe_patch`). This eliminates parsing errors and makes the tool loop reliable.

### 4. Self-Learning Ingredient Categories

Ingredient categories aren't predefined. They emerge from the data through unsupervised clustering. When new ingredients arrive, the system checks if they match existing categories by name or centroid proximity. If not, it clusters them with AgglomerativeClustering and uses GPT to generate descriptive names. The taxonomy evolves as users add more recipes.

### 5. Security Layering

The safety pipeline has three independent layers. Rate limiting prevents abuse. The local ONNX prompt guard model detects injection attacks without network latency. OpenAI Moderation catches content policy violations. All three run in parallel, and the system fails open if any service is down. This balances security with availability.

### 6. Angular Signals + resource() API

The frontend uses Angular's signals for reactive state and the resource() API for declarative data fetching. The chat service uses resource() to manage SSE streams with automatic abort handling. When the user navigates away or cancels, the abort signal propagates through the resource and closes the connection cleanly.

### 7. SSR with Hydration

Angular SSR with Express renders the initial page on the server for SEO and fast first paint. Client hydration with event replay takes over in the browser, making the app interactive without losing any events that occurred during load. This gives you the best of both worlds: server-rendered HTML for crawlers and a fully interactive SPA for users.

## License

This project is for demonstration purposes.
