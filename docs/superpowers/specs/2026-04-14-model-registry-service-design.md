# Model Registry Service — Design Spec

**Date:** 2026-04-14
**Status:** Approved for planning
**Working name:** `clarive-model-registry`
**Consumers (v1):** Clarive. Other internal products as they come online.

## 1. Problem

Clarive currently runs a Quartz job (`LiteLlmSyncJob`) that pulls BerriAI's `model_prices_and_context_window.json` daily, caches it in Valkey + a bundled JSON file, and uses the data to auto-populate pricing and capability fields on `AiProvider.Models` rows. A second, orthogonal path fetches pricing/capability data from OpenRouter's `/models` endpoint at runtime whenever a tenant's provider is configured against `openrouter.ai`.

This logic is useful beyond Clarive. Every new internal product that needs LLM pricing or capability metadata would either duplicate the sync job, reimplement the parsers, or hammer upstream sources independently. We want one place that owns:

- Fetching LLM pricing + capability + context-window data from multiple sources.
- Merging them into a single normalized catalog.
- Serving them over a small internal HTTP API.
- Providing a typed .NET client for easy consumption.

The service is for internal use only in its current scope. No public API, no multi-tenant concerns.

## 2. Goals and Non-Goals

**Goals**
- Single source of truth for LLM model pricing, context limits, and capability flags across our internal product portfolio.
- Absorb upstream flakiness: if one source fails, consumers don't notice.
- Low operational overhead — no database, no queue, no sidecar dependencies.
- Clean migration path for Clarive: feature-flagged, reversible, deletes legacy code only after parallel-run validation.

**Non-goals (v1)**
- Public API. Authentication is a shared-secret API key, not user-level auth.
- Admin UI or manual curation. Fixed per-field merge priority only.
- Historical price tracking. We keep the current snapshot; we do not keep yesterday's.
- Benchmark data (Artificial Analysis, Chatbot Arena, etc.).
- Multi-region deployment. Single-instance, behind Caddy, next to the other services on the same host.
- Consumer SDKs for languages other than .NET. Non-.NET consumers use raw HTTP + OpenAPI.

## 3. Architecture

### 3.1 Runtime topology

```
   Caddy (TLS termination, hostname routing)
         │
         ▼
  ┌─────────────────────────────────────────┐         daily 01:00 UTC + on startup
  │  Clarive.ModelRegistry.Service          │  ──────────────────────────────────┐
  │  ─────────────────────────────────────  │                                    ▼
  │  • 3 source fetchers (parallel)         │    LiteLLM (GitHub raw JSON)
  │  • Normalizers per source               │    OpenRouter (/api/v1/models)
  │  • Per-field priority merger            │    models.dev (catalog JSON)
  │  • In-memory snapshot (volatile swap)   │                                    │
  │  • On-disk snapshot (./data/snapshot.json)  ◀─────────────────────────────────┘
  │    — tmp-file + rename, crash-safe
  │  • REST API over in-mem snapshot (<1ms)
  └─────────────────────────────────────────┘
                 ▲
                 │  HTTPS + X-Api-Key
                 │
    ┌────────────┴────────────────────────┐
    │                                     │
  Clarive                        Other internal products
  (via Clarive.ModelRegistry.Client       (via SDK or raw HTTP)
   NuGet package)
```

**Key properties**
- No database. No Valkey on the service side (consumers have their own). Single container, one writable volume for `./data/snapshot.json`.
- If all upstream sources fail on a refresh cycle, the previous snapshot keeps serving. `/v1/meta` exposes staleness so operators and consumers can react.
- Consumers cache the service's responses themselves (the SDK uses `IDistributedCache` with a 1h default TTL). The service itself answers from RAM so its own latency is trivial either way.

### 3.2 Repository layout

Private GitHub repo `clarive-model-registry`. Two projects in one solution:

