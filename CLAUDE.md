# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Colanode is an open-source, local-first collaboration platform supporting real-time chat, rich text editing, customizable databases, and file management. It uses a sophisticated CRDT-based architecture (powered by Yjs) to enable offline-first operation with automatic conflict resolution.

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend (Web)** | React 19, Vite 7, TanStack Router/Query/Form/DB, Tailwind CSS 4, SQLite WASM |
| **Frontend (Desktop)** | Electron 40 + same as Web + better-sqlite3 |
| **Frontend (Mobile)** | React Native 0.83, Expo 54 (experimental) |
| **Backend** | Fastify 5, Node.js ES Module, TypeScript 5.9 |
| **Database (Client)** | SQLite (WASM for web, better-sqlite3 for desktop, expo-sqlite for mobile) |
| **Database (Server)** | PostgreSQL 17 + pgvector, Kysely ORM 0.28 |
| **Real-Time Sync** | WebSocket (cursor-based), Yjs CRDT |
| **Message Queue** | Redis/Valkey + BullMQ |
| **File Storage** | Local FS (default), S3, GCS, Azure Blob — all via TUS protocol |
| **Auth** | Argon2 password hashing, token-based sessions, Google OAuth |
| **Email** | Nodemailer + Handlebars templates |
| **Rich Text** | TipTap (ProseMirror) with custom extensions |
| **UI Primitives** | Radix UI, shadcn-style components, CVA variants |
| **Code Quality** | ESLint + Prettier, strict TypeScript, Vitest |
| **Build** | Turborepo, Vite, tsc, tsup |
| **Deploy** | Docker Compose, Kubernetes + Helm, Cloudflare |

## Commands

### Development

```bash
# Install dependencies (also runs postinstall script to generate emoji/icon assets)
npm install
```

Prefer running dev/build/compile/format commands inside the specific app or package directory.

**Note:** Tests exist for `apps/server` and `apps/web` and are run with Vitest. Prefer running tests in the relevant app directory; `npm run test` at the repo root runs the same suites via Turbo.

### Root-Level Scripts (Turbo)

```bash
npm run compile   # Type-check all packages (tsc --noEmit)
npm run build     # Build all apps/packages
npm run clean     # Clean all outputs (dist, out, assets)
npm run dev       # Dev mode for all (Turbo watch, persistent)
npm run watch     # Watch-mode for core/crdt/server
npm run lint      # Lint all in parallel
npm run test      # Test via Turbo (server & web)
npm run format    # Prettier format all
```

### Individual App Development

**Server:**

```bash
cd apps/server
cp .env.example .env  # Configure environment variables
npm run dev           # Start server with hot reload (tsx watch, port 3000)

# Start dependencies (Postgres, Redis, Mail server) via Docker Compose
docker compose -f hosting/docker/docker-compose.yaml up -d

# Include MinIO (S3-compatible storage) for testing
docker compose -f hosting/docker/docker-compose.yaml --profile s3 up -d
```

**Web:**

```bash
cd apps/web
npm run dev  # Vite dev server on port 4000
```

**Desktop:**

```bash
cd apps/desktop
npm run dev  # Electron + Vite with hot reload (DEBUG=colanode:*)
```

**Mobile (experimental):**

```bash
cd apps/mobile
npm start    # Expo development server
```

### Utility Scripts

Located in `scripts/`:

```bash
cd scripts

# Generate emoji assets (run from scripts directory)
npm run generate:emojis

# Generate icon assets (run from scripts directory)
npm run generate:icons

# Seed database with test data (run from scripts directory)
npm run seed
```

Note: Generated emoji and icon assets are git-ignored. These are regenerated on `npm install` via the postinstall hook.

## Architecture

### Monorepo Structure

This is a Turborepo monorepo with npm workspaces:

