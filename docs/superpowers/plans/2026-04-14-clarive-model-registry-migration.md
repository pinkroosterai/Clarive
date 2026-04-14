# Clarive Model-Registry Migration — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Clarive from its in-process `LiteLlmSyncJob` + `LiteLlmRegistryCache` to the external Model Registry service via the `Clarive.ModelRegistry.Client` NuGet SDK. Migration is feature-flagged, reversible, and only deletes the legacy code after a successful parallel-run in production.

**Architecture:** Introduce a thin `IModelRegistryLookup` adapter with the same shape `AiProviderService` consumes today (`TryGetModelInfoAsync`, `IsKnownNonChatModel`). Two implementations: `LegacyLiteLlmRegistryLookup` wraps the existing `LiteLlmRegistryCache`; `ModelRegistryServiceLookup` wraps `IModelCatalogClient`. DI picks between them on `ModelRegistry:Enabled`. `AiProviderService` is untouched.

**Tech Stack:** .NET 10, Clarive's existing 6-project layered solution, `Clarive.ModelRegistry.Client` 0.1.0+ from GitHub Packages, feature flag in `appsettings.json` + env.

**Prerequisites:** Plan A is complete — service deployed at `https://models.internal.clarive.app`, NuGet package `Clarive.ModelRegistry.Client` 0.1.0 published to `https://nuget.pkg.github.com/clarive/index.json`, and a Clarive-scoped API key exists in `deploy/.env.prod` as `MODEL_REGISTRY_API_KEY` with `MODEL_REGISTRY_URL` set.

**Reference spec:** `docs/superpowers/specs/2026-04-14-model-registry-service-design.md`, specifically §9.

---

## File Map

```
src/backend/
├── Clarive.Application/
│   ├── AiProviders/
│   │   ├── Contracts/IModelRegistryLookup.cs           (new)
│   │   └── Services/
│   │       ├── LegacyLiteLlmRegistryLookup.cs          (new, thin wrapper)
│   │       └── ModelRegistryServiceLookup.cs           (new, calls SDK)
│   ├── Background/
│   │   ├── LiteLlmSyncJob.cs                           (deleted in step 8)
│   │   └── ModelRegistrySyncJob.cs                     (new)
│   └── DependencyInjection.cs                          (modified)
├── Clarive.Application/AiProviders/Services/
│   └── AiProviderService.cs                            (1-line ctor swap)
├── Clarive.Api/
│   ├── Program.cs                                      (client + job wiring)
│   ├── data/litellm-model-prices.json                  (deleted in step 8)
│   └── nuget.config                                    (new, GHCR feed)
├── Clarive.Domain/Interfaces/Services/
│   └── ILiteLlmRegistryCache.cs                        (deleted in step 8)
└── Clarive.Application/AiProviders/Services/
    └── LiteLlmRegistryCache.cs                         (deleted in step 8)

tests/backend/
├── Clarive.Api.UnitTests/Services/
│   ├── LiteLlmRegistryCacheTests.cs                    (deleted in step 8)
│   └── ModelRegistryServiceLookupTests.cs              (new)
└── Clarive.Api.IntegrationTests/Tests/Super/
    └── AiProviderServiceRegistryPathTests.cs           (new)
```

---

## Task 1: Configure GitHub Packages NuGet feed

**Files:**
- Create: `src/backend/nuget.config`

- [ ] **Step 1: Write `nuget.config`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="github-clarive" value="https://nuget.pkg.github.com/clarive/index.json" />
  </packageSources>
  <packageSourceMapping>
    <packageSource key="nuget.org">
      <package pattern="*" />
    </packageSource>
    <packageSource key="github-clarive">
      <package pattern="Clarive.*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
```

- [ ] **Step 2: Authenticate locally for test restore**

```bash
dotnet nuget add source https://nuget.pkg.github.com/clarive/index.json \
  --name github-clarive \
  --username <your-gh-user> \
  --password <PAT with read:packages> \
  --store-password-in-clear-text