```
clarive-model-registry/
├── src/
│   ├── Clarive.ModelRegistry.Service/          # ASP.NET Core 10 Minimal API
│   │   ├── Sources/                            # Source fetchers (ILiteLlmSource, etc.)
│   │   ├── Normalization/                      # Raw → canonical DTO mappers
│   │   ├── Merging/                            # Per-field priority resolver
│   │   ├── Catalog/                            # In-memory snapshot + query
│   │   ├── Jobs/                               # Quartz sync job
│   │   ├── Endpoints/                          # /v1/models, /{id}, /sources, /meta, /healthz
│   │   ├── Auth/                               # X-Api-Key middleware
│   │   └── Program.cs
│   └── Clarive.ModelRegistry.Client/           # .NET SDK (NuGet)
│       ├── IModelCatalogClient.cs
│       ├── ModelCatalogClient.cs               # HttpClient + IDistributedCache + Polly
│       ├── Dtos/                               # Shared via <Compile Include Link=...>
│       └── ServiceCollectionExtensions.cs
├── tests/
│   ├── Clarive.ModelRegistry.Service.Tests/                # xUnit
│   ├── Clarive.ModelRegistry.Service.IntegrationTests/     # WebApplicationFactory + fakes
│   └── Clarive.ModelRegistry.Client.Tests/                 # xUnit + MockHttp
├── deploy/
│   ├── Dockerfile                              # multi-stage, alpine runtime
│   └── docker-compose.yml                      # example deployment
├── scripts/
│   └── refresh-fixtures.ps1                    # capture new real-world samples
├── .github/workflows/                          # build, test, publish container + NuGet
├── Directory.Packages.props                    # central package management
├── Directory.Build.props                       # analyzers, warnings-as-errors
├── global.json                                 # .NET 10 pinned
└── ModelRegistry.slnx                          # XML-format solution
```

The repo mirrors Clarive's toolchain conventions: CSharpier formatting, Meziantou + SonarAnalyzer + Roslynator analyzers, central package management, `.slnx` solution format.

## 4. Data Model

### 4.1 Canonical identity

Canonical model ID is `{providerSlug}/{modelId}`, lowercase. Matches LiteLLM's convention — the most widely-used de facto standard. Examples:

- `openai/gpt-5`
- `anthropic/claude-sonnet-4.6`
- `meta/llama-3.1-70b-instruct`

Source-specific IDs that don't match the canonical form are resolved via a hand-maintained `alias-map.json` shipped with the service. Unmapped exotic IDs (for example OpenRouter routing variants like `anthropic/claude-sonnet-4.6:beta`) pass through as their own canonical ID — they represent legitimately different SKUs and should not collide with the base model.

### 4.2 Canonical DTOs

```csharp
public sealed record ModelInfo(
    string Id,
    string Provider,
    string ModelId,
    string? DisplayName,
    Pricing? Pricing,
    Context? Context,
    Capabilities Capabilities,
    Modality Modality,
    IReadOnlyList<string> Sources,
    DateTimeOffset LastUpdated);

public sealed record Pricing(
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion,
    decimal? CachedInputCostPerMillion,
    decimal? ReasoningOutputCostPerMillion,
    string Currency);                // "USD" for all known sources today

public sealed record Context(
    long? MaxInputTokens,
    long? MaxOutputTokens);

public sealed record Capabilities(
    bool? IsReasoning,
    bool? SupportsFunctionCalling,
    bool? SupportsResponseSchema,
    bool? SupportsVision,
    bool? SupportsAudioInput);

public enum Modality { Chat, Embedding, Image, Audio, Other }
```

Nullable bools on `Capabilities` are deliberate. `null` means "no source reports this" (unknown). `false` means "a source reports it does not support this". Consumers that treat `null` as `false` today keep working; consumers that care about the distinction get it.

`Sources` reflects which upstream contributed at least one field to the merged view.

DTOs live in `Clarive.ModelRegistry.Client` and are linked into the service project via `<Compile Include="..\Clarive.ModelRegistry.Client\Dtos\*.cs" Link="Dtos\%(Filename).cs" />`. Single source of truth for the wire contract; no codegen; no duplicated records drifting out of sync.

### 4.3 Per-field merge priority

Per-field, first-wins. Configurable via `appsettings.json`; defaults below.

| Field group | Priority (first wins) | Rationale |
|---|---|---|
| `Pricing.*` | OpenRouter → LiteLLM → models.dev | OpenRouter's prices are live from provider billing APIs. |
| `Context.Max*Tokens` | LiteLLM → models.dev → OpenRouter | LiteLLM's context data is the most complete and curated. |
| `Capabilities.*` | LiteLLM → models.dev → OpenRouter | Capability flags are well-maintained in LiteLLM; OpenRouter only exposes a subset. |
| `DisplayName`, `Modality` | models.dev → LiteLLM → OpenRouter | models.dev ships the cleanest human-readable names. |

The merger walks each field independently. A single `ModelInfo` can draw pricing from OpenRouter, context from LiteLLM, and display name from models.dev.

## 5. Sync Pipeline and Failure Behaviour

### 5.1 Trigger cadence

- On startup: immediate fire.
- Scheduled: every 24 hours at 01:00 UTC (configurable).
- `POST /v1/refresh` (API-key-protected): manual trigger for operator use or CI smoke tests.