- **`packages/core`** - Shared types, validation schemas (Zod 4), business rules, and node type registry. Foundation for all other packages. Exports via `./registry/*`, `./lib/*`, `./types/*`, `./synchronizers/*`.
- **`packages/crdt`** - CRDT implementation wrapping Yjs 13.6. Single-file `YDoc` class with schema-aware change tracking, undo/redo, and binary state management. Uses `diff` for char-level text diffing.
- **`packages/client`** - Client-side services, local SQLite database schema (two-database design: app DB + workspace DB), API communication, mediator/handler pattern, mutation batching, and synchronizers.
- **`packages/ui`** - React components using TailwindCSS 4, Radix UI primitives, TipTap editor with custom extensions, 20+ React contexts, shadcn-style component variants (CVA). Shared between web and desktop apps.
- **`apps/server`** - Fastify 5 API server with WebSocket support. PostgreSQL + Kysely ORM, Redis/BullMQ jobs, TUS file uploads, multi-cloud storage, and 7 synchronizer types.
- **`apps/web`** - Web application (Vite 7 + React 19 + TanStack Router). Uses ComLink Web Workers for background processing, OPFS for file storage, SQLite WASM, and PWA support.
- **`apps/desktop`** - Electron 40 desktop application. Native better-sqlite3, IPC-based communication, auto-updates via GitHub releases, custom `local://` protocol for assets.
- **`apps/mobile`** - React Native Expo app (experimental, not production-ready). WebView-based UI with native bridge for SQLite and file system.
- **`scripts/`** - Utility scripts for generating emojis, icons, and seed data (uses faker.js, svg-sprite, svgo).

### Dependency Graph

```
packages/core  (no deps — foundation)
     ↓
packages/crdt  ← core, yjs, diff, js-base64, zod
     ↓
packages/client ← core, crdt, tanstack/db, tanstack/react-query, tiptap, kysely
     ↓
packages/ui    ← core, client, radix-ui, tiptap, tanstack/*, tailwindcss

apps/server    ← core, crdt (direct — no client dependency)
apps/web       ← client, ui, core (via workspace deps)
apps/desktop   ← client, ui, core (via workspace deps)
apps/mobile    ← core (minimal, WebView-based)
```

### Local-First Architecture

**Core Principle:** All data operations happen locally first, then sync to the server in the background.

**Client Write Path:**

1. User makes a change (e.g., edits a document)
2. Change is immediately applied to local SQLite database
3. CRDT update is generated using Yjs (as binary `Uint8Array`)
4. Update is stored in `mutations` table as a pending operation
5. `MutationService` consolidates (removes redundant ops), batches (50 at a time), and sends to server via HTTP POST
6. Server validates, applies updates, and stores in Postgres
7. Server broadcasts changes to other clients via WebSocket
8. On failure (after 10 retries), show error and optionally revert locally

**Mutation Consolidation Rules:**
- Delete after Create/Update → cancels both
- Delete after Delete → keeps only last
- Reaction Delete after Create → cancels both

**Client Read Path:**

- All reads happen from local SQLite (instant response)
- `Synchronizer` services pull updates from server via WebSocket
- Updates are applied to local database in background
- UI reactively updates when local data changes (via EventBus → Mediator → Query invalidation)

**Key Files:**

- `packages/client/src/services/workspaces/mutation-service.ts` - Mutation batching/syncing
- `packages/client/src/services/workspaces/synchronizer.ts` - Real-time sync via WebSocket
- `packages/client/src/databases/workspace/schema.ts` - Local SQLite schema
- `packages/client/src/handlers/mediator.ts` - Query/mutation dispatcher with subscriptions
- `apps/server/src/api/client/routes/workspaces/mutations/mutations-sync.ts` - Server mutation endpoint
- `apps/server/src/services/socket-connection.ts` - WebSocket connection handler

### Client Two-Database Design

The client uses two separate SQLite databases:

**App Database** (persistent, app-level):
- `servers` - Server configurations
- `accounts` - User accounts with auth tokens
- `workspaces` - Workspace metadata (name, role, status)
- `metadata` - Key-value store
- `jobs` / `job_schedules` - Job queue with retries
- `avatars`, `tabs`, `temp_files`

**Workspace Database** (per-workspace, one SQLite file each):
- `nodes` - Node data (type, parentId, rootId, attributes, revisions)
- `node_states` / `node_updates` - CRDT state (merged vs pending)
- `node_texts` - Extracted text for search
- `node_interactions` / `node_reactions` / `node_references` / `node_counters`
- `documents` / `document_states` / `document_updates` / `document_texts`
- `mutations` - Pending mutations to send to server
- `tombstones` - Deleted node references
- `cursors` - Synchronizer cursor positions
- `collaborations` / `users`
- `local_files` / `uploads` / `downloads`

### Mediator/Handler Pattern (Client)

The client uses a mediator pattern for query/mutation dispatch:

```
UI Component → Mediator.executeQueryAndSubscribe(key, input)
                  → Handler executes query against local SQLite
                  → Result cached + subscription registered
                  → On EventBus event → check if query affected → re-execute + push update to UI

UI Component → Mediator.executeMutation(input)
                  → Handler applies changes to local SQLite
                  → Creates mutation record for sync
                  → EventBus publishes event → subscribed queries re-execute
```