```

(CI uses `GITHUB_TOKEN` via `actions/setup-dotnet`; no committed credentials.)

- [ ] **Step 3: Add package version in `Directory.Packages.props`**

```xml
<PackageVersion Include="Clarive.ModelRegistry.Client" Version="0.1.*" />
```

- [ ] **Step 4: Reference from `Clarive.Application/Clarive.Application.csproj`**

```xml
<ItemGroup>
  <PackageReference Include="Clarive.ModelRegistry.Client" />
</ItemGroup>
```

- [ ] **Step 5: Restore + build to confirm package resolves**

```bash
dotnet restore src/backend/Clarive.Api.slnx
dotnet build src/backend/Clarive.Api.slnx
```

Expected: Build passes with no missing-package errors.

- [ ] **Step 6: Commit**

```bash
git add src/backend/nuget.config src/backend/Directory.Packages.props src/backend/Clarive.Application/Clarive.Application.csproj
git commit -m "chore(deps): add Clarive.ModelRegistry.Client NuGet package"
```

---

## Task 2: Introduce `IModelRegistryLookup` adapter interface

**Files:**
- Create: `src/backend/Clarive.Application/AiProviders/Contracts/IModelRegistryLookup.cs`

- [ ] **Step 1: Write the interface**

```csharp
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Application.AiProviders.Contracts;

public interface IModelRegistryLookup
{
    Task<LiteLlmModelInfo?> TryGetModelInfoAsync(string providerName, string modelId, CancellationToken ct = default);
    bool IsKnownNonChatModel(string providerName, string modelId);
}
```

The adapter reuses the existing `LiteLlmModelInfo` record from `Clarive.Domain.Interfaces.Services.ILiteLlmRegistryCache.cs` so the downstream call sites don't change shape.

- [ ] **Step 2: Register the namespace in `GlobalUsings.cs`** (per the backend's module convention)

Add to `src/backend/Clarive.Application/GlobalUsings.cs`:

```csharp
global using Clarive.Application.AiProviders.Contracts;
```

- [ ] **Step 3: Build + commit**

```bash
dotnet build src/backend/Clarive.Api.slnx
git add -A
git commit -m "feat(ai-providers): add IModelRegistryLookup adapter interface"
```

---

## Task 3: `LegacyLiteLlmRegistryLookup` wrapper

**Files:**
- Create: `src/backend/Clarive.Application/AiProviders/Services/LegacyLiteLlmRegistryLookup.cs`

- [ ] **Step 1: Write**

```csharp
using Clarive.Application.AiProviders.Contracts;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Application.AiProviders.Services;

public sealed class LegacyLiteLlmRegistryLookup(ILiteLlmRegistryCache cache) : IModelRegistryLookup
{
    public Task<LiteLlmModelInfo?> TryGetModelInfoAsync(string providerName, string modelId, CancellationToken ct = default) =>
        cache.TryGetModelInfoAsync(providerName, modelId, ct);

    public bool IsKnownNonChatModel(string providerName, string modelId) =>
        cache.IsKnownNonChatModel(providerName, modelId);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ai-providers): legacy registry lookup wrapper"