The Quartz job is marked `[DisallowConcurrentExecution]`. A `POST /v1/refresh` received while a scheduled job is in flight returns `409 Conflict` rather than queueing.

### 5.2 Per-refresh flow

1. Fire the 3 source fetchers in parallel (`Task.WhenAll`, 30s timeout each).
2. Each fetcher returns `ErrorOr<SourceSnapshot>`.
3. The merger runs over whichever sources succeeded.
4. Produce a new `NormalizedSnapshot { Models, SourceStates, FetchedAt }`.
5. Atomically swap the in-memory snapshot (volatile reference assignment — no locks on reads).
6. Write to `./data/snapshot.json` using tmp-file + atomic rename (crash-safe).
7. Log per-source success/failure counts, total model count, duration.

### 5.3 Failure policies

**Partial failure** (one or two sources fail). Merge runs using whichever sources succeeded. Fields the failed source would have contributed simply don't contribute this cycle. The previous snapshot's values for the failed source are **not** carried forward — that would create ambiguously-stale ghost data. `SourceStates` records each source's `lastSuccessfulFetch` and `lastError` so consumers and `/v1/meta` can see exactly what fed the current view.

**Full failure** (all sources fail). Previous snapshot stays live. `/v1/meta.healthy` flips to `false` once the snapshot exceeds a configurable threshold (default 72 hours). That flows into `/healthz` as `Degraded`, which Caddy / uptime monitors can alert on.

**Cold start.** The service loads `./data/snapshot.json` into memory before accepting traffic. If the file doesn't exist (first-ever boot) and the sync job hasn't finished, `/v1/models` returns `503 Service Unavailable` with a clear message. Typically a ~10 second window on a fresh deploy.

### 5.4 Retries and rate limits

Fetchers use Polly: 3 retries with exponential backoff (1s, 4s, 15s); circuit breaker opens after 5 consecutive failures and stays open for 5 minutes. HTTP 429 responses honour `Retry-After`. Daily polling is nowhere near any source's documented rate limits.

## 6. HTTP API

REST, JSON, OpenAPI spec published at `/swagger`. All endpoints require `X-Api-Key` except `/healthz`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/models` | List all models. Query params: `provider`, `modality`, `isReasoning`, `supportsFunctionCalling`. |
| `GET` | `/v1/models/{provider}/{modelId}` | Lookup one model by canonical ID. 404 if unknown. |
| `GET` | `/v1/sources` | Raw per-source snapshots for debugging. |
| `GET` | `/v1/sources/{source}/models/{provider}/{modelId}` | Unmerged per-source view of a specific model. |
| `GET` | `/v1/meta` | `snapshotAt`, `staleness`, `sourceStates`, `healthy`. |
| `POST` | `/v1/refresh` | Trigger an immediate sync. Returns 202, or 409 if already running. |
| `GET` | `/healthz` | Readiness probe — 200 when snapshot is loaded and fresh enough, `Degraded` otherwise. |
| `GET` | `/metrics` | Prometheus text format. |

Example `/v1/meta` response:

```json
{
  "snapshotAt": "2026-04-13T01:00:00Z",
  "staleness": "26.4h",
  "sourceStates": [
    { "source": "litellm",    "lastSuccess": "2026-04-13T01:00:00Z", "lastError": null },
    { "source": "openrouter", "lastSuccess": "2026-04-13T01:00:00Z", "lastError": null },
    { "source": "modelsdev",  "lastSuccess": "2026-04-12T01:00:00Z", "lastError": "HTTP 503" }
  ],
  "healthy": true
}
```

## 7. Authentication

Shared-secret API keys via the `X-Api-Key` header. Matches Clarive's existing internal pattern.

Configuration (env or `appsettings.json`):

```json
"ModelRegistry": {
  "ApiKeys": [
    { "name": "clarive",         "key": "..." },
    { "name": "future-product",  "key": "..." }
  ]
}
```

Named keys make per-consumer rotation painless. An `Auth/ApiKeyMiddleware` validates the header on every request except `/healthz`. Missing/invalid keys return 401. Successful auth attaches the caller's `name` to the logging scope so `X-Api-Key: <key>` calls are traceable per-consumer in logs and metrics.

## 8. .NET Client SDK

`Clarive.ModelRegistry.Client`. Small interface on purpose:

```csharp
public interface IModelCatalogClient
{
    Task<ModelInfo?> GetModelAsync(string canonicalId, CancellationToken ct = default);
    Task<ModelInfo?> GetModelAsync(string provider, string modelId, CancellationToken ct = default);
    Task<IReadOnlyList<ModelInfo>> ListModelsAsync(ModelQuery? query = null, CancellationToken ct = default);
    Task<CatalogMeta> GetMetaAsync(CancellationToken ct = default);
}