### Platform-Specific Communication

| Platform | Threading Model | DB Engine | File System |
|----------|----------------|-----------|-------------|
| **Web** | ComLink Web Worker + BroadcastChannel (multi-tab) | SQLite WASM (OPFS) | Origin Private FS |
| **Desktop** | Electron IPC (main ↔ renderer) | better-sqlite3 (native) | Node.js `fs` |
| **Mobile** | WebView ↔ Native message bridge | expo-sqlite | expo-file-system |

### CRDT Integration (Yjs)

**Purpose:** Enable conflict-free collaborative editing with automatic merge resolution.

**Implementation:**

- `packages/crdt/src/index.ts` contains the `YDoc` class (single file, ~473 lines) wrapping Yjs documents
- Each node (page, database record, etc.) has a corresponding Yjs document
- Updates are encoded as binary blobs (Base64 for storage, Uint8Array for processing)
- Server merges concurrent updates automatically using Yjs CRDT semantics
- Uses `diff` library for character-level text diffing when applying string changes

**YDoc Type Handling:**
- `Y.Map` → Zod objects and records
- `Y.Array` → Zod arrays
- `Y.Text` → Strings marked with `ZOD_TEXT_DESCRIPTION` (collaborative text fields)
- Primitives → Scalars (strings, numbers, booleans)

**Undo/Redo:**
- `Y.UndoManager` with tracked origins
- Only undoes changes from 'this' client (not remote changes)
- Enables per-user undo in collaborative sessions

**Storage Strategy:**
Client storage maintains multiple layers:

1. **Current State** - JSON representation of latest merged state (for querying/UI)
2. **Merged CRDT State** - Binary Yjs state in `node_states` / `document_states`
3. **Pending Updates** - Local, unsynced CRDT updates in `node_updates` / `document_updates` kept separately so they can be reverted; once synced they are merged into `*_states` and removed

Server storage keeps current JSON state (`nodes` / `documents`) plus CRDT update history (`node_updates` / `document_updates`); background jobs merge older updates.

**Tables:**

- `nodes` / `documents` - Current state as JSON/JSONB
- `node_states` / `document_states` - Merged CRDT state (client-side)
- `node_updates` / `document_updates` - Pending local CRDT updates (client-side) and CRDT update history (server-side)

**Background Merging:**
Server jobs periodically merge old updates to reduce storage (`apps/server/src/jobs/node-updates-merge.ts`).

### Database Synchronization

**Local (SQLite) ↔ Server (Postgres):**

Cursor-based streaming synchronization:

- Each data stream (users, nodes, documents, collaborations, etc.) has a `Synchronizer`
- Synchronizers track a cursor (last synced revision number)
- Client requests updates via WebSocket: `synchronizer.input { cursor: 12345 }`
- Server responds with batch: `synchronizer.output { updates: [...], cursor: 12350 }`
- Client applies updates to local database and persists new cursor

**Synchronizer Types:**

- `users` - User list changes
- `collaborations` - Access control updates
- `node.updates` - Node CRDT updates (per workspace root)
- `document.updates` - Document CRDT updates (per workspace root)
- `node.reactions` - Emoji reactions
- `node.interactions` - Read receipts and activity tracking

**Key Files:**

- `packages/client/src/services/workspaces/synchronizer.ts`
- `apps/server/src/synchronizers/*` - Server-side data fetchers
- `apps/server/src/lib/event-bus.ts` - Event system for triggering syncs

### Node Type Registry

**Location:** `packages/core/src/registry/nodes/`

Each node type implements the `NodeModel` interface:

- `type: string` - Node type identifier
- `attributesSchema: z.ZodType` - Zod schema for node metadata
- `documentSchema?: z.ZodType` - Optional schema for collaborative content
- `canCreate()`, `canUpdateAttributes()`, `canUpdateDocument()`, `canDelete()`, `canReact()` - Permission checks
- `extractText()` - For search indexing
- `extractMentions()` - For @mentions and notifications

**Node Types (10 total):**

- `space` - Top-level container (admin-only management)
- `page` - Rich text document (has document schema)
- `database` - Structured data with custom fields and views
- `record` - Database row
- `database_view` - Saved database view (table, kanban, calendar)
- `chat` - Chat container
- `channel` - Chat channel
- `message` - Chat message
- `file` - File attachment
- `folder` - Organizational container