```

---

## Task 4: `ModelRegistryServiceLookup` (wraps SDK) with TDD

**Files:**
- Create: `tests/backend/Clarive.Api.UnitTests/Services/ModelRegistryServiceLookupTests.cs`
- Create: `src/backend/Clarive.Application/AiProviders/Services/ModelRegistryServiceLookup.cs`

- [ ] **Step 1: Write failing tests**

```csharp
using Clarive.Application.AiProviders.Services;
using Clarive.ModelRegistry.Client;
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class ModelRegistryServiceLookupTests
{
    [Fact]
    public async Task TryGetModelInfoAsync_MapsFromSdkDto()
    {
        var client = Substitute.For<IModelCatalogClient>();
        client.GetModelAsync("openai", "gpt-5", Arg.Any<CancellationToken>())
            .Returns(new ModelInfo(
                "openai/gpt-5", "openai", "gpt-5", "GPT-5",
                new Pricing(2.5m, 10m, null, null),
                new Context(400000, 128000),
                new Capabilities(false, true, true, null, null),
                Modality.Chat, new[] { "litellm" }, DateTimeOffset.UnixEpoch));
        var sut = new ModelRegistryServiceLookup(client);

        var info = await sut.TryGetModelInfoAsync("openai", "gpt-5");

        info.Should().NotBeNull();
        info!.InputCostPerMillion.Should().Be(2.5m);
        info.OutputCostPerMillion.Should().Be(10m);
        info.MaxInputTokens.Should().Be(400000);
        info.MaxOutputTokens.Should().Be(128000);
        info.IsReasoning.Should().BeFalse();
        info.SupportsFunctionCalling.Should().BeTrue();
        info.SupportsResponseSchema.Should().BeTrue();
    }

    [Fact]
    public async Task TryGetModelInfoAsync_ReturnsNullForMissingModel()
    {
        var client = Substitute.For<IModelCatalogClient>();
        client.GetModelAsync("openai", "nope", Arg.Any<CancellationToken>())
            .Returns((ModelInfo?)null);
        var sut = new ModelRegistryServiceLookup(client);

        (await sut.TryGetModelInfoAsync("openai", "nope")).Should().BeNull();
    }

    [Fact]
    public async Task IsKnownNonChatModel_ReflectsCachedModality()
    {
        var client = Substitute.For<IModelCatalogClient>();
        client.GetModelAsync("openai", "text-embedding-3-small", Arg.Any<CancellationToken>())
            .Returns(new ModelInfo(
                "openai/text-embedding-3-small", "openai", "text-embedding-3-small", null,
                null, null, new Capabilities(null, null, null, null, null),
                Modality.Embedding, new[] { "litellm" }, DateTimeOffset.UnixEpoch));
        var sut = new ModelRegistryServiceLookup(client);

        // Prime the cache via a TryGet
        await sut.TryGetModelInfoAsync("openai", "text-embedding-3-small");

        sut.IsKnownNonChatModel("openai", "text-embedding-3-small").Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run — expect FAIL (class missing)**

```bash
dotnet test tests/backend/Clarive.Api.UnitTests --filter ModelRegistryServiceLookupTests
```

- [ ] **Step 3: Implement**

```csharp
using System.Collections.Concurrent;
using Clarive.Application.AiProviders.Contracts;
using Clarive.Domain.Interfaces.Services;
using Clarive.ModelRegistry.Client;
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.Application.AiProviders.Services;

public sealed class ModelRegistryServiceLookup(IModelCatalogClient client) : IModelRegistryLookup
{
    private readonly ConcurrentDictionary<string, bool> _nonChatCache = new(StringComparer.OrdinalIgnoreCase);

    public async Task<LiteLlmModelInfo?> TryGetModelInfoAsync(string providerName, string modelId, CancellationToken ct = default)
    {
        var info = await client.GetModelAsync(providerName, modelId, ct);
        if (info is null) return null;

        _nonChatCache[$"{providerName.ToLowerInvariant()}/{modelId}"] = info.Modality != Modality.Chat;

        return new LiteLlmModelInfo(
            InputCostPerMillion: info.Pricing?.InputCostPerMillion,
            OutputCostPerMillion: info.Pricing?.OutputCostPerMillion,
            MaxInputTokens: info.Context?.MaxInputTokens,
            MaxOutputTokens: info.Context?.MaxOutputTokens,
            IsReasoning: info.Capabilities.IsReasoning,
            SupportsFunctionCalling: info.Capabilities.SupportsFunctionCalling,
            SupportsResponseSchema: info.Capabilities.SupportsResponseSchema);
    }

    public bool IsKnownNonChatModel(string providerName, string modelId) =>
        _nonChatCache.TryGetValue($"{providerName.ToLowerInvariant()}/{modelId}", out var nonChat) && nonChat;
}
```

- [ ] **Step 4: Run + commit**

```bash
dotnet test tests/backend/Clarive.Api.UnitTests --filter ModelRegistryServiceLookupTests
git add -A
git commit -m "feat(ai-providers): registry service lookup with modality cache"
```

---

## Task 5: Swap `AiProviderService` dependency to `IModelRegistryLookup`

**Files:**
- Modify: `src/backend/Clarive.Application/AiProviders/Services/AiProviderService.cs` (constructor + three call sites at lines 181, 184, 285 per current snapshot)

- [ ] **Step 1: Update constructor parameter**

Find the constructor and change:

```csharp
ILiteLlmRegistryCache liteLlmCache,
```

to:

```csharp
IModelRegistryLookup registry,
```

and rename all references in the file from `liteLlmCache` to `registry`. There are three call sites:

```csharp
if (registry.IsKnownNonChatModel(provider.Name, m.Id))
...
var info = await registry.TryGetModelInfoAsync(provider.Name, m.Id, ct);
...
var info = await registry.TryGetModelInfoAsync(provider.Name, request.ModelId, ct);
```

- [ ] **Step 2: Build + run existing AiProvider tests**

```bash
dotnet build src/backend/Clarive.Api.slnx
dotnet test tests/backend/Clarive.Api.UnitTests --filter AiProvider
dotnet test tests/backend/Clarive.Api.IntegrationTests --filter AiProvider
```

Expected: PASS (the tests don't care which backing implementation is registered).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(ai-providers): use IModelRegistryLookup abstraction in AiProviderService"
```

---

## Task 6: Wire feature flag + conditional DI

**Files:**
- Modify: `src/backend/Clarive.Application/DependencyInjection.cs`
- Modify: `src/backend/Clarive.Api/Program.cs`
- Modify: `src/backend/Clarive.Api/appsettings.json`

- [ ] **Step 1: Extend `appsettings.json`**

Add a top-level block:

```json
"ModelRegistry": {
  "Enabled": false,
  "BaseUrl": "https://models.internal.clarive.app",
  "ApiKey": "",
  "CacheTtl": "01:00:00",
  "RequestTimeout": "00:00:10"
}
```

- [ ] **Step 2: Modify `DependencyInjection.cs` — replace the line registering `ILiteLlmRegistryCache` with a conditional block**

Find:

```csharp
services.AddSingleton<ILiteLlmRegistryCache, LiteLlmRegistryCache>();
```

Replace with:

```csharp
services.AddSingleton<ILiteLlmRegistryCache, LiteLlmRegistryCache>();

var useNewRegistry = configuration.GetValue("ModelRegistry:Enabled", defaultValue: false);
if (useNewRegistry)
{
    services.AddScoped<IModelRegistryLookup, ModelRegistryServiceLookup>();
}
else
{
    services.AddScoped<IModelRegistryLookup, LegacyLiteLlmRegistryLookup>();
}
```

`DependencyInjection.cs` already receives `IConfiguration`; if not, thread it through the existing `AddApplication(IServiceCollection, IConfiguration)` extension signature.

- [ ] **Step 3: In `Program.cs`, register the client SDK when enabled**

Insert before `builder.Services.AddApplication(builder.Configuration)`:

```csharp
if (builder.Configuration.GetValue("ModelRegistry:Enabled", false))
{
    builder.Services.AddModelCatalogClient(opts =>
    {
        opts.BaseUrl = builder.Configuration["ModelRegistry:BaseUrl"]!;
        opts.ApiKey = builder.Configuration["ModelRegistry:ApiKey"]!;
        if (TimeSpan.TryParse(builder.Configuration["ModelRegistry:CacheTtl"], out var ttl))
            opts.CacheTtl = ttl;
        if (TimeSpan.TryParse(builder.Configuration["ModelRegistry:RequestTimeout"], out var rt))
            opts.RequestTimeout = rt;
    });
}
```

Import `using Clarive.ModelRegistry.Client;` at the top of `Program.cs`.

- [ ] **Step 4: Build + run the full unit test suite**

```bash
dotnet build src/backend/Clarive.Api.slnx
dotnet test src/backend/Clarive.Api.slnx
```

Expected: ALL PASS (flag defaults to off; legacy path remains active).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ai-providers): add ModelRegistry feature flag with conditional DI"
```

---

## Task 7: Add `ModelRegistrySyncJob` (replacement for `LiteLlmSyncJob` under the flag)

**Files:**
- Create: `src/backend/Clarive.Application/Background/ModelRegistrySyncJob.cs`
- Modify: `src/backend/Clarive.Api/Program.cs` (Quartz registration)

- [ ] **Step 1: Implement the new job**

```csharp
using Clarive.Application.AiProviders.Contracts;
using Clarive.Domain.Interfaces.Repositories;
using Quartz;

namespace Clarive.Application.Background;

[DisallowConcurrentExecution]
public sealed class ModelRegistrySyncJob(
    IModelRegistryLookup registry,
    IAiProviderRepository providerRepo,
    ILogger<ModelRegistrySyncJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var providers = await providerRepo.GetAllAsync(ct);
        var updated = 0;

        foreach (var provider in providers)
        {
            foreach (var model in provider.Models)
            {
                var info = await registry.TryGetModelInfoAsync(provider.Name, model.ModelId, ct);
                if (info is null) continue;

                var changed = false;

                if (info.IsReasoning is not null && model.IsReasoning != info.IsReasoning.Value)
                { model.IsReasoning = info.IsReasoning.Value; changed = true; }
                if (info.SupportsFunctionCalling is not null && model.SupportsFunctionCalling != info.SupportsFunctionCalling.Value)
                { model.SupportsFunctionCalling = info.SupportsFunctionCalling.Value; changed = true; }
                if (info.SupportsResponseSchema is not null && model.SupportsResponseSchema != info.SupportsResponseSchema.Value)
                { model.SupportsResponseSchema = info.SupportsResponseSchema.Value; changed = true; }

                if (!model.HasManualCostOverride && !provider.UseProviderPricing)
                {
                    if (info.InputCostPerMillion is not null && model.InputCostPerMillion != info.InputCostPerMillion)
                    { model.InputCostPerMillion = info.InputCostPerMillion; changed = true; }
                    if (info.OutputCostPerMillion is not null && model.OutputCostPerMillion != info.OutputCostPerMillion)
                    { model.OutputCostPerMillion = info.OutputCostPerMillion; changed = true; }
                    if (info.MaxInputTokens is not null && model.MaxInputTokens != info.MaxInputTokens)
                    { model.MaxInputTokens = info.MaxInputTokens; changed = true; }
                    if (info.MaxOutputTokens is not null && model.MaxOutputTokens != info.MaxOutputTokens)
                    { model.MaxOutputTokens = info.MaxOutputTokens; changed = true; }
                }

                if (changed)
                {
                    await providerRepo.UpdateModelAsync(model, ct);
                    updated++;
                }
            }
        }

        if (updated > 0)
            logger.LogInformation("Synced {Count} models from model registry", updated);
    }
}
```

- [ ] **Step 2: Gate Quartz registration by the feature flag in `Program.cs`**

Find the existing Quartz block that registers `LiteLlmSyncJob` and replace with:

```csharp
builder.Services.AddQuartz(q =>
{
    if (builder.Configuration.GetValue("ModelRegistry:Enabled", false))
    {
        var key = new JobKey(nameof(ModelRegistrySyncJob));
        q.AddJob<ModelRegistrySyncJob>(o => o.WithIdentity(key));
        q.AddTrigger(t => t.ForJob(key).WithIdentity($"{key.Name}-startup").StartNow());
        q.AddTrigger(t => t.ForJob(key).WithIdentity($"{key.Name}-daily")
            .WithCronSchedule("0 30 1 * * ?")); // 01:30 UTC — offset vs registry's 01:00 fetch
    }
    else
    {
        var key = new JobKey(nameof(LiteLlmSyncJob));
        q.AddJob<LiteLlmSyncJob>(o => o.WithIdentity(key));
        q.AddTrigger(t => t.ForJob(key).WithIdentity($"{key.Name}-startup").StartNow());
        q.AddTrigger(t => t.ForJob(key).WithIdentity($"{key.Name}-daily")
            .WithCronSchedule("0 0 1 * * ?"));
    }
});
```

Import `using Clarive.Application.Background;` at top of `Program.cs` if not already present.

- [ ] **Step 3: Build + run full test suite**

```bash
dotnet test src/backend/Clarive.Api.slnx
```

Expected: PASS. (With flag off, legacy job still runs; with flag on, new job runs against the service.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(background): add ModelRegistrySyncJob behind feature flag"
```

---

## Task 8: Integration test — full `AiProviderService` path under the flag

**Files:**
- Create: `tests/backend/Clarive.Api.IntegrationTests/Tests/Super/AiProviderServiceRegistryPathTests.cs`

- [ ] **Step 1: Write the test**

```csharp
using System.Net.Http.Json;
using Clarive.Application.AiProviders.Contracts;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;

namespace Clarive.Api.IntegrationTests.Tests.Super;

public class AiProviderServiceRegistryPathTests : BaseIntegrationTest
{
    public AiProviderServiceRegistryPathTests(IntegrationTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Sync_WithFlagEnabled_PullsFromRegistryStub()
    {
        var registry = Substitute.For<IModelRegistryLookup>();
        registry.TryGetModelInfoAsync("openai", "gpt-5", Arg.Any<CancellationToken>())
            .Returns(new LiteLlmModelInfo(2.5m, 10m, 400000, 128000, false, true, true));

        using var factory = Factory.WithWebHostBuilder(b =>
        {
            b.ConfigureTestServices(s =>
            {
                s.RemoveAll<IModelRegistryLookup>();
                s.AddSingleton(registry);
            });
        });

        // Exercise the normal "sync models" endpoint for a seeded OpenAI provider.
        // See existing AiProviderTests for the setup harness.
        var client = factory.CreateAdminClient();
        var resp = await client.PostAsync($"/api/super/ai-providers/{SeededProviderId}/sync-models", null);
        resp.EnsureSuccessStatusCode();

        await registry.Received().TryGetModelInfoAsync("openai", Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
```

(If `CreateAdminClient` and `SeededProviderId` don't match the existing integration test harness in this repo, copy the setup boilerplate from `tests/backend/Clarive.Api.IntegrationTests/Tests/Super/AiProviderTests.cs`. The point of this test is that the flag path is exercised end-to-end, not to re-test provider-service logic.)

- [ ] **Step 2: Run + commit**

```bash
dotnet test tests/backend/Clarive.Api.IntegrationTests --filter AiProviderServiceRegistryPathTests
git add -A
git commit -m "test(integration): exercise IModelRegistryLookup path end-to-end"
```

---

## Task 9: Enable the flag on `demo-dev` and parallel-run check

**Files:**
- Modify: `deploy/.env.demo-dev` (local-only, not committed)

- [ ] **Step 1: Add env vars**

```
ModelRegistry__Enabled=true
ModelRegistry__BaseUrl=https://models.internal.clarive.app
ModelRegistry__ApiKey=<demo-dev key issued by Plan A>
```

- [ ] **Step 2: Capture baseline from demo-dev before flipping**

```bash
./deploy/demo-dev.sh shell
psql -U clarive -d clarive -c \
  "COPY (SELECT provider_id, model_id, input_cost_per_million, output_cost_per_million,
         max_input_tokens, max_output_tokens, is_reasoning, supports_function_calling,
         supports_response_schema FROM ai_provider_model ORDER BY provider_id, model_id)
   TO STDOUT WITH CSV HEADER" > /tmp/models-before.csv
```

- [ ] **Step 3: Deploy with the flag on**

```bash
./deploy/demo-dev.sh deploy
./deploy/demo-dev.sh logs | grep -E "(ModelRegistry|model registry|Sync)"
```

Expected: a `ModelRegistrySyncJob` fires on startup and logs `Synced N models from model registry`. `LiteLlmSyncJob` does NOT fire.

- [ ] **Step 4: Capture post-flip baseline and diff**

```bash
./deploy/demo-dev.sh shell
psql -U clarive -d clarive -c \
  "COPY (SELECT ...same query...) TO STDOUT WITH CSV HEADER" > /tmp/models-after.csv
diff /tmp/models-before.csv /tmp/models-after.csv
```

Expected: Identical rows, or minor differences limited to newly-added capability flags or marginally-updated prices (service vs. old registry). Document any differences before proceeding.

- [ ] **Step 5: Spot-check the UI**

Open demo-dev.clarive.app → Super Admin → AI Providers → an OpenAI provider → trigger "Sync models" in the UI. Verify the model list still renders and pricing still displays.

- [ ] **Step 6: Let it run for 48 hours minimum**

No commit for this step. Monitor logs, metrics, and user reports. If anything breaks, flip `ModelRegistry__Enabled=false` and redeploy — the legacy path is still intact.

---

## Task 10: Flip production

**Files:**
- Modify: `deploy/.env.prod` (local-only)

- [ ] **Step 1: Add env vars to `.env.prod`**

```
ModelRegistry__Enabled=true
ModelRegistry__BaseUrl=https://models.internal.clarive.app
ModelRegistry__ApiKey=<prod key issued by Plan A>
```

- [ ] **Step 2: Capture baseline as in Task 9 Step 2**

Snapshot `ai_provider_model` to `/tmp/models-before-prod.csv` before deploying.

- [ ] **Step 3: Deploy**

```bash
make deploy
make logs | grep -E "(ModelRegistry|Sync)"
```

- [ ] **Step 4: Post-flip diff**

Same snapshot + diff as demo-dev.

- [ ] **Step 5: Monitor for one week**

Watch:
- Log volume from `ModelRegistrySyncJob`
- Registry `/v1/meta.healthy`
- Any user reports about missing / incorrect model metadata

No commit for this step.

---

## Task 11: Delete legacy code

**Files:**
- Delete: `src/backend/Clarive.Application/Background/LiteLlmSyncJob.cs`
- Delete: `src/backend/Clarive.Application/AiProviders/Services/LiteLlmRegistryCache.cs`
- Delete: `src/backend/Clarive.Domain/Interfaces/Services/ILiteLlmRegistryCache.cs`
- Delete: `src/backend/Clarive.Api/data/litellm-model-prices.json`
- Delete: `tests/backend/Clarive.Api.UnitTests/Services/LiteLlmRegistryCacheTests.cs`
- Modify: `src/backend/Clarive.Application/AiProviders/Services/LegacyLiteLlmRegistryLookup.cs` (delete)
- Modify: `src/backend/Clarive.Application/DependencyInjection.cs` (drop the conditional and register only `ModelRegistryServiceLookup`)
- Modify: `src/backend/Clarive.Api/Program.cs` (drop the flag check and register only the new job)
- Modify: `src/backend/Clarive.Api/appsettings.json` (remove `ModelRegistry:Enabled`; keep `BaseUrl`, `ApiKey`, `CacheTtl`, `RequestTimeout` as required settings)
- Modify: `LiteLlmModelInfo` record — move it to `Clarive.Application/AiProviders/Contracts/RegistryModelInfo.cs` and rename to `RegistryModelInfo`, updating `IModelRegistryLookup` + `ModelRegistryServiceLookup` references.

- [ ] **Step 1: Delete files**

```bash
rm src/backend/Clarive.Application/Background/LiteLlmSyncJob.cs
rm src/backend/Clarive.Application/AiProviders/Services/LiteLlmRegistryCache.cs
rm src/backend/Clarive.Application/AiProviders/Services/LegacyLiteLlmRegistryLookup.cs
rm src/backend/Clarive.Domain/Interfaces/Services/ILiteLlmRegistryCache.cs
rm src/backend/Clarive.Api/data/litellm-model-prices.json
rm tests/backend/Clarive.Api.UnitTests/Services/LiteLlmRegistryCacheTests.cs
```

- [ ] **Step 2: Move + rename `LiteLlmModelInfo`**

Create `src/backend/Clarive.Application/AiProviders/Contracts/RegistryModelInfo.cs`:

```csharp
namespace Clarive.Application.AiProviders.Contracts;

public sealed record RegistryModelInfo(
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion,
    long? MaxInputTokens,
    long? MaxOutputTokens,
    bool? IsReasoning,
    bool? SupportsFunctionCalling,
    bool? SupportsResponseSchema);
```

Rename `LiteLlmModelInfo` → `RegistryModelInfo` across:
- `IModelRegistryLookup.cs`
- `ModelRegistryServiceLookup.cs`
- `ModelRegistrySyncJob.cs`
- `ModelRegistryServiceLookupTests.cs`
- `AiProviderServiceRegistryPathTests.cs`

Use your IDE's symbol rename, or sed:

```bash
grep -rl "LiteLlmModelInfo" src tests | xargs sed -i 's/LiteLlmModelInfo/RegistryModelInfo/g'
```

- [ ] **Step 3: Remove the conditional DI block in `DependencyInjection.cs`**

The block from Task 6 becomes:

```csharp
services.AddScoped<IModelRegistryLookup, ModelRegistryServiceLookup>();
```

- [ ] **Step 4: Remove the conditional Quartz block in `Program.cs`**

Becomes:

```csharp
builder.Services.AddQuartz(q =>
{
    var key = new JobKey(nameof(ModelRegistrySyncJob));
    q.AddJob<ModelRegistrySyncJob>(o => o.WithIdentity(key));
    q.AddTrigger(t => t.ForJob(key).WithIdentity($"{key.Name}-startup").StartNow());
    q.AddTrigger(t => t.ForJob(key).WithIdentity($"{key.Name}-daily")
        .WithCronSchedule("0 30 1 * * ?"));
});
```

Also remove the `AddModelCatalogClient` `if (flag)` wrapper so registration is unconditional.

- [ ] **Step 5: Trim `appsettings.json`**

```json
"ModelRegistry": {
  "BaseUrl": "https://models.internal.clarive.app",
  "ApiKey": "",
  "CacheTtl": "01:00:00",
  "RequestTimeout": "00:00:10"
}
```

- [ ] **Step 6: Remove `ModelRegistry__Enabled` from `deploy/.env.demo-dev` and `deploy/.env.prod`**

Keep only `ModelRegistry__BaseUrl` and `ModelRegistry__ApiKey`.

- [ ] **Step 7: Build + full test suite**

```bash
dotnet build src/backend/Clarive.Api.slnx
dotnet test src/backend/Clarive.Api.slnx
```

Expected: PASS. Zero references to `LiteLlmRegistryCache`, `ILiteLlmRegistryCache`, `LiteLlmSyncJob`, or `LiteLlmModelInfo` anywhere in the repo.

- [ ] **Step 8: Verify no stragglers**

```bash
! grep -r "LiteLlmRegistryCache\|LiteLlmSyncJob\|LiteLlmModelInfo\|LegacyLiteLlmRegistryLookup" src tests
```

Expected: no output; command exits 0.

- [ ] **Step 9: Commit (single atomic PR)**

```bash
git add -A
git commit -m "refactor(ai-providers): delete legacy litellm registry cache and sync job"
```

---

## Self-Review

Spec coverage for §9 of the design spec:

| Spec item | Covered by |
|---|---|
| §9.1 Remove `LiteLlmSyncJob` | Task 11 |
| §9.1 Remove `LiteLlmRegistryCache` + interface | Task 11 |
| §9.1 Remove `LiteLlmRegistryCacheTests` | Task 11 |
| §9.1 Remove bundled JSON | Task 11 |
| §9.2 Add NuGet reference | Task 1 |
| §9.2 `AddModelCatalogClient` registration | Task 6 |
| §9.2 `ModelRegistryLookup` adapter | Tasks 2, 4 |
| §9.2 `AiProviderService` unchanged (1-line ctor swap) | Task 5 |
| §9.2 New `ModelRegistrySyncJob` | Task 7 |
| §9.3 OpenRouter runtime path preserved | Implicit — `AiProviderService.SyncModelsAsync`'s OpenRouter code is untouched in this plan; only `TryGetModelInfoAsync` / `IsKnownNonChatModel` call sites are affected |
| §9.4 Feature-flagged migration order | Tasks 6, 9, 10, 11 |

Placeholder scan: the `AiProviderServiceRegistryPathTests` in Task 8 contains a conditional copy-from-existing-harness note (`CreateAdminClient`, `SeededProviderId`). That's not a placeholder in code — it's a directive for the implementer to match the integration-test conventions in `AiProviderTests.cs`, because the test harness setup (admin authentication, provider seeding) is already well-documented in that file and duplicating its several dozen lines of setup here would violate DRY.

Type consistency: `IModelRegistryLookup`, `LegacyLiteLlmRegistryLookup`, `ModelRegistryServiceLookup`, `ModelRegistrySyncJob`, `LiteLlmModelInfo` (then `RegistryModelInfo` post-Task-11) — consistent across tasks. The rename to `RegistryModelInfo` is deferred to Task 11 because renaming mid-migration would force changes to code that's about to be deleted anyway.

The plan does not touch the Frontend; there is no UI surface that reads LiteLLM-specific data paths. All consumption happens through `AiProviderService`, whose API contract is preserved.