public sealed record ModelQuery(
    string? Provider = null,
    Modality? Modality = null,
    bool? IsReasoning = null,
    bool? SupportsFunctionCalling = null);
```

Registration:

```csharp
builder.Services.AddModelCatalogClient(opts =>
{
    opts.BaseUrl = cfg["ModelRegistry:BaseUrl"]!;
    opts.ApiKey  = cfg["ModelRegistry:ApiKey"]!;
    opts.CacheTtl = TimeSpan.FromHours(1);
    opts.RequestTimeout = TimeSpan.FromSeconds(10);
});
```

What the SDK does under the hood:

- Named `HttpClient` via `IHttpClientFactory`.
- `X-Api-Key` injected via a `DelegatingHandler`.
- Polly: 3x exponential retry + circuit breaker on 5xx/timeout.
- Responses cached in `IDistributedCache` (Valkey in Clarive; falls back to `MemoryDistributedCache` if not registered). Keys: `modelregistry:v1:model:{id}`, `modelregistry:v1:list:{hashOfQuery}`. Stampede protection via `SemaphoreSlim` per cache key — same pattern as Clarive's `TenantCacheService`.
- Fail-soft reads: if the service is unreachable **and** a cache entry exists whose TTL expired less than 24 hours ago, the SDK returns the stale value and logs a warning. With no cache entry at all, it throws. Keeps Clarive usable during a registry outage.

Versioned semver-strict: breaking changes to DTOs bump the major. Published to GitHub Packages feed.

## 9. Clarive Migration

### 9.1 Removed from Clarive

- `src/backend/Clarive.Application/Background/LiteLlmSyncJob.cs`
- `src/backend/Clarive.Application/AiProviders/Services/LiteLlmRegistryCache.cs` + interface
- `tests/backend/Clarive.Api.UnitTests/Services/LiteLlmRegistryCacheTests.cs`
- `src/backend/Clarive.Api/data/litellm-model-prices.json`
- `ILiteLlmRegistryCache` registration and Quartz schedule in `Program.cs`.

### 9.2 Added to Clarive

- NuGet reference to `Clarive.ModelRegistry.Client`.
- `AddModelCatalogClient` registration in `Program.cs`, reading `MODEL_REGISTRY_URL` and `MODEL_REGISTRY_API_KEY` from env.
- A thin adapter `ModelRegistryLookup` exposing the same shape `AiProviderService.SyncModelsAsync` currently gets from `ILiteLlmRegistryCache` (`TryGetModelInfoAsync`, `IsKnownNonChatModel`). Internally it calls `IModelCatalogClient` and maps `ModelInfo` → the existing internal record. `AiProviderService` does not change.
- A new `ModelRegistrySyncJob` in Clarive that performs the same walk over `AiProvider.Models` that `LiteLlmSyncJob` did, but resolves values via `IModelCatalogClient` instead of a local cache.

### 9.3 OpenRouter path

The runtime OpenRouter fetch in `AiProviderService.SyncModelsAsync` (the `IsOpenRouterEndpoint` + `UseProviderPricing` path) **stays**. It's still needed to discover the tenant-specific list of models this tenant's API key can access. Only the pricing/capability extraction from OpenRouter's response is redirected: instead of inline parsing, those values come from `IModelCatalogClient`. Net effect: Clarive stops scraping `openrouter.ai/api/v1/models` for pricing data from every deploy.

### 9.4 Migration order

Feature-flagged, reversible:

1. Build the service; deploy a central instance behind Caddy.
2. Publish client SDK 1.0.0 to GitHub Packages.
3. Add `Clarive.ModelRegistry.Client` to Clarive alongside existing `LiteLlmRegistryCache`. Feature-flag the new path via `ModelRegistry:Enabled`. With the flag off, Clarive behaves exactly as today.
4. Test on `demo-dev.clarive.app` with the flag on. Snapshot the `provider_models` table before/after; verify `AiProviderService.SyncModelsAsync` populates rows identically.
5. Flip the flag on in production. Monitor for a week.
6. Delete legacy code listed in §9.1 in one atomic PR. Easy to revert.

## 10. Testing

### 10.1 Service unit tests
- **Normalization per source.** Fixture JSON per source under `tests/.../Fixtures/{source}/sample.json`, refreshed via `scripts/refresh-fixtures.ps1`. Pins parser contracts against real-world payloads.
- **Merger.** Table-driven tests for the per-field priority matrix. Each field-group gets one test.
- **Staleness.** Fake `TimeProvider`; assert `/v1/meta.healthy` flips at the configured threshold.
- **Alias resolution.** Mismatched IDs across sources collapse onto the canonical form.

### 10.2 Service integration tests
`WebApplicationFactory`-based. No database to containerise, so the three source fetchers are swapped for in-memory fakes returning pre-baked JSON.

- Full pipeline: startup → sync → `/v1/models` → correct merged response → `/v1/meta` reflects source states.
- Partial failure: one fake returns 503; snapshot still publishes with two sources and `sourceStates` records the failure.
- Auth: missing key → 401; wrong key → 401; correct key → 200.
- `/v1/refresh` during scheduled job → 409.
- Cold start: delete `snapshot.json`, slow fakes; `/v1/models` returns 503 until first sync lands.

### 10.3 Client SDK tests
`HttpClient` mocked via `MockHttp` / custom `DelegatingHandler`. Assertions:

- `X-Api-Key` injected on every request.
- Retries fire on 5xx; circuit breaker opens after 5 failures.
- Stale-cache fallback serves old data when the service is unreachable.
- Cache keys are correct; stampede lock serialises concurrent callers.

### 10.4 Clarive-side migration tests
- Unit test on `ModelRegistryLookup` adapter — maps `ModelInfo` → the shape `AiProviderService` expects, including `IsKnownNonChatModel` behaviour for non-chat modalities.
- Existing `LiteLlmRegistryCacheTests` are deleted with the cache itself in the cleanup PR.

## 11. Operations

### 11.1 Deployment

- Multi-stage Dockerfile; runtime `mcr.microsoft.com/dotnet/aspnet:10.0-alpine`.
- Non-root user. `/app/data` mounted as a volume for the snapshot file.
- Runs behind the existing Caddy in `~/Services` at a hostname such as `models.internal.clarive.app`. Caddy handles TLS and routing.
- Docker Compose file in `deploy/docker-compose.yml` for local/dev runs.
- No Postgres, no Valkey on the service host.

### 11.2 Configuration

Environment variables and `appsettings.json`:

- `ModelRegistry:ApiKeys` — list of `{ name, key }` pairs.
- `ModelRegistry:Sources:LiteLlm:Url`, `:OpenRouter:Url`, `:ModelsDev:Url` — each with `Enabled` toggle.
- `ModelRegistry:Merge:*` — per-field priority overrides.
- `ModelRegistry:SnapshotPath` (default `/app/data/snapshot.json`).
- `ModelRegistry:StaleThresholdHours` (default 72).
- `ModelRegistry:SyncCron` (default `0 0 1 * * ?` — 01:00 UTC daily).

### 11.3 Observability

Deliberately minimal for a small internal service.

- Serilog structured logs to stdout.
- `/healthz` (readiness + staleness).
- `/metrics` in Prometheus text format:
  - `model_registry_models_total`
  - `model_registry_source_last_success_seconds{source}`
  - `model_registry_refresh_duration_seconds`
  - `model_registry_refresh_errors_total{source}`

### 11.4 CI

GitHub Actions:

- On PR: build, lint (CSharpier check), run all tests.
- On tag push: build + publish Docker image + publish NuGet to GitHub Packages.

Workflow YAML is out of scope for this spec; drafted during implementation.

## 12. Open Items Parked for Future Versions

These are not v1 blockers; documented here so they don't get lost.

- Admin UI and manual-override layer on top of priority-based merging.
- Model search (full-text `q=` parameter).
- Per-caller usage metrics.
- OpenRouter routing metadata (per-model provider variants).
- Benchmark data ingestion (Artificial Analysis, Chatbot Arena).
- Non-.NET SDKs (Node/TS first likely candidate).
- Historical pricing (requires Postgres and a migration plan).

## 13. Risks

| Risk | Mitigation |
|---|---|
| Upstream source changes its JSON shape and parser breaks | Fixtures + parser unit tests fail fast in CI on the next refresh; service keeps serving the prior snapshot; operator reviews. |
| Service outage takes down Clarive's provider-model sync | SDK's stale-cache fallback (§8) serves old data; Clarive's provider page still renders; sync is eventual. |
| Single point of failure (single container) | Acceptable for v1 given non-critical read path. Docker restart policy + Caddy health check cover process-level failures. Multi-instance is a v2 concern. |
| API key leaks into a consumer repo | Per-consumer keys (§7) enable targeted rotation without disrupting other consumers. |
| Drift between service DTOs and SDK DTOs | Linked-file compile sharing (§4.2) makes drift impossible. |