**ID System:** ULID-based with 2-char type suffix (e.g., `nd` for Node, `sp` for Space, `mu` for Mutation). Generated via `generateId(IdType.Node)`.

**Block/Rich Text Schema:**
```typescript
Block { id, type, parentId, content?: BlockLeaf[], attrs?, index (fractional) }
BlockLeaf { type, text?, attrs?, marks?: {type, attrs}[] }
```
Uses `fractional-indexing-jittered` for ordering without reindexing.

**Mutation Types (8):** `node.create`, `node.update`, `node.delete`, `node.reaction.create`, `node.reaction.delete`, `node.interaction.seen`, `node.interaction.opened`, `document.update`

**Important:** When adding a new node type, register it in the appropriate registry file and ensure both client and server import it.

### Server Architecture

**Bootstrap Sequence** (`apps/server/src/index.ts`):
1. Load environment variables → 2. Run DB migrations → 3. Init Redis → 4. Start Fastify app (port 3000) → 5. Init BullMQ job queue + worker → 6. Init EventBus → 7. Init email service

**API Route Structure** (`apps/server/src/api/client/routes/`):

| Group | Key Endpoints |
|-------|---------------|
| `/auth` | `POST /email/login`, `/email/register`, `/email/verify`, `/email/password-reset/*`, `/google/login`, `/logout` |
| `/accounts` | Account sync and updates |
| `/avatars` | `GET /download`, `POST /upload` |
| `/workspaces` | CRUD operations, workspace management |
| `/workspaces/:id/files` | TUS-based upload, download |
| `/workspaces/:id/users` | Invite users, update roles |
| `/workspaces/:id/mutations` | `POST /sync` - mutation synchronization |
| `/sockets` | `POST /init`, WebSocket upgrade handler |
| `/` | Home page, `/config` server configuration |

**Plugins/Middleware** (`apps/server/src/api/client/plugins/`):
- `error-handler.ts` - Global error handling with Zod error formatting
- `cors.ts` - CORS configuration
- `client.ts` - Client info extraction (IP, platform, version)
- `account-auth.ts` - Bearer token validation, device rate limiting
- `workspace-auth.ts` - Workspace access + user role validation
- `auth-ip-rate-limit.ts` - IP-based auth rate limiting

**Background Jobs** (`apps/server/src/jobs/`):
- Email: `email-verify-send`, `email-password-reset-send`, `email-workspace-invitation-send`
- Maintenance: `node-updates-merge`, `document-updates-merge`, `node-clean`, `workspace-clean`, `cleanup`
- AI (disabled): `node.embed`, `document.embed`, `assistant.respond` (LangChain removed, code commented out)

**Server Database Tables (Postgres):**
- `accounts`, `devices` - Auth and device tracking
- `workspaces`, `users` - Multi-tenancy
- `nodes`, `node_updates`, `node_reactions`, `node_interactions`, `node_tombstones`, `node_paths` - Node hierarchy
- `documents`, `document_updates` - Rich text content
- `collaborations` - Access control
- `uploads` - File metadata
- `node_embeddings`, `document_embeddings` - Vector embeddings (pgvector)
- `counters` - Denormalized stats (trigger-maintained)

**WebSocket Flow:**
1. Client calls `POST /sockets/init` → receives socket ID (stored in Redis, 60s TTL)
2. Client connects WebSocket at `WS /sockets/{socketId}`
3. SocketConnection established per device
4. EventBus (Redis pub/sub) broadcasts events to connected sockets
5. Single connection per device (replaces old connections)

### Configuration System

**Server Configuration:**

The server uses a JSON-based configuration system with smart reference resolution:

- **Config File Location**: Set via `CONFIG` environment variable (e.g., `CONFIG=/path/to/config.json`)
- **Default Behavior**: If `CONFIG` is not set, server uses schema defaults from `apps/server/src/lib/config/`
- **Example Config**: See `apps/server/config.example.json` for a complete template

**Reference Resolution:**

The config system supports special prefixes for dynamic value loading:

- `env://VAR_NAME` - Resolves to environment variable at runtime (required, fails if not set)
- `file://path/to/file` - Reads and inlines file contents at runtime (useful for certificates/secrets)
- Direct values - Plain strings/numbers/booleans in JSON

**Example:**
```json
{
  "postgres": {
    "url": "env://POSTGRES_URL",
    "ssl": {
      "ca": "file:///secrets/postgres-ca.pem"
    }
  },
  "storage": {
    "provider": {
      "type": "s3",
      "endpoint": "env://S3_ENDPOINT",
      "accessKey": "env://S3_ACCESS_KEY",
      "secretKey": "env://S3_SECRET_KEY"
    }
  }
}
```

**Required Configuration:**
- Only `postgres.url` is truly required (defaults to `env://POSTGRES_URL`)
- All other settings have sensible defaults in the Zod schemas
- Storage defaults to `file` type with `./data` directory
- Redis defaults to `env://REDIS_URL` but has fallback behavior

**For Docker/Production:**
1. Copy `apps/server/config.example.json` to your own config file
2. Update values (use `env://` for secrets, direct values for non-sensitive settings)
3. Mount your config file and set `CONFIG=/path/to/mounted/config.json`
4. Set required environment variables referenced by `env://` pointers

**For Local Development:**
- Use `.env` file in `apps/server/` directory
- Server will use schema defaults if no config file is provided
- See `apps/server/.env.example` for available environment variables

**Config Validation:**
- All config is validated using Zod schemas at startup
- Validation errors show clear messages about missing/invalid values
- Server exits immediately if config is invalid

**Client Apps:**

- Use standard `.env` files for build-time configuration
- Runtime configuration fetched from server

## Testing

**Automated Tests (Vitest):**

- `apps/server`: `npm run test` — Integration tests using Testcontainers (requires Docker for Postgres & Redis)
- `apps/web`: `npm run test` — Unit tests with jsdom environment
- Repo root: `npm run test` (runs app tests via Turbo)
- Focus manual verification on areas without test coverage
- Include clear verification steps in pull request descriptions

**Server Test Structure** (`apps/server/test/`):
- `helpers/app.ts` - Test app builder with Testcontainers
- `helpers/seed.ts` - Test data seeding
- `api/` - API endpoint tests (auth, workspace, account, mutations, files)
- `synchronizers/` - Synchronizer tests (users, collaborations, node-updates)
- `lib/` - Library function tests

**Web Test Structure** (`apps/web/test/`):
- `setup-dom.ts` - Mocks for `matchMedia`, `IntersectionObserver`, `ResizeObserver`
- `test-utils.tsx` - Custom render wrapper
- `components/` - Component tests (browser/mobile unsupported screens)
- `services/` - Service tests (bootstrap, file-system, path-service)
- `workers/` - Service worker tests
- `helpers/` - Mock OPFS and file system implementations

**Coverage Gaps:** `packages/core`, `packages/crdt`, `packages/client`, `packages/ui`, `apps/desktop` have no tests yet.

**CI:** PR tests run via `.github/workflows/pr-tests.yml` using Turbo SCM-based affected detection.

## Development Tips

### Working with CRDTs

When modifying node or document schemas:

1. Update Zod schema in `packages/core/src/registry/nodes/<type>.ts`
2. The CRDT layer automatically handles schema validation via `YDoc.update()`
3. Test with multiple clients to verify conflict resolution
4. Remember: updates are append-only, deletions use tombstones

### Debugging Synchronization

**Client-side:**

- Check `mutations` table for pending operations
- Check `cursors` table for sync position
- Use browser DevTools WebSocket tab to inspect messages

**Server-side:**

- Logs are in JSON format (Pino logger)
- Look for `synchronizer.input` / `synchronizer.output` messages
- Check `node_updates` table for stored updates
- Verify revision numbers are incrementing

### Database Migrations

**Server (Postgres):**

- Schema defined in `apps/server/src/data/schema.ts`
- Migrations live in `apps/server/src/data/migrations` and run via the Kysely migrator in `apps/server/src/data/database.ts`
- Add a migration for schema changes; avoid manual production edits. For local dev, dropping the DB is a last resort.

**Client (SQLite):**

- Schema versioning handled in `packages/client/src/databases/workspace/schema.ts`
- Migration logic in `packages/client/src/databases/workspace/migrations.ts`
- Migrations run automatically on app startup

### Adding a New Node Type

1. Create schema in `packages/core/src/registry/nodes/<type>.ts`
2. Define attribute schema, document schema (if collaborative), and permissions
3. Register in `packages/core/src/registry/nodes/index.ts`
4. Update server-side node creation logic in `apps/server/src/lib/nodes.ts`
5. Add client-side service in `packages/client/src/services/`
6. Create UI components in `packages/ui/src/components/`

### Storage Backends

Server supports multiple storage backends for files:

- **File** (default) - Local filesystem storage in `./data` directory
- **S3** - AWS S3 or compatible (MinIO, DigitalOcean Spaces, etc.)
- **GCS** - Google Cloud Storage
- **Azure** - Azure Blob Storage

**Configuration:**

Configure via `storage.provider.type` in your config file. Examples:

**Filesystem (default):**
```json
{
  "storage": {
    "provider": {
      "type": "file",
      "directory": "./data"
    }
  }
}
```

**S3-compatible:**
```json
{
  "storage": {
    "provider": {
      "type": "s3",
      "endpoint": "env://S3_ENDPOINT",
      "accessKey": "env://S3_ACCESS_KEY",
      "secretKey": "env://S3_SECRET_KEY",
      "bucket": "env://S3_BUCKET",
      "region": "env://S3_REGION",
      "forcePathStyle": false
    }
  }
}
```

**GCS:**
```json
{
  "storage": {
    "provider": {
      "type": "gcs",
      "bucket": "env://GCS_BUCKET",
      "projectId": "env://GCS_PROJECT_ID",
      "credentials": "file:///secrets/gcs-credentials.json"
    }
  }
}
```

**Azure:**
```json
{
  "storage": {
    "provider": {
      "type": "azure",
      "account": "env://AZURE_STORAGE_ACCOUNT",
      "accountKey": "env://AZURE_STORAGE_ACCOUNT_KEY",
      "containerName": "env://AZURE_CONTAINER_NAME"
    }
  }
}
```

See `apps/server/src/lib/storage/` for implementations and `apps/server/src/lib/config/storage.ts` for full schema.

## Common Patterns

### Service Layer Pattern

Services encapsulate business logic and coordinate between database and API:

- `packages/client/src/services/` - Client-side services
- `apps/server/src/services/` - Server-side services

### Repository Pattern

Database access abstracted through clear interfaces:

- `packages/client/src/databases/` - Client database layer
- `apps/server/src/data/` - Server database layer

### Event-Driven Updates

- Client: Uses TanStack DB for reactive data fetching alongside TanStack Query
- Server: Uses EventBus (Redis-backed) for cross-instance communication
- Background jobs via BullMQ for asynchronous processing

### Optimistic Updates

All mutations are optimistic:

1. Update local state immediately
2. Show UI change instantly
3. Send mutation to server in background
4. On failure (after 10 retries), show error and optionally revert
5. CRDT ensures eventual consistency even if server order differs

## Deployment & Hosting

**Docker Compose** (`hosting/docker/docker-compose.yaml`):
- Services: postgres (pgvector/pg17), valkey (Redis-compatible), minio (optional, `--profile s3`), smtp (Mailpit, optional), server, web
- Ports: Postgres 5432, Redis 6379, MinIO 9000/9001, Server 3000, Web 4000

**Kubernetes/Helm** (`hosting/kubernetes/`):
- Chart v0.2.2 with Bitnami dependencies (postgresql, valkey, minio)
- Ingress, HPA, RBAC, storage PVC templates
- Configurable storage backends (file, S3, GCS, Azure)

**CI/CD Workflows** (`.github/workflows/`):
- `pr-tests.yml` - PR test runner (Turbo SCM-based)
- `server-docker-build-and-push.yml` / `web-docker-build-and-push.yml` - Docker images
- `desktop-build-and-publish.yml` - Electron builds via Electron Forge
- `web-cf-build-and-deploy.yml` / `web-cf-build-and-deploy-beta.yml` - Cloudflare deployment
- `helm-chart-publish.yml` - Helm chart publishing
- `postgres-docker-build-and-push.yml` - Custom pgvector Postgres image

## Important Considerations

- **Generated Assets:** Emoji and icon files are generated during `npm install`. Don't commit these to git.
- **TypeScript Source Imports:** Packages use TypeScript source directly (not compiled outputs) during development for faster iteration.
- **TypeScript Strictness:** `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. Only 7 `@ts-expect-error` instances and ~20 `any` uses across the entire codebase.
- **Local-First Mindset:** Always assume network can fail. Design features to work offline first.
- **CRDT Limitations:** Not all data types use CRDTs (e.g., messages and files use simpler database tables).
- **Mobile App:** The `apps/mobile` is experimental and not production-ready. Uses WebView bridge pattern.
- **Performance:** For large workspaces, synchronizers per root node can cause memory pressure. Monitor closely.
- **AI Features:** LangChain dependencies were removed (`#281`). AI/embedding job handlers are commented out but infrastructure remains (pgvector tables, job definitions).
- **Known TODOs:** Avatar upload (stubbed), database utilities (incomplete), error handler validation details (not implemented).
