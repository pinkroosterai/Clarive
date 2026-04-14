# Model Registry Service — Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `clarive-model-registry` internal microservice and `Clarive.ModelRegistry.Client` NuGet SDK, wired to LiteLLM + OpenRouter + models.dev, deployed behind Caddy, ready for Clarive to consume.

**Architecture:** Stateless .NET 10 Minimal API that fetches pricing/capability data from three upstream sources, merges them using a per-field priority resolver, and serves a normalized catalog over REST. In-memory snapshot with a crash-safe JSON file as warm-boot cache. Paired client SDK with `IDistributedCache` + Polly + stale-cache fallback.

**Tech Stack:** .NET 10, ASP.NET Core Minimal APIs, Quartz.NET, Polly 8, Serilog, xUnit, `WebApplicationFactory`, CSharpier, Meziantou + SonarAnalyzer + Roslynator analyzers, Docker, GitHub Actions, GitHub Packages for NuGet distribution.

**Reference spec:** `docs/superpowers/specs/2026-04-14-model-registry-service-design.md`

**Repo location:** This plan is executed in a **new private GitHub repo** `clarive-model-registry`, not inside Clarive. Clone it to `~/clarive-model-registry` and work there. The Clarive worktree is only used for reading the spec and filing this plan.

---

## File Map

```
clarive-model-registry/
├── src/
│   ├── Clarive.ModelRegistry.Service/
│   │   ├── Auth/
│   │   │   └── ApiKeyMiddleware.cs
│   │   ├── Sources/
│   │   │   ├── ISource.cs
│   │   │   ├── SourceSnapshot.cs
│   │   │   ├── LiteLlmSource.cs
│   │   │   ├── LiteLlmNormalizer.cs
│   │   │   ├── OpenRouterSource.cs
│   │   │   ├── OpenRouterNormalizer.cs
│   │   │   ├── ModelsDevSource.cs
│   │   │   └── ModelsDevNormalizer.cs
│   │   ├── Aliases/
│   │   │   ├── AliasResolver.cs
│   │   │   └── alias-map.json
│   │   ├── Merging/
│   │   │   ├── PriorityMerger.cs
│   │   │   └── MergeOptions.cs
│   │   ├── Catalog/
│   │   │   ├── NormalizedSnapshot.cs
│   │   │   ├── SnapshotStore.cs
│   │   │   └── CatalogQuery.cs
│   │   ├── Jobs/
│   │   │   ├── SyncPipeline.cs
│   │   │   └── SyncJob.cs
│   │   ├── Endpoints/
│   │   │   ├── ModelEndpoints.cs
│   │   │   ├── SourceEndpoints.cs
│   │   │   ├── MetaEndpoints.cs
│   │   │   └── RefreshEndpoints.cs
│   │   ├── Metrics/
│   │   │   └── MetricsRegistry.cs
│   │   ├── appsettings.json
│   │   ├── Program.cs
│   │   └── Clarive.ModelRegistry.Service.csproj
│   └── Clarive.ModelRegistry.Client/
│       ├── Dtos/
│       │   ├── ModelInfo.cs
│       │   ├── Pricing.cs
│       │   ├── Context.cs
│       │   ├── Capabilities.cs
│       │   ├── Modality.cs
│       │   ├── CatalogMeta.cs
│       │   └── ModelQuery.cs
│       ├── IModelCatalogClient.cs
│       ├── ModelCatalogClient.cs
│       ├── ApiKeyHandler.cs
│       ├── ModelCatalogClientOptions.cs
│       ├── ServiceCollectionExtensions.cs
│       └── Clarive.ModelRegistry.Client.csproj
├── tests/
│   ├── Clarive.ModelRegistry.Service.Tests/
│   │   ├── Fixtures/{litellm,openrouter,modelsdev}/sample.json
│   │   ├── Sources/{LiteLlmNormalizerTests,OpenRouterNormalizerTests,ModelsDevNormalizerTests}.cs
│   │   ├── Aliases/AliasResolverTests.cs
│   │   ├── Merging/PriorityMergerTests.cs
│   │   └── Catalog/SnapshotStoreTests.cs
│   ├── Clarive.ModelRegistry.Service.IntegrationTests/
│   │   ├── Fakes/FakeSource.cs
│   │   ├── TestAppFactory.cs
│   │   ├── ModelEndpointsTests.cs
│   │   ├── AuthTests.cs
│   │   ├── RefreshEndpointTests.cs
│   │   └── ColdStartTests.cs
│   └── Clarive.ModelRegistry.Client.Tests/
│       ├── ModelCatalogClientTests.cs
│       └── StaleCacheFallbackTests.cs
├── deploy/
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/
│   └── refresh-fixtures.ps1
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── Directory.Packages.props
├── Directory.Build.props
├── .editorconfig
├── .csharpierrc.json
├── .gitignore
├── global.json
└── ModelRegistry.slnx
```

---

## Task 1: Initialize repo + solution scaffolding

**Files:**
- Create: `~/clarive-model-registry/` (new repo root)
- Create: `global.json`, `ModelRegistry.slnx`, `Directory.Build.props`, `Directory.Packages.props`, `.editorconfig`, `.csharpierrc.json`, `.gitignore`

- [ ] **Step 1: Create repo + private GitHub**

```bash
gh repo create clarive-model-registry --private --clone --confirm
cd clarive-model-registry
```

- [ ] **Step 2: Write `global.json`**

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestMinor",
    "allowPrerelease": false
  }
}
```

- [ ] **Step 3: Write `Directory.Build.props`**

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisMode>All</AnalysisMode>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Meziantou.Analyzer" PrivateAssets="all" />
    <PackageReference Include="SonarAnalyzer.CSharp" PrivateAssets="all" />
    <PackageReference Include="Roslynator.Analyzers" PrivateAssets="all" />
  </ItemGroup>
</Project>
```

- [ ] **Step 4: Write `Directory.Packages.props`**

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.*" />
    <PackageVersion Include="Microsoft.Extensions.Http" Version="10.0.*" />
    <PackageVersion Include="Microsoft.Extensions.Http.Polly" Version="10.0.*" />
    <PackageVersion Include="Microsoft.Extensions.Caching.Abstractions" Version="10.0.*" />
    <PackageVersion Include="Microsoft.Extensions.Caching.Memory" Version="10.0.*" />
    <PackageVersion Include="Polly" Version="8.*" />
    <PackageVersion Include="Quartz" Version="3.*" />
    <PackageVersion Include="Quartz.Extensions.Hosting" Version="3.*" />
    <PackageVersion Include="Serilog.AspNetCore" Version="8.*" />
    <PackageVersion Include="Swashbuckle.AspNetCore" Version="7.*" />
    <PackageVersion Include="prometheus-net.AspNetCore" Version="8.*" />

    <PackageVersion Include="Meziantou.Analyzer" Version="2.*" />
    <PackageVersion Include="SonarAnalyzer.CSharp" Version="10.*" />
    <PackageVersion Include="Roslynator.Analyzers" Version="4.*" />

    <PackageVersion Include="xunit" Version="2.*" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="2.*" />
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.*" />
    <PackageVersion Include="FluentAssertions" Version="6.*" />
    <PackageVersion Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.*" />
    <PackageVersion Include="RichardSzalay.MockHttp" Version="7.*" />
  </ItemGroup>
</Project>
```

- [ ] **Step 5: Write `.csharpierrc.json`**

```json
{ "printWidth": 100, "useTabs": false, "tabWidth": 4, "endOfLine": "lf" }
```

- [ ] **Step 6: Write `.editorconfig`**

```ini
root = true
[*.cs]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
dotnet_diagnostic.CA2007.severity = none
dotnet_diagnostic.S1075.severity = none
```

- [ ] **Step 7: Write `.gitignore`**

```
bin/
obj/
.vs/
*.user
.idea/
data/
TestResults/
```

- [ ] **Step 8: Create empty solution file `ModelRegistry.slnx`**

```xml
<Solution>
  <Folder Name="/src/">
  </Folder>
  <Folder Name="/tests/">
  </Folder>
</Solution>
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize solution scaffolding"
```

---

## Task 2: Scaffold the five projects

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Clarive.ModelRegistry.Service.csproj`
- Create: `src/Clarive.ModelRegistry.Client/Clarive.ModelRegistry.Client.csproj`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Clarive.ModelRegistry.Service.Tests.csproj`
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/Clarive.ModelRegistry.Service.IntegrationTests.csproj`
- Create: `tests/Clarive.ModelRegistry.Client.Tests/Clarive.ModelRegistry.Client.Tests.csproj`

- [ ] **Step 1: Write Service csproj**

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" />
    <PackageReference Include="Microsoft.Extensions.Http" />
    <PackageReference Include="Microsoft.Extensions.Http.Polly" />
    <PackageReference Include="Microsoft.Extensions.Caching.Memory" />
    <PackageReference Include="Polly" />
    <PackageReference Include="Quartz" />
    <PackageReference Include="Quartz.Extensions.Hosting" />
    <PackageReference Include="Serilog.AspNetCore" />
    <PackageReference Include="Swashbuckle.AspNetCore" />
    <PackageReference Include="prometheus-net.AspNetCore" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Clarive.ModelRegistry.Client\Clarive.ModelRegistry.Client.csproj" />
  </ItemGroup>
  <ItemGroup>
    <Content Include="Aliases\alias-map.json" CopyToOutputDirectory="Always" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Write Client csproj**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>true</IsPackable>
    <PackageId>Clarive.ModelRegistry.Client</PackageId>
    <Authors>pinkroosterai</Authors>
    <Description>Typed .NET client for the Clarive Model Registry service.</Description>
    <RepositoryUrl>https://github.com/pinkroosterai/clarive-model-registry</RepositoryUrl>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <Version>0.1.0</Version>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Http" />
    <PackageReference Include="Microsoft.Extensions.Http.Polly" />
    <PackageReference Include="Microsoft.Extensions.Caching.Abstractions" />
    <PackageReference Include="Polly" />
  </ItemGroup>
</Project>
```

- [ ] **Step 3: Write three test csproj files**

Each test project's csproj (same shape for all three — swap in the right project reference):

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="xunit" />
    <PackageReference Include="xunit.runner.visualstudio" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="FluentAssertions" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\src\Clarive.ModelRegistry.Service\Clarive.ModelRegistry.Service.csproj" />
  </ItemGroup>
</Project>
```

For `Service.IntegrationTests` additionally add `<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" />` and reference the Service project.
For `Client.Tests` reference only the Client project and add `<PackageReference Include="RichardSzalay.MockHttp" />`.

- [ ] **Step 4: Register projects in `ModelRegistry.slnx`**

```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="src/Clarive.ModelRegistry.Service/Clarive.ModelRegistry.Service.csproj" />
    <Project Path="src/Clarive.ModelRegistry.Client/Clarive.ModelRegistry.Client.csproj" />
  </Folder>
  <Folder Name="/tests/">
    <Project Path="tests/Clarive.ModelRegistry.Service.Tests/Clarive.ModelRegistry.Service.Tests.csproj" />
    <Project Path="tests/Clarive.ModelRegistry.Service.IntegrationTests/Clarive.ModelRegistry.Service.IntegrationTests.csproj" />
    <Project Path="tests/Clarive.ModelRegistry.Client.Tests/Clarive.ModelRegistry.Client.Tests.csproj" />
  </Folder>
</Solution>
```

- [ ] **Step 5: Write a minimal Program.cs so Service builds**

`src/Clarive.ModelRegistry.Service/Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/", () => "clarive-model-registry");
app.Run();

public partial class Program;
```

- [ ] **Step 6: Write a minimal appsettings.json**

`src/Clarive.ModelRegistry.Service/appsettings.json`:

```json
{
  "Logging": { "LogLevel": { "Default": "Information" } },
  "AllowedHosts": "*"
}
```

- [ ] **Step 7: Restore + build**

```bash
dotnet restore ModelRegistry.slnx
dotnet build ModelRegistry.slnx
```

Expected: Build succeeds, 0 errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold service, client, and three test projects"
```

---

## Task 3: Define canonical DTOs in Client

**Files:**
- Create: `src/Clarive.ModelRegistry.Client/Dtos/Modality.cs`
- Create: `src/Clarive.ModelRegistry.Client/Dtos/Pricing.cs`
- Create: `src/Clarive.ModelRegistry.Client/Dtos/Context.cs`
- Create: `src/Clarive.ModelRegistry.Client/Dtos/Capabilities.cs`
- Create: `src/Clarive.ModelRegistry.Client/Dtos/ModelInfo.cs`
- Create: `src/Clarive.ModelRegistry.Client/Dtos/ModelQuery.cs`
- Create: `src/Clarive.ModelRegistry.Client/Dtos/CatalogMeta.cs`

- [ ] **Step 1: Write `Modality.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

public enum Modality { Chat, Embedding, Image, Audio, Other }
```

- [ ] **Step 2: Write `Pricing.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

public sealed record Pricing(
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion,
    decimal? CachedInputCostPerMillion,
    decimal? ReasoningOutputCostPerMillion,
    string Currency = "USD");
```

- [ ] **Step 3: Write `Context.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

public sealed record Context(long? MaxInputTokens, long? MaxOutputTokens);
```

- [ ] **Step 4: Write `Capabilities.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

public sealed record Capabilities(
    bool? IsReasoning,
    bool? SupportsFunctionCalling,
    bool? SupportsResponseSchema,
    bool? SupportsVision,
    bool? SupportsAudioInput);
```

- [ ] **Step 5: Write `ModelInfo.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

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
```

- [ ] **Step 6: Write `ModelQuery.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

public sealed record ModelQuery(
    string? Provider = null,
    Modality? Modality = null,
    bool? IsReasoning = null,
    bool? SupportsFunctionCalling = null);
```

- [ ] **Step 7: Write `CatalogMeta.cs`**

```csharp
namespace Clarive.ModelRegistry.Client.Dtos;

public sealed record CatalogMeta(
    DateTimeOffset SnapshotAt,
    TimeSpan Staleness,
    IReadOnlyList<SourceState> SourceStates,
    bool Healthy);

public sealed record SourceState(
    string Source,
    DateTimeOffset? LastSuccess,
    string? LastError);
```

- [ ] **Step 8: Build + commit**

```bash
dotnet build ModelRegistry.slnx
git add -A
git commit -m "feat(client): define canonical DTOs"
```

---

## Task 4: LiteLLM normalizer (TDD)

**Files:**
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Fixtures/litellm/sample.json`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Sources/LiteLlmNormalizerTests.cs`
- Create: `src/Clarive.ModelRegistry.Service/Sources/SourceSnapshot.cs`
- Create: `src/Clarive.ModelRegistry.Service/Sources/LiteLlmNormalizer.cs`

- [ ] **Step 1: Create `SourceSnapshot.cs`**

```csharp
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.ModelRegistry.Service.Sources;

public sealed record SourceSnapshot(
    string SourceName,
    DateTimeOffset FetchedAt,
    IReadOnlyList<ModelInfo> Models);
```

- [ ] **Step 2: Create fixture `sample.json`**

Mark as copy-to-output in the test csproj by adding to `tests/Clarive.ModelRegistry.Service.Tests/Clarive.ModelRegistry.Service.Tests.csproj`:

```xml
<ItemGroup>
  <None Update="Fixtures\**\*.json">
    <CopyToOutputDirectory>Always</CopyToOutputDirectory>
  </None>
</ItemGroup>
```

File content (minimal but exercises every parsed field):

```json
{
  "gpt-5": {
    "max_input_tokens": 400000,
    "max_output_tokens": 128000,
    "input_cost_per_token": 0.0000025,
    "output_cost_per_token": 0.00001,
    "mode": "chat",
    "supports_function_calling": true,
    "supports_response_schema": true,
    "supports_reasoning": false,
    "litellm_provider": "openai"
  },
  "claude-sonnet-4.6": {
    "max_input_tokens": 200000,
    "max_output_tokens": 64000,
    "input_cost_per_token": 0.000003,
    "output_cost_per_token": 0.000015,
    "mode": "chat",
    "supports_function_calling": true,
    "supports_reasoning": true,
    "litellm_provider": "anthropic"
  },
  "text-embedding-3-small": {
    "max_input_tokens": 8191,
    "input_cost_per_token": 0.00000002,
    "mode": "embedding",
    "litellm_provider": "openai"
  }
}
```

- [ ] **Step 3: Write failing normalizer test**

`tests/Clarive.ModelRegistry.Service.Tests/Sources/LiteLlmNormalizerTests.cs`:

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Sources;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.Tests.Sources;

public class LiteLlmNormalizerTests
{
    [Fact]
    public async Task Normalize_MapsChatModelFields()
    {
        var json = await File.ReadAllTextAsync("Fixtures/litellm/sample.json");
        var sut = new LiteLlmNormalizer();

        var snapshot = sut.Normalize(json, DateTimeOffset.UnixEpoch);

        snapshot.SourceName.Should().Be("litellm");
        var gpt5 = snapshot.Models.Single(m => m.Id == "openai/gpt-5");
        gpt5.Provider.Should().Be("openai");
        gpt5.ModelId.Should().Be("gpt-5");
        gpt5.Modality.Should().Be(Modality.Chat);
        gpt5.Pricing!.InputCostPerMillion.Should().Be(2.5m);
        gpt5.Pricing.OutputCostPerMillion.Should().Be(10m);
        gpt5.Context!.MaxInputTokens.Should().Be(400000);
        gpt5.Context.MaxOutputTokens.Should().Be(128000);
        gpt5.Capabilities.SupportsFunctionCalling.Should().BeTrue();
        gpt5.Capabilities.SupportsResponseSchema.Should().BeTrue();
        gpt5.Capabilities.IsReasoning.Should().BeFalse();
        gpt5.Sources.Should().Equal("litellm");
    }

    [Fact]
    public async Task Normalize_IncludesNonChatModalities()
    {
        var json = await File.ReadAllTextAsync("Fixtures/litellm/sample.json");
        var sut = new LiteLlmNormalizer();

        var snapshot = sut.Normalize(json, DateTimeOffset.UnixEpoch);

        snapshot.Models.Should().Contain(m => m.Id == "openai/text-embedding-3-small"
            && m.Modality == Modality.Embedding);
    }
}
```

- [ ] **Step 4: Run and confirm failure**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter LiteLlmNormalizerTests
```

Expected: FAIL (class `LiteLlmNormalizer` does not exist).

- [ ] **Step 5: Implement `LiteLlmNormalizer.cs`**

```csharp
using System.Text.Json;
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.ModelRegistry.Service.Sources;

public sealed class LiteLlmNormalizer
{
    private const decimal PerTokenToPerMillion = 1_000_000m;

    public SourceSnapshot Normalize(string rawJson, DateTimeOffset fetchedAt)
    {
        using var doc = JsonDocument.Parse(rawJson);
        var models = new List<ModelInfo>();

        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Object) continue;
            var (provider, modelId) = SplitKey(prop.Name, prop.Value);
            var canonicalId = $"{provider}/{modelId}".ToLowerInvariant();

            models.Add(new ModelInfo(
                Id: canonicalId,
                Provider: provider,
                ModelId: modelId,
                DisplayName: null,
                Pricing: ExtractPricing(prop.Value),
                Context: ExtractContext(prop.Value),
                Capabilities: ExtractCapabilities(prop.Value),
                Modality: MapModality(prop.Value),
                Sources: new[] { "litellm" },
                LastUpdated: fetchedAt));
        }

        return new SourceSnapshot("litellm", fetchedAt, models);
    }

    private static (string Provider, string ModelId) SplitKey(string key, JsonElement el)
    {
        if (el.TryGetProperty("litellm_provider", out var p) && p.GetString() is string provider)
        {
            var modelId = key.Contains('/', StringComparison.Ordinal) ? key.Split('/', 2)[1] : key;
            return (provider.ToLowerInvariant(), modelId);
        }
        if (key.Contains('/', StringComparison.Ordinal))
        {
            var parts = key.Split('/', 2);
            return (parts[0].ToLowerInvariant(), parts[1]);
        }
        return ("unknown", key);
    }

    private static Pricing? ExtractPricing(JsonElement el)
    {
        var input = GetDecimal(el, "input_cost_per_token");
        var output = GetDecimal(el, "output_cost_per_token");
        var cached = GetDecimal(el, "cache_read_input_token_cost");
        var reasoning = GetDecimal(el, "output_cost_per_reasoning_token");
        if (input is null && output is null && cached is null && reasoning is null) return null;
        return new Pricing(
            input * PerTokenToPerMillion,
            output * PerTokenToPerMillion,
            cached * PerTokenToPerMillion,
            reasoning * PerTokenToPerMillion);
    }

    private static Context? ExtractContext(JsonElement el)
    {
        var maxIn = GetLong(el, "max_input_tokens");
        var maxOut = GetLong(el, "max_output_tokens");
        return maxIn is null && maxOut is null ? null : new Context(maxIn, maxOut);
    }

    private static Capabilities ExtractCapabilities(JsonElement el) =>
        new(GetBool(el, "supports_reasoning"),
            GetBool(el, "supports_function_calling"),
            GetBool(el, "supports_response_schema"),
            GetBool(el, "supports_vision"),
            GetBool(el, "supports_audio_input"));

    private static Modality MapModality(JsonElement el) =>
        el.TryGetProperty("mode", out var m) && m.GetString() is string s ? s switch
        {
            "chat" => Modality.Chat,
            "embedding" => Modality.Embedding,
            "image_generation" => Modality.Image,
            "audio_transcription" or "audio_speech" => Modality.Audio,
            _ => Modality.Other
        } : Modality.Chat;

    private static decimal? GetDecimal(JsonElement el, string name) =>
        el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number
            ? p.GetDecimal() : null;

    private static long? GetLong(JsonElement el, string name) =>
        el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number
            ? (p.TryGetInt64(out var l) ? l : (long)p.GetDouble()) : null;

    private static bool? GetBool(JsonElement el, string name) =>
        el.TryGetProperty(name, out var p) && p.ValueKind switch
        {
            JsonValueKind.True => (bool?)true,
            JsonValueKind.False => false,
            _ => null
        } is bool b ? b : null;
}
```

- [ ] **Step 6: Run tests**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter LiteLlmNormalizerTests
```

Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(sources): add litellm normalizer"
```

---

## Task 5: LiteLLM HTTP source

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Sources/ISource.cs`
- Create: `src/Clarive.ModelRegistry.Service/Sources/LiteLlmSource.cs`

- [ ] **Step 1: Define `ISource` interface**

```csharp
namespace Clarive.ModelRegistry.Service.Sources;

public interface ISource
{
    string Name { get; }
    Task<SourceSnapshot> FetchAsync(CancellationToken ct);
}
```

- [ ] **Step 2: Implement `LiteLlmSource.cs`**

```csharp
namespace Clarive.ModelRegistry.Service.Sources;

public sealed class LiteLlmSource(HttpClient http, LiteLlmNormalizer normalizer, TimeProvider clock)
    : ISource
{
    public string Name => "litellm";

    public async Task<SourceSnapshot> FetchAsync(CancellationToken ct)
    {
        var raw = await http.GetStringAsync(string.Empty, ct);
        return normalizer.Normalize(raw, clock.GetUtcNow());
    }
}
```

- [ ] **Step 3: Commit**

The HTTP side is exercised by the integration tests (Task 17+), so we don't unit-test this trivial wrapper in isolation.

```bash
git add -A
git commit -m "feat(sources): add litellm http source"
```

---

## Task 6: OpenRouter normalizer (TDD)

**Files:**
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Fixtures/openrouter/sample.json`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Sources/OpenRouterNormalizerTests.cs`
- Create: `src/Clarive.ModelRegistry.Service/Sources/OpenRouterNormalizer.cs`

- [ ] **Step 1: Create fixture `sample.json`**

OpenRouter's shape:

```json
{
  "data": [
    {
      "id": "openai/gpt-5",
      "name": "GPT-5",
      "pricing": { "prompt": "0.0000025", "completion": "0.00001" },
      "context_length": 400000,
      "architecture": { "modality": "text->text", "input_modalities": ["text", "image"] },
      "top_provider": { "max_completion_tokens": 128000 },
      "supported_parameters": ["tools", "response_format"]
    },
    {
      "id": "anthropic/claude-sonnet-4.6",
      "name": "Claude Sonnet 4.6",
      "pricing": { "prompt": "0.000003", "completion": "0.000015" },
      "context_length": 200000,
      "architecture": { "modality": "text->text", "input_modalities": ["text"] },
      "top_provider": { "max_completion_tokens": 64000 },
      "supported_parameters": ["tools", "reasoning"]
    }
  ]
}
```

- [ ] **Step 2: Write failing test**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Sources;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.Tests.Sources;

public class OpenRouterNormalizerTests
{
    [Fact]
    public async Task Normalize_MapsPricingContextAndCapabilities()
    {
        var json = await File.ReadAllTextAsync("Fixtures/openrouter/sample.json");
        var sut = new OpenRouterNormalizer();

        var snapshot = sut.Normalize(json, DateTimeOffset.UnixEpoch);

        var gpt5 = snapshot.Models.Single(m => m.Id == "openai/gpt-5");
        gpt5.Pricing!.InputCostPerMillion.Should().Be(2.5m);
        gpt5.Pricing.OutputCostPerMillion.Should().Be(10m);
        gpt5.Context!.MaxInputTokens.Should().Be(400000);
        gpt5.Context.MaxOutputTokens.Should().Be(128000);
        gpt5.Capabilities.SupportsFunctionCalling.Should().BeTrue();
        gpt5.Capabilities.SupportsResponseSchema.Should().BeTrue();
        gpt5.Capabilities.SupportsVision.Should().BeTrue();
        gpt5.DisplayName.Should().Be("GPT-5");

        var sonnet = snapshot.Models.Single(m => m.Id == "anthropic/claude-sonnet-4.6");
        sonnet.Capabilities.IsReasoning.Should().BeTrue();
    }
}
```

- [ ] **Step 3: Run test — expect FAIL (class missing)**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter OpenRouterNormalizerTests
```

- [ ] **Step 4: Implement `OpenRouterNormalizer.cs`**

```csharp
using System.Globalization;
using System.Text.Json;
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.ModelRegistry.Service.Sources;

public sealed class OpenRouterNormalizer
{
    private const decimal PerTokenToPerMillion = 1_000_000m;

    public SourceSnapshot Normalize(string rawJson, DateTimeOffset fetchedAt)
    {
        using var doc = JsonDocument.Parse(rawJson);
        var models = new List<ModelInfo>();

        if (!doc.RootElement.TryGetProperty("data", out var data) ||
            data.ValueKind != JsonValueKind.Array)
            return new SourceSnapshot("openrouter", fetchedAt, models);

        foreach (var el in data.EnumerateArray())
        {
            var id = el.GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(id)) continue;

            var parts = id.Contains('/', StringComparison.Ordinal)
                ? id.Split('/', 2) : new[] { "unknown", id };

            var supported = el.TryGetProperty("supported_parameters", out var sp)
                && sp.ValueKind == JsonValueKind.Array
                ? sp.EnumerateArray().Select(x => x.GetString() ?? "")
                    .ToHashSet(StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var inputModalities = el.TryGetProperty("architecture", out var arch)
                && arch.TryGetProperty("input_modalities", out var im)
                && im.ValueKind == JsonValueKind.Array
                ? im.EnumerateArray().Select(x => x.GetString() ?? "")
                    .ToHashSet(StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            models.Add(new ModelInfo(
                Id: id.ToLowerInvariant(),
                Provider: parts[0].ToLowerInvariant(),
                ModelId: parts[1],
                DisplayName: el.TryGetProperty("name", out var n) ? n.GetString() : null,
                Pricing: ExtractPricing(el),
                Context: ExtractContext(el),
                Capabilities: new Capabilities(
                    IsReasoning: supported.Contains("reasoning") ? true : null,
                    SupportsFunctionCalling: supported.Contains("tools") ? true : null,
                    SupportsResponseSchema: supported.Contains("response_format") ? true : null,
                    SupportsVision: inputModalities.Contains("image") ? true : null,
                    SupportsAudioInput: inputModalities.Contains("audio") ? true : null),
                Modality: Modality.Chat,
                Sources: new[] { "openrouter" },
                LastUpdated: fetchedAt));
        }

        return new SourceSnapshot("openrouter", fetchedAt, models);
    }

    private static Pricing? ExtractPricing(JsonElement el)
    {
        if (!el.TryGetProperty("pricing", out var p)) return null;
        var input = ParseStringDecimal(p, "prompt");
        var output = ParseStringDecimal(p, "completion");
        var cached = ParseStringDecimal(p, "input_cache_read");
        if (input is null && output is null && cached is null) return null;
        return new Pricing(
            input * PerTokenToPerMillion,
            output * PerTokenToPerMillion,
            cached * PerTokenToPerMillion,
            null);
    }

    private static Context? ExtractContext(JsonElement el)
    {
        long? maxIn = el.TryGetProperty("context_length", out var cl)
            && cl.ValueKind == JsonValueKind.Number
            ? cl.GetInt64() : null;
        long? maxOut = el.TryGetProperty("top_provider", out var tp)
            && tp.TryGetProperty("max_completion_tokens", out var mct)
            && mct.ValueKind == JsonValueKind.Number
            ? mct.GetInt64() : null;
        return maxIn is null && maxOut is null ? null : new Context(maxIn, maxOut);
    }

    private static decimal? ParseStringDecimal(JsonElement el, string name) =>
        el.TryGetProperty(name, out var p) && p.GetString() is string s
            && decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d)
            ? d : null;
}
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter OpenRouterNormalizerTests
git add -A
git commit -m "feat(sources): add openrouter normalizer"
```

---

## Task 7: OpenRouter HTTP source

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Sources/OpenRouterSource.cs`

- [ ] **Step 1: Implement**

```csharp
namespace Clarive.ModelRegistry.Service.Sources;

public sealed class OpenRouterSource(HttpClient http, OpenRouterNormalizer normalizer, TimeProvider clock)
    : ISource
{
    public string Name => "openrouter";

    public async Task<SourceSnapshot> FetchAsync(CancellationToken ct)
    {
        var raw = await http.GetStringAsync("models", ct);
        return normalizer.Normalize(raw, clock.GetUtcNow());
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(sources): add openrouter http source"
```

---

## Task 8: models.dev normalizer (TDD)

**Files:**
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Fixtures/modelsdev/sample.json`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Sources/ModelsDevNormalizerTests.cs`
- Create: `src/Clarive.ModelRegistry.Service/Sources/ModelsDevNormalizer.cs`

- [ ] **Step 1: Create fixture `sample.json`** (models.dev publishes a per-provider nested JSON at `https://models.dev/api.json`)

```json
{
  "openai": {
    "id": "openai",
    "name": "OpenAI",
    "models": {
      "gpt-5": {
        "id": "gpt-5",
        "name": "GPT-5",
        "limit": { "context": 400000, "output": 128000 },
        "cost": { "input": 2.5, "output": 10.0 },
        "modalities": { "input": ["text", "image"], "output": ["text"] },
        "tool_call": true,
        "reasoning": false
      }
    }
  },
  "anthropic": {
    "id": "anthropic",
    "name": "Anthropic",
    "models": {
      "claude-sonnet-4.6": {
        "id": "claude-sonnet-4.6",
        "name": "Claude Sonnet 4.6",
        "limit": { "context": 200000, "output": 64000 },
        "cost": { "input": 3.0, "output": 15.0 },
        "modalities": { "input": ["text"], "output": ["text"] },
        "tool_call": true,
        "reasoning": true
      }
    }
  }
}
```

- [ ] **Step 2: Write failing test**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Sources;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.Tests.Sources;

public class ModelsDevNormalizerTests
{
    [Fact]
    public async Task Normalize_MapsProvidersAndModels()
    {
        var json = await File.ReadAllTextAsync("Fixtures/modelsdev/sample.json");
        var sut = new ModelsDevNormalizer();

        var snapshot = sut.Normalize(json, DateTimeOffset.UnixEpoch);

        snapshot.Models.Should().HaveCount(2);
        var gpt5 = snapshot.Models.Single(m => m.Id == "openai/gpt-5");
        gpt5.DisplayName.Should().Be("GPT-5");
        gpt5.Pricing!.InputCostPerMillion.Should().Be(2.5m);
        gpt5.Context!.MaxInputTokens.Should().Be(400000);
        gpt5.Capabilities.SupportsFunctionCalling.Should().BeTrue();
        gpt5.Capabilities.SupportsVision.Should().BeTrue();
    }
}
```

- [ ] **Step 3: Run — expect FAIL**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter ModelsDevNormalizerTests
```

- [ ] **Step 4: Implement**

```csharp
using System.Text.Json;
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.ModelRegistry.Service.Sources;

public sealed class ModelsDevNormalizer
{
    public SourceSnapshot Normalize(string rawJson, DateTimeOffset fetchedAt)
    {
        using var doc = JsonDocument.Parse(rawJson);
        var models = new List<ModelInfo>();

        foreach (var prov in doc.RootElement.EnumerateObject())
        {
            if (prov.Value.ValueKind != JsonValueKind.Object) continue;
            if (!prov.Value.TryGetProperty("models", out var modelsEl)) continue;

            var provider = prov.Name.ToLowerInvariant();
            foreach (var m in modelsEl.EnumerateObject())
            {
                var modelId = m.Value.TryGetProperty("id", out var idEl) && idEl.GetString() is string s
                    ? s : m.Name;

                models.Add(new ModelInfo(
                    Id: $"{provider}/{modelId}".ToLowerInvariant(),
                    Provider: provider,
                    ModelId: modelId,
                    DisplayName: m.Value.TryGetProperty("name", out var n) ? n.GetString() : null,
                    Pricing: ExtractPricing(m.Value),
                    Context: ExtractContext(m.Value),
                    Capabilities: ExtractCapabilities(m.Value),
                    Modality: Modality.Chat,
                    Sources: new[] { "modelsdev" },
                    LastUpdated: fetchedAt));
            }
        }

        return new SourceSnapshot("modelsdev", fetchedAt, models);
    }

    private static Pricing? ExtractPricing(JsonElement el)
    {
        if (!el.TryGetProperty("cost", out var c)) return null;
        decimal? input = c.TryGetProperty("input", out var i) && i.ValueKind == JsonValueKind.Number ? i.GetDecimal() : null;
        decimal? output = c.TryGetProperty("output", out var o) && o.ValueKind == JsonValueKind.Number ? o.GetDecimal() : null;
        decimal? cached = c.TryGetProperty("cache_read", out var cr) && cr.ValueKind == JsonValueKind.Number ? cr.GetDecimal() : null;
        if (input is null && output is null && cached is null) return null;
        return new Pricing(input, output, cached, null);
    }

    private static Context? ExtractContext(JsonElement el)
    {
        if (!el.TryGetProperty("limit", out var l)) return null;
        long? inCtx = l.TryGetProperty("context", out var ctx) && ctx.ValueKind == JsonValueKind.Number ? ctx.GetInt64() : null;
        long? outCtx = l.TryGetProperty("output", out var o) && o.ValueKind == JsonValueKind.Number ? o.GetInt64() : null;
        return inCtx is null && outCtx is null ? null : new Context(inCtx, outCtx);
    }

    private static Capabilities ExtractCapabilities(JsonElement el)
    {
        var inputModalities = el.TryGetProperty("modalities", out var mods)
            && mods.TryGetProperty("input", out var mi)
            && mi.ValueKind == JsonValueKind.Array
            ? mi.EnumerateArray().Select(x => x.GetString() ?? "").ToHashSet(StringComparer.OrdinalIgnoreCase)
            : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        return new Capabilities(
            IsReasoning: GetBool(el, "reasoning"),
            SupportsFunctionCalling: GetBool(el, "tool_call"),
            SupportsResponseSchema: null,
            SupportsVision: inputModalities.Contains("image") ? true : null,
            SupportsAudioInput: inputModalities.Contains("audio") ? true : null);
    }

    private static bool? GetBool(JsonElement el, string name) =>
        el.TryGetProperty(name, out var p) && p.ValueKind switch
        {
            JsonValueKind.True => (bool?)true,
            JsonValueKind.False => false,
            _ => null
        } is bool b ? b : null;
}
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter ModelsDevNormalizerTests
git add -A
git commit -m "feat(sources): add models.dev normalizer"
```

---

## Task 9: models.dev HTTP source

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Sources/ModelsDevSource.cs`

- [ ] **Step 1: Implement**

```csharp
namespace Clarive.ModelRegistry.Service.Sources;

public sealed class ModelsDevSource(HttpClient http, ModelsDevNormalizer normalizer, TimeProvider clock)
    : ISource
{
    public string Name => "modelsdev";

    public async Task<SourceSnapshot> FetchAsync(CancellationToken ct)
    {
        var raw = await http.GetStringAsync("api.json", ct);
        return normalizer.Normalize(raw, clock.GetUtcNow());
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(sources): add models.dev http source"
```

---

## Task 10: Alias resolver (TDD)

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Aliases/alias-map.json`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Aliases/AliasResolverTests.cs`
- Create: `src/Clarive.ModelRegistry.Service/Aliases/AliasResolver.cs`

- [ ] **Step 1: Create initial `alias-map.json`**

The schema: `{ "sourceName": { "<source-specific-id>": "<canonical-id>" } }`. Start empty — we add entries only when two sources disagree on IDs:

```json
{
  "litellm": {},
  "openrouter": {},
  "modelsdev": {}
}
```

- [ ] **Step 2: Write failing test**

`tests/Clarive.ModelRegistry.Service.Tests/Aliases/AliasResolverTests.cs`:

```csharp
using Clarive.ModelRegistry.Service.Aliases;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.Tests.Aliases;

public class AliasResolverTests
{
    [Fact]
    public void Resolve_ReturnsCanonicalIdWhenMapped()
    {
        var sut = new AliasResolver(new Dictionary<string, Dictionary<string, string>>
        {
            ["openrouter"] = new() { ["openai/gpt-5-preview"] = "openai/gpt-5" }
        });

        sut.Resolve("openrouter", "openai/gpt-5-preview").Should().Be("openai/gpt-5");
    }

    [Fact]
    public void Resolve_ReturnsInputWhenUnmapped()
    {
        var sut = new AliasResolver(new Dictionary<string, Dictionary<string, string>>());
        sut.Resolve("litellm", "openai/gpt-5").Should().Be("openai/gpt-5");
    }
}
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement**

```csharp
using System.Text.Json;

namespace Clarive.ModelRegistry.Service.Aliases;

public sealed class AliasResolver
{
    private readonly IReadOnlyDictionary<string, Dictionary<string, string>> _map;

    public AliasResolver(IReadOnlyDictionary<string, Dictionary<string, string>> map) => _map = map;

    public string Resolve(string source, string sourceSpecificId)
    {
        if (_map.TryGetValue(source, out var inner)
            && inner.TryGetValue(sourceSpecificId, out var canonical))
            return canonical;
        return sourceSpecificId;
    }

    public static AliasResolver LoadFromFile(string path)
    {
        if (!File.Exists(path))
            return new AliasResolver(new Dictionary<string, Dictionary<string, string>>());
        var raw = File.ReadAllText(path);
        var parsed = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(raw)
            ?? new();
        return new AliasResolver(parsed);
    }
}
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter AliasResolverTests
git add -A
git commit -m "feat(aliases): add alias resolver"
```

---

## Task 11: Per-field priority merger (TDD)

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Merging/MergeOptions.cs`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Merging/PriorityMergerTests.cs`
- Create: `src/Clarive.ModelRegistry.Service/Merging/PriorityMerger.cs`

- [ ] **Step 1: Write `MergeOptions.cs`**

```csharp
namespace Clarive.ModelRegistry.Service.Merging;

public sealed class MergeOptions
{
    public string[] PricingOrder { get; set; } = ["openrouter", "litellm", "modelsdev"];
    public string[] ContextOrder { get; set; } = ["litellm", "modelsdev", "openrouter"];
    public string[] CapabilitiesOrder { get; set; } = ["litellm", "modelsdev", "openrouter"];
    public string[] DisplayOrder { get; set; } = ["modelsdev", "litellm", "openrouter"];
}
```

- [ ] **Step 2: Write failing tests**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Aliases;
using Clarive.ModelRegistry.Service.Merging;
using Clarive.ModelRegistry.Service.Sources;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.Tests.Merging;

public class PriorityMergerTests
{
    private static readonly DateTimeOffset T = DateTimeOffset.UnixEpoch;
    private static ModelInfo Model(string source, string id,
        decimal? input = null, long? maxIn = null, bool? funcCalling = null, string? name = null) =>
        new(id, id.Split('/')[0], id.Split('/')[1], name,
            input is null ? null : new Pricing(input, null, null, null),
            maxIn is null ? null : new Context(maxIn, null),
            new Capabilities(null, funcCalling, null, null, null),
            Modality.Chat, new[] { source }, T);

    [Fact]
    public void Merge_PricingFollowsPriorityOrder()
    {
        var aliasResolver = new AliasResolver(new Dictionary<string, Dictionary<string, string>>());
        var sut = new PriorityMerger(new MergeOptions(), aliasResolver);

        var merged = sut.Merge(new[]
        {
            new SourceSnapshot("litellm", T, new[] { Model("litellm", "openai/gpt-5", input: 3m) }),
            new SourceSnapshot("openrouter", T, new[] { Model("openrouter", "openai/gpt-5", input: 2.5m) }),
        });

        merged.Single().Pricing!.InputCostPerMillion.Should().Be(2.5m);
    }

    [Fact]
    public void Merge_ContextFollowsPriorityOrder()
    {
        var sut = new PriorityMerger(new MergeOptions(),
            new AliasResolver(new Dictionary<string, Dictionary<string, string>>()));

        var merged = sut.Merge(new[]
        {
            new SourceSnapshot("openrouter", T, new[] { Model("openrouter", "openai/gpt-5", maxIn: 100) }),
            new SourceSnapshot("litellm", T, new[] { Model("litellm", "openai/gpt-5", maxIn: 400000) }),
        });

        merged.Single().Context!.MaxInputTokens.Should().Be(400000);
    }

    [Fact]
    public void Merge_UnionsSourcesList()
    {
        var sut = new PriorityMerger(new MergeOptions(),
            new AliasResolver(new Dictionary<string, Dictionary<string, string>>()));

        var merged = sut.Merge(new[]
        {
            new SourceSnapshot("litellm", T, new[] { Model("litellm", "openai/gpt-5", input: 3m) }),
            new SourceSnapshot("openrouter", T, new[] { Model("openrouter", "openai/gpt-5", input: 2.5m) }),
        });

        merged.Single().Sources.Should().BeEquivalentTo(new[] { "litellm", "openrouter" });
    }

    [Fact]
    public void Merge_DisplayNameFollowsPriorityOrder()
    {
        var sut = new PriorityMerger(new MergeOptions(),
            new AliasResolver(new Dictionary<string, Dictionary<string, string>>()));

        var merged = sut.Merge(new[]
        {
            new SourceSnapshot("litellm", T, new[] { Model("litellm", "openai/gpt-5", name: "litellm-name") }),
            new SourceSnapshot("modelsdev", T, new[] { Model("modelsdev", "openai/gpt-5", name: "GPT-5") }),
        });

        merged.Single().DisplayName.Should().Be("GPT-5");
    }
}
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement `PriorityMerger.cs`**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Aliases;
using Clarive.ModelRegistry.Service.Sources;

namespace Clarive.ModelRegistry.Service.Merging;

public sealed class PriorityMerger(MergeOptions options, AliasResolver aliases)
{
    public IReadOnlyList<ModelInfo> Merge(IReadOnlyList<SourceSnapshot> snapshots)
    {
        var bySource = snapshots.ToDictionary(s => s.SourceName, s => ResolveIds(s), StringComparer.OrdinalIgnoreCase);
        var allIds = bySource.Values.SelectMany(d => d.Keys).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var result = new List<ModelInfo>(allIds.Count);
        foreach (var id in allIds)
        {
            var present = options.PricingOrder.Concat(options.ContextOrder)
                .Concat(options.CapabilitiesOrder).Concat(options.DisplayOrder)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Where(s => bySource.TryGetValue(s, out var d) && d.ContainsKey(id))
                .ToList();

            if (present.Count == 0) continue;

            var pricing = FirstNonNull(options.PricingOrder, id, bySource, m => m.Pricing);
            var context = FirstNonNull(options.ContextOrder, id, bySource, m => m.Context);
            var caps = MergeCapabilities(options.CapabilitiesOrder, id, bySource);
            var (displayName, modality) = FirstDisplay(options.DisplayOrder, id, bySource);
            var lastUpdated = present.Max(s => bySource[s][id].LastUpdated);
            var anyModel = bySource[present[0]][id];

            result.Add(new ModelInfo(
                Id: id,
                Provider: anyModel.Provider,
                ModelId: anyModel.ModelId,
                DisplayName: displayName,
                Pricing: pricing,
                Context: context,
                Capabilities: caps,
                Modality: modality,
                Sources: present,
                LastUpdated: lastUpdated));
        }
        return result;
    }

    private Dictionary<string, ModelInfo> ResolveIds(SourceSnapshot snap)
    {
        var result = new Dictionary<string, ModelInfo>(StringComparer.OrdinalIgnoreCase);
        foreach (var m in snap.Models)
        {
            var canonical = aliases.Resolve(snap.SourceName, m.Id);
            result[canonical] = m with { Id = canonical };
        }
        return result;
    }

    private static T? FirstNonNull<T>(string[] order, string id,
        Dictionary<string, Dictionary<string, ModelInfo>> bySource,
        Func<ModelInfo, T?> pick) where T : class
    {
        foreach (var src in order)
            if (bySource.TryGetValue(src, out var d) && d.TryGetValue(id, out var m))
            {
                var v = pick(m);
                if (v is not null) return v;
            }
        return null;
    }

    private static Capabilities MergeCapabilities(string[] order, string id,
        Dictionary<string, Dictionary<string, ModelInfo>> bySource)
    {
        bool? reasoning = null, func = null, schema = null, vision = null, audio = null;
        foreach (var src in order)
        {
            if (!bySource.TryGetValue(src, out var d) || !d.TryGetValue(id, out var m)) continue;
            reasoning ??= m.Capabilities.IsReasoning;
            func ??= m.Capabilities.SupportsFunctionCalling;
            schema ??= m.Capabilities.SupportsResponseSchema;
            vision ??= m.Capabilities.SupportsVision;
            audio ??= m.Capabilities.SupportsAudioInput;
        }
        return new Capabilities(reasoning, func, schema, vision, audio);
    }

    private static (string? DisplayName, Modality Modality) FirstDisplay(string[] order, string id,
        Dictionary<string, Dictionary<string, ModelInfo>> bySource)
    {
        string? name = null;
        Modality modality = Modality.Chat;
        foreach (var src in order)
            if (bySource.TryGetValue(src, out var d) && d.TryGetValue(id, out var m))
            {
                name ??= m.DisplayName;
                if (modality == Modality.Chat) modality = m.Modality;
            }
        return (name, modality);
    }
}
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter PriorityMergerTests
git add -A
git commit -m "feat(merging): add per-field priority merger"
```

---

## Task 12: Snapshot store + catalog query (TDD)

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Catalog/NormalizedSnapshot.cs`
- Create: `src/Clarive.ModelRegistry.Service/Catalog/SnapshotStore.cs`
- Create: `src/Clarive.ModelRegistry.Service/Catalog/CatalogQuery.cs`
- Create: `tests/Clarive.ModelRegistry.Service.Tests/Catalog/SnapshotStoreTests.cs`

- [ ] **Step 1: Write types**

`NormalizedSnapshot.cs`:

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Sources;

namespace Clarive.ModelRegistry.Service.Catalog;

public sealed record NormalizedSnapshot(
    DateTimeOffset FetchedAt,
    IReadOnlyList<ModelInfo> Models,
    IReadOnlyList<SourceState> SourceStates,
    IReadOnlyList<SourceSnapshot> RawSources);
```

`CatalogQuery.cs`:

```csharp
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.ModelRegistry.Service.Catalog;

public static class CatalogQuery
{
    public static IEnumerable<ModelInfo> Filter(IEnumerable<ModelInfo> models, ModelQuery q) =>
        models.Where(m =>
            (q.Provider is null || string.Equals(m.Provider, q.Provider, StringComparison.OrdinalIgnoreCase))
            && (q.Modality is null || m.Modality == q.Modality)
            && (q.IsReasoning is null || m.Capabilities.IsReasoning == q.IsReasoning)
            && (q.SupportsFunctionCalling is null
                || m.Capabilities.SupportsFunctionCalling == q.SupportsFunctionCalling));
}
```

- [ ] **Step 2: Write failing test**

`tests/Clarive.ModelRegistry.Service.Tests/Catalog/SnapshotStoreTests.cs`:

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Catalog;
using Clarive.ModelRegistry.Service.Sources;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.Tests.Catalog;

public class SnapshotStoreTests
{
    private static NormalizedSnapshot MakeSnap(string id, DateTimeOffset t) =>
        new(t,
            new[]
            {
                new ModelInfo(id, id.Split('/')[0], id.Split('/')[1], null, null, null,
                    new Capabilities(null, null, null, null, null), Modality.Chat, new[] { "litellm" }, t)
            },
            new SourceState[] { new("litellm", t, null) },
            Array.Empty<SourceSnapshot>());

    [Fact]
    public async Task SwapAndGet_RoundtripsViaDisk()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"snapstore-{Guid.NewGuid()}");
        try
        {
            var sut = new SnapshotStore(Path.Combine(dir, "snapshot.json"));
            var snap = MakeSnap("openai/gpt-5", DateTimeOffset.UnixEpoch);

            await sut.SwapAsync(snap, CancellationToken.None);

            sut.Current.Should().NotBeNull();
            sut.Current!.Models.Single().Id.Should().Be("openai/gpt-5");

            var reloaded = new SnapshotStore(Path.Combine(dir, "snapshot.json"));
            await reloaded.TryLoadFromDiskAsync(CancellationToken.None);
            reloaded.Current!.Models.Single().Id.Should().Be("openai/gpt-5");
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        }
    }
}
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement `SnapshotStore.cs`**

```csharp
using System.Text.Json;

namespace Clarive.ModelRegistry.Service.Catalog;

public sealed class SnapshotStore(string snapshotPath)
{
    private volatile NormalizedSnapshot? _current;

    public NormalizedSnapshot? Current => _current;

    public async Task SwapAsync(NormalizedSnapshot snapshot, CancellationToken ct)
    {
        _current = snapshot;
        Directory.CreateDirectory(Path.GetDirectoryName(snapshotPath)!);
        var tmp = snapshotPath + ".tmp";
        await using (var fs = File.Create(tmp))
            await JsonSerializer.SerializeAsync(fs, snapshot, cancellationToken: ct);
        File.Move(tmp, snapshotPath, overwrite: true);
    }

    public async Task TryLoadFromDiskAsync(CancellationToken ct)
    {
        if (!File.Exists(snapshotPath)) return;
        await using var fs = File.OpenRead(snapshotPath);
        _current = await JsonSerializer.DeserializeAsync<NormalizedSnapshot>(fs, cancellationToken: ct);
    }
}
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.Tests --filter SnapshotStoreTests
git add -A
git commit -m "feat(catalog): add snapshot store and catalog query"
```

---

## Task 13: Sync pipeline

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Jobs/SyncPipeline.cs`

- [ ] **Step 1: Implement**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Catalog;
using Clarive.ModelRegistry.Service.Merging;
using Clarive.ModelRegistry.Service.Sources;

namespace Clarive.ModelRegistry.Service.Jobs;

public sealed class SyncPipeline(
    IEnumerable<ISource> sources,
    PriorityMerger merger,
    SnapshotStore store,
    TimeProvider clock,
    ILogger<SyncPipeline> logger)
{
    public async Task RunAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var sourceList = sources.ToList();
        var prevStates = store.Current?.SourceStates
            .ToDictionary(s => s.Source, StringComparer.OrdinalIgnoreCase)
            ?? new Dictionary<string, SourceState>(StringComparer.OrdinalIgnoreCase);

        var tasks = sourceList.Select(async s =>
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(30));
            try
            {
                var snap = await s.FetchAsync(cts.Token);
                return (s.Name, Snap: (SourceSnapshot?)snap, State: new SourceState(s.Name, now, null));
            }
            catch (Exception ex) when (ex is not OperationCanceledException || ct.IsCancellationRequested == false)
            {
                logger.LogWarning(ex, "Source {Source} fetch failed", s.Name);
                var prev = prevStates.TryGetValue(s.Name, out var p) ? p.LastSuccess : null;
                return (s.Name, Snap: (SourceSnapshot?)null, State: new SourceState(s.Name, prev, ex.Message));
            }
        });

        var results = await Task.WhenAll(tasks);
        var liveSnaps = results.Where(r => r.Snap is not null).Select(r => r.Snap!).ToList();
        var states = results.Select(r => r.State).ToList();

        var merged = liveSnaps.Count > 0
            ? merger.Merge(liveSnaps)
            : store.Current?.Models ?? Array.Empty<ModelInfo>();

        var snapshot = new NormalizedSnapshot(
            FetchedAt: liveSnaps.Count > 0 ? now : store.Current?.FetchedAt ?? now,
            Models: merged,
            SourceStates: states,
            RawSources: liveSnaps);

        await store.SwapAsync(snapshot, ct);
        logger.LogInformation(
            "Sync complete: {ModelCount} models, {SuccessCount}/{TotalCount} sources",
            merged.Count, liveSnaps.Count, sourceList.Count);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(jobs): add sync pipeline"
```

---

## Task 14: Quartz sync job

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Jobs/SyncJob.cs`

- [ ] **Step 1: Implement**

```csharp
using Quartz;

namespace Clarive.ModelRegistry.Service.Jobs;

[DisallowConcurrentExecution]
public sealed class SyncJob(SyncPipeline pipeline) : IJob
{
    public static readonly object RunningLock = new();
    public static volatile bool Running;

    public async Task Execute(IJobExecutionContext context)
    {
        lock (RunningLock) Running = true;
        try { await pipeline.RunAsync(context.CancellationToken); }
        finally { lock (RunningLock) Running = false; }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(jobs): add quartz sync job wrapper"
```

---

## Task 15: API key middleware

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Auth/ApiKeyMiddleware.cs`

- [ ] **Step 1: Implement**

```csharp
using Microsoft.Extensions.Options;

namespace Clarive.ModelRegistry.Service.Auth;

public sealed class ApiKeyOptions
{
    public List<ApiKeyEntry> ApiKeys { get; set; } = new();
}

public sealed class ApiKeyEntry
{
    public string Name { get; set; } = "";
    public string Key { get; set; } = "";
}

public sealed class ApiKeyMiddleware(RequestDelegate next, IOptions<ApiKeyOptions> options, ILogger<ApiKeyMiddleware> logger)
{
    private static readonly string[] OpenPaths = { "/healthz", "/metrics", "/swagger" };

    public async Task Invoke(HttpContext ctx)
    {
        if (OpenPaths.Any(p => ctx.Request.Path.StartsWithSegments(p)))
        {
            await next(ctx);
            return;
        }

        if (!ctx.Request.Headers.TryGetValue("X-Api-Key", out var supplied) ||
            supplied.Count != 1 ||
            options.Value.ApiKeys.FirstOrDefault(k => k.Key == supplied.ToString()) is not { } entry)
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsync("Invalid or missing X-Api-Key header");
            return;
        }

        using (logger.BeginScope("consumer={Consumer}", entry.Name))
            await next(ctx);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(auth): add api key middleware"
```

---

## Task 16: Metrics registry

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Metrics/MetricsRegistry.cs`

- [ ] **Step 1: Implement**

```csharp
using Prometheus;

namespace Clarive.ModelRegistry.Service.Metrics;

public static class MetricsRegistry
{
    public static readonly Gauge ModelsTotal = Prometheus.Metrics.CreateGauge(
        "model_registry_models_total", "Total models in the current snapshot");

    public static readonly Gauge SourceLastSuccessSeconds = Prometheus.Metrics.CreateGauge(
        "model_registry_source_last_success_seconds",
        "Seconds since last successful fetch per source", labelNames: new[] { "source" });

    public static readonly Histogram RefreshDuration = Prometheus.Metrics.CreateHistogram(
        "model_registry_refresh_duration_seconds", "Duration of a full refresh cycle");

    public static readonly Counter RefreshErrors = Prometheus.Metrics.CreateCounter(
        "model_registry_refresh_errors_total", "Refresh error count per source",
        labelNames: new[] { "source" });
}
```

- [ ] **Step 2: Wire metrics into `SyncPipeline`** (edit from Task 13 — wrap `RunAsync` body in `MetricsRegistry.RefreshDuration.NewTimer()` and after the `results = await Task.WhenAll(tasks)` line add):

```csharp
using (MetricsRegistry.RefreshDuration.NewTimer())
{
    // ... existing body ...
}
// after Task.WhenAll:
foreach (var r in results)
{
    if (r.Snap is null) MetricsRegistry.RefreshErrors.WithLabels(r.Name).Inc();
    if (r.State.LastSuccess is { } ls)
        MetricsRegistry.SourceLastSuccessSeconds
            .WithLabels(r.Name)
            .Set((clock.GetUtcNow() - ls).TotalSeconds);
}
MetricsRegistry.ModelsTotal.Set(merged.Count);
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(metrics): add prometheus metrics"
```

---

## Task 17: Endpoints — models list + lookup

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Endpoints/ModelEndpoints.cs`

- [ ] **Step 1: Implement**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Catalog;

namespace Clarive.ModelRegistry.Service.Endpoints;

public static class ModelEndpoints
{
    public static RouteGroupBuilder MapModelEndpoints(this RouteGroupBuilder g, SnapshotStore store)
    {
        g.MapGet("/models", (string? provider, Modality? modality, bool? isReasoning, bool? supportsFunctionCalling) =>
        {
            if (store.Current is null) return Results.Problem(statusCode: 503, detail: "Snapshot not yet available");
            var q = new ModelQuery(provider, modality, isReasoning, supportsFunctionCalling);
            return Results.Ok(CatalogQuery.Filter(store.Current.Models, q));
        });

        g.MapGet("/models/{provider}/{modelId}", (string provider, string modelId) =>
        {
            if (store.Current is null) return Results.Problem(statusCode: 503, detail: "Snapshot not yet available");
            var id = $"{provider}/{modelId}".ToLowerInvariant();
            var m = store.Current.Models.FirstOrDefault(x => x.Id == id);
            return m is null ? Results.NotFound() : Results.Ok(m);
        });

        return g;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(endpoints): add models list + lookup"
```

---

## Task 18: Endpoints — sources, meta, refresh, health

**Files:**
- Create: `src/Clarive.ModelRegistry.Service/Endpoints/SourceEndpoints.cs`
- Create: `src/Clarive.ModelRegistry.Service/Endpoints/MetaEndpoints.cs`
- Create: `src/Clarive.ModelRegistry.Service/Endpoints/RefreshEndpoints.cs`

- [ ] **Step 1: `SourceEndpoints.cs`**

```csharp
using Clarive.ModelRegistry.Service.Catalog;

namespace Clarive.ModelRegistry.Service.Endpoints;

public static class SourceEndpoints
{
    public static RouteGroupBuilder MapSourceEndpoints(this RouteGroupBuilder g, SnapshotStore store)
    {
        g.MapGet("/sources", () =>
        {
            if (store.Current is null) return Results.Problem(statusCode: 503);
            return Results.Ok(store.Current.RawSources.Select(s => new { s.SourceName, s.FetchedAt, ModelCount = s.Models.Count }));
        });

        g.MapGet("/sources/{source}/models/{provider}/{modelId}", (string source, string provider, string modelId) =>
        {
            if (store.Current is null) return Results.Problem(statusCode: 503);
            var raw = store.Current.RawSources.FirstOrDefault(s =>
                string.Equals(s.SourceName, source, StringComparison.OrdinalIgnoreCase));
            if (raw is null) return Results.NotFound();
            var id = $"{provider}/{modelId}".ToLowerInvariant();
            var m = raw.Models.FirstOrDefault(x => x.Id == id);
            return m is null ? Results.NotFound() : Results.Ok(m);
        });

        return g;
    }
}
```

- [ ] **Step 2: `MetaEndpoints.cs`**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.Catalog;

namespace Clarive.ModelRegistry.Service.Endpoints;

public static class MetaEndpoints
{
    public static RouteGroupBuilder MapMetaEndpoints(this RouteGroupBuilder g,
        SnapshotStore store, TimeProvider clock, TimeSpan staleThreshold)
    {
        g.MapGet("/meta", () =>
        {
            var snap = store.Current;
            if (snap is null)
                return Results.Ok(new CatalogMeta(
                    DateTimeOffset.MinValue, TimeSpan.Zero, Array.Empty<SourceState>(), false));
            var staleness = clock.GetUtcNow() - snap.FetchedAt;
            return Results.Ok(new CatalogMeta(
                snap.FetchedAt, staleness, snap.SourceStates, staleness < staleThreshold));
        });
        return g;
    }
}
```

- [ ] **Step 3: `RefreshEndpoints.cs`**

```csharp
using Clarive.ModelRegistry.Service.Jobs;

namespace Clarive.ModelRegistry.Service.Endpoints;

public static class RefreshEndpoints
{
    public static RouteGroupBuilder MapRefreshEndpoints(this RouteGroupBuilder g, SyncPipeline pipeline)
    {
        g.MapPost("/refresh", async (CancellationToken ct) =>
        {
            lock (SyncJob.RunningLock)
            {
                if (SyncJob.Running) return Results.Conflict("Refresh already running");
            }
            _ = Task.Run(() => pipeline.RunAsync(ct), ct);
            return Results.Accepted();
        });
        return g;
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(endpoints): add sources, meta, refresh endpoints"
```

---

## Task 19: Wire everything in Program.cs

**Files:**
- Modify: `src/Clarive.ModelRegistry.Service/Program.cs`
- Modify: `src/Clarive.ModelRegistry.Service/appsettings.json`

- [ ] **Step 1: Replace `Program.cs`**

```csharp
using Clarive.ModelRegistry.Service.Aliases;
using Clarive.ModelRegistry.Service.Auth;
using Clarive.ModelRegistry.Service.Catalog;
using Clarive.ModelRegistry.Service.Endpoints;
using Clarive.ModelRegistry.Service.Jobs;
using Clarive.ModelRegistry.Service.Merging;
using Clarive.ModelRegistry.Service.Sources;
using Polly;
using Polly.Extensions.Http;
using Prometheus;
using Quartz;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();
builder.Host.UseSerilog();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.Configure<ApiKeyOptions>(builder.Configuration.GetSection("ModelRegistry"));
builder.Services.Configure<MergeOptions>(builder.Configuration.GetSection("ModelRegistry:Merge"));

var cfg = builder.Configuration;
var snapshotPath = cfg["ModelRegistry:SnapshotPath"] ?? "data/snapshot.json";
var staleHours = cfg.GetValue("ModelRegistry:StaleThresholdHours", 72);
var aliasMapPath = cfg["ModelRegistry:AliasMapPath"] ?? "Aliases/alias-map.json";

builder.Services.AddSingleton(new SnapshotStore(snapshotPath));
builder.Services.AddSingleton(_ => AliasResolver.LoadFromFile(aliasMapPath));
builder.Services.AddSingleton<LiteLlmNormalizer>();
builder.Services.AddSingleton<OpenRouterNormalizer>();
builder.Services.AddSingleton<ModelsDevNormalizer>();
builder.Services.AddSingleton<PriorityMerger>();
builder.Services.AddSingleton<SyncPipeline>();

var resiliencePolicy = HttpPolicyExtensions
    .HandleTransientHttpError()
    .WaitAndRetryAsync(3, a => TimeSpan.FromSeconds(Math.Pow(4, a - 1)));
var breaker = HttpPolicyExtensions.HandleTransientHttpError()
    .CircuitBreakerAsync(5, TimeSpan.FromMinutes(5));

builder.Services.AddHttpClient<LiteLlmSource>(c =>
    c.BaseAddress = new Uri(cfg["ModelRegistry:Sources:LiteLlm:Url"]
        ?? "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"))
    .AddPolicyHandler(resiliencePolicy).AddPolicyHandler(breaker);

builder.Services.AddHttpClient<OpenRouterSource>(c =>
    c.BaseAddress = new Uri(cfg["ModelRegistry:Sources:OpenRouter:Url"] ?? "https://openrouter.ai/api/v1/"))
    .AddPolicyHandler(resiliencePolicy).AddPolicyHandler(breaker);

builder.Services.AddHttpClient<ModelsDevSource>(c =>
    c.BaseAddress = new Uri(cfg["ModelRegistry:Sources:ModelsDev:Url"] ?? "https://models.dev/"))
    .AddPolicyHandler(resiliencePolicy).AddPolicyHandler(breaker);

builder.Services.AddSingleton<ISource>(sp => sp.GetRequiredService<LiteLlmSource>());
builder.Services.AddSingleton<ISource>(sp => sp.GetRequiredService<OpenRouterSource>());
builder.Services.AddSingleton<ISource>(sp => sp.GetRequiredService<ModelsDevSource>());

builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("sync");
    q.AddJob<SyncJob>(o => o.WithIdentity(jobKey));
    q.AddTrigger(t => t.ForJob(jobKey).WithIdentity("sync-startup").StartNow());
    q.AddTrigger(t => t.ForJob(jobKey).WithIdentity("sync-daily")
        .WithCronSchedule(cfg["ModelRegistry:SyncCron"] ?? "0 0 1 * * ?"));
});
builder.Services.AddQuartzHostedService(opt => opt.WaitForJobsToComplete = true);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

await app.Services.GetRequiredService<SnapshotStore>().TryLoadFromDiskAsync(CancellationToken.None);

app.UseMiddleware<ApiKeyMiddleware>();
app.UseSwagger();
app.UseSwaggerUI();
app.UseHttpMetrics();
app.MapMetrics();

var v1 = app.MapGroup("/v1");
v1.MapModelEndpoints(app.Services.GetRequiredService<SnapshotStore>());
v1.MapSourceEndpoints(app.Services.GetRequiredService<SnapshotStore>());
v1.MapMetaEndpoints(
    app.Services.GetRequiredService<SnapshotStore>(),
    app.Services.GetRequiredService<TimeProvider>(),
    TimeSpan.FromHours(staleHours));
v1.MapRefreshEndpoints(app.Services.GetRequiredService<SyncPipeline>());

app.MapGet("/healthz", (SnapshotStore store, TimeProvider clock) =>
{
    var snap = store.Current;
    if (snap is null) return Results.Problem(statusCode: 503, detail: "Snapshot unavailable");
    var age = clock.GetUtcNow() - snap.FetchedAt;
    return age < TimeSpan.FromHours(staleHours)
        ? Results.Ok(new { status = "healthy", snapshotAgeHours = age.TotalHours })
        : Results.Json(new { status = "degraded", snapshotAgeHours = age.TotalHours }, statusCode: 503);
});

app.Run();

public partial class Program;
```

- [ ] **Step 2: Update `appsettings.json`**

```json
{
  "Logging": { "LogLevel": { "Default": "Information" } },
  "AllowedHosts": "*",
  "ModelRegistry": {
    "SnapshotPath": "data/snapshot.json",
    "AliasMapPath": "Aliases/alias-map.json",
    "StaleThresholdHours": 72,
    "SyncCron": "0 0 1 * * ?",
    "Sources": {
      "LiteLlm":    { "Enabled": true, "Url": "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json" },
      "OpenRouter": { "Enabled": true, "Url": "https://openrouter.ai/api/v1/" },
      "ModelsDev":  { "Enabled": true, "Url": "https://models.dev/" }
    },
    "ApiKeys": []
  }
}
```

- [ ] **Step 3: Build**

```bash
dotnet build ModelRegistry.slnx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(service): wire program with DI, Quartz, endpoints, auth"
```

---

## Task 20: Integration tests — fake sources + happy path

**Files:**
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/Fakes/FakeSource.cs`
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/TestAppFactory.cs`
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/ModelEndpointsTests.cs`

- [ ] **Step 1: Write `FakeSource.cs`**

```csharp
using Clarive.ModelRegistry.Service.Sources;

namespace Clarive.ModelRegistry.Service.IntegrationTests.Fakes;

public sealed class FakeSource(string name, Func<CancellationToken, Task<SourceSnapshot>> fetch) : ISource
{
    public string Name => name;
    public Task<SourceSnapshot> FetchAsync(CancellationToken ct) => fetch(ct);
}
```

- [ ] **Step 2: Write `TestAppFactory.cs`**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.IntegrationTests.Fakes;
using Clarive.ModelRegistry.Service.Sources;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Clarive.ModelRegistry.Service.IntegrationTests;

public sealed class TestAppFactory : WebApplicationFactory<Program>
{
    public List<FakeSource> Fakes { get; } = new();
    public string ApiKey { get; } = "test-key-" + Guid.NewGuid();

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, cfg) =>
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ModelRegistry:SnapshotPath"] = Path.Combine(Path.GetTempPath(), $"snap-{Guid.NewGuid()}.json"),
                ["ModelRegistry:ApiKeys:0:Name"] = "test",
                ["ModelRegistry:ApiKeys:0:Key"]  = ApiKey,
                ["ModelRegistry:SyncCron"] = "0 0 0 1 1 ? 2100" // never
            }));

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<ISource>();
            foreach (var f in Fakes) services.AddSingleton<ISource>(f);
        });
        return base.CreateHost(builder);
    }

    public static SourceSnapshot Snap(string source, params (string id, decimal? price, long? ctx)[] models) =>
        new(source, DateTimeOffset.UnixEpoch, models.Select(m => new ModelInfo(
            m.id, m.id.Split('/')[0], m.id.Split('/')[1], null,
            m.price is null ? null : new Pricing(m.price, null, null, null),
            m.ctx is null ? null : new Context(m.ctx, null),
            new Capabilities(null, null, null, null, null),
            Modality.Chat, new[] { source }, DateTimeOffset.UnixEpoch)).ToList());
}
```

Note: `Microsoft.Extensions.DependencyInjection.Extensions.RemoveAll` lives in `Microsoft.Extensions.DependencyInjection.Extensions` — add `using Microsoft.Extensions.DependencyInjection.Extensions;`.

- [ ] **Step 3: Write happy-path test**

```csharp
using Clarive.ModelRegistry.Client.Dtos;
using Clarive.ModelRegistry.Service.IntegrationTests.Fakes;
using Clarive.ModelRegistry.Service.Jobs;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;

namespace Clarive.ModelRegistry.Service.IntegrationTests;

public class ModelEndpointsTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;

    public ModelEndpointsTests(TestAppFactory factory)
    {
        _factory = factory;
        factory.Fakes.Clear();
        factory.Fakes.Add(new FakeSource("litellm",
            _ => Task.FromResult(TestAppFactory.Snap("litellm",
                ("openai/gpt-5", 3m, 400000)))));
        factory.Fakes.Add(new FakeSource("openrouter",
            _ => Task.FromResult(TestAppFactory.Snap("openrouter",
                ("openai/gpt-5", 2.5m, null)))));
    }

    [Fact]
    public async Task GetModel_MergesAcrossSourcesByPriority()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", _factory.ApiKey);

        var pipeline = _factory.Services.GetRequiredService<SyncPipeline>();
        await pipeline.RunAsync(CancellationToken.None);

        var m = await client.GetFromJsonAsync<ModelInfo>("/v1/models/openai/gpt-5");

        m.Should().NotBeNull();
        m!.Pricing!.InputCostPerMillion.Should().Be(2.5m); // openrouter wins pricing
        m.Context!.MaxInputTokens.Should().Be(400000);      // litellm wins context
        m.Sources.Should().BeEquivalentTo(new[] { "litellm", "openrouter" });
    }
}
```

- [ ] **Step 4: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.IntegrationTests
git add -A
git commit -m "test(integration): happy-path merge via real pipeline"
```

---

## Task 21: Integration tests — auth, partial failure, refresh, cold-start

**Files:**
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/AuthTests.cs`
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/RefreshEndpointTests.cs`
- Create: `tests/Clarive.ModelRegistry.Service.IntegrationTests/ColdStartTests.cs`

- [ ] **Step 1: `AuthTests.cs`**

```csharp
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.IntegrationTests;

public class AuthTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public AuthTests(TestAppFactory f) => _factory = f;

    [Fact]
    public async Task Unauthenticated_Returns401()
    {
        var resp = await _factory.CreateClient().GetAsync("/v1/models");
        resp.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task WrongKey_Returns401()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Api-Key", "wrong");
        var resp = await c.GetAsync("/v1/models");
        resp.StatusCode.Should().Be(System.Net.HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Healthz_IsOpen()
    {
        var resp = await _factory.CreateClient().GetAsync("/healthz");
        resp.StatusCode.Should().BeOneOf(System.Net.HttpStatusCode.OK, System.Net.HttpStatusCode.ServiceUnavailable);
    }
}
```

- [ ] **Step 2: `RefreshEndpointTests.cs`**

```csharp
using Clarive.ModelRegistry.Service.IntegrationTests.Fakes;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.IntegrationTests;

public class RefreshEndpointTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;

    public RefreshEndpointTests(TestAppFactory f)
    {
        _factory = f;
        f.Fakes.Clear();
        f.Fakes.Add(new FakeSource("litellm", async ct =>
        {
            await Task.Delay(500, ct);
            return TestAppFactory.Snap("litellm", ("openai/gpt-5", 1m, 1));
        }));
    }

    [Fact]
    public async Task RefreshWhileAnotherIsRunning_Returns409()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Api-Key", _factory.ApiKey);

        var first = c.PostAsync("/v1/refresh", null);
        await Task.Delay(50);
        var second = await c.PostAsync("/v1/refresh", null);

        second.StatusCode.Should().Be(System.Net.HttpStatusCode.Conflict);
        (await first).StatusCode.Should().Be(System.Net.HttpStatusCode.Accepted);
    }

    [Fact]
    public async Task PartialSourceFailure_StillProducesSnapshot()
    {
        _factory.Fakes.Clear();
        _factory.Fakes.Add(new FakeSource("litellm",
            _ => Task.FromResult(TestAppFactory.Snap("litellm", ("openai/gpt-5", 3m, 400000)))));
        _factory.Fakes.Add(new FakeSource("openrouter",
            _ => throw new HttpRequestException("boom")));

        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Api-Key", _factory.ApiKey);
        await c.PostAsync("/v1/refresh", null);
        await Task.Delay(300);

        var meta = await c.GetFromJsonAsync<Client.Dtos.CatalogMeta>("/v1/meta");
        meta!.SourceStates.Should().Contain(s => s.Source == "openrouter" && s.LastError != null);
        meta.SourceStates.Should().Contain(s => s.Source == "litellm" && s.LastError == null);
    }
}
```

- [ ] **Step 3: `ColdStartTests.cs`**

```csharp
using Clarive.ModelRegistry.Service.IntegrationTests.Fakes;
using FluentAssertions;

namespace Clarive.ModelRegistry.Service.IntegrationTests;

public class ColdStartTests
{
    [Fact]
    public async Task ModelsEndpoint_Returns503BeforeFirstSync()
    {
        using var factory = new TestAppFactory();
        factory.Fakes.Add(new FakeSource("litellm", async ct =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            return TestAppFactory.Snap("litellm");
        }));

        var c = factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Api-Key", factory.ApiKey);
        var resp = await c.GetAsync("/v1/models");
        resp.StatusCode.Should().Be(System.Net.HttpStatusCode.ServiceUnavailable);
    }
}
```

- [ ] **Step 4: Run all integration tests**

```bash
dotnet test tests/Clarive.ModelRegistry.Service.IntegrationTests
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(integration): auth, partial failure, refresh, cold-start"
```

---

## Task 22: Client SDK — interface + options + handler

**Files:**
- Create: `src/Clarive.ModelRegistry.Client/IModelCatalogClient.cs`
- Create: `src/Clarive.ModelRegistry.Client/ModelCatalogClientOptions.cs`
- Create: `src/Clarive.ModelRegistry.Client/ApiKeyHandler.cs`

- [ ] **Step 1: Write interface**

```csharp
using Clarive.ModelRegistry.Client.Dtos;

namespace Clarive.ModelRegistry.Client;

public interface IModelCatalogClient
{
    Task<ModelInfo?> GetModelAsync(string canonicalId, CancellationToken ct = default);
    Task<ModelInfo?> GetModelAsync(string provider, string modelId, CancellationToken ct = default);
    Task<IReadOnlyList<ModelInfo>> ListModelsAsync(ModelQuery? query = null, CancellationToken ct = default);
    Task<CatalogMeta> GetMetaAsync(CancellationToken ct = default);
}
```

- [ ] **Step 2: Write options**

```csharp
namespace Clarive.ModelRegistry.Client;

public sealed class ModelCatalogClientOptions
{
    public string BaseUrl { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public TimeSpan CacheTtl { get; set; } = TimeSpan.FromHours(1);
    public TimeSpan RequestTimeout { get; set; } = TimeSpan.FromSeconds(10);
    public TimeSpan StaleGrace { get; set; } = TimeSpan.FromHours(24);
}
```

- [ ] **Step 3: Write `ApiKeyHandler.cs`**

```csharp
using Microsoft.Extensions.Options;

namespace Clarive.ModelRegistry.Client;

public sealed class ApiKeyHandler(IOptions<ModelCatalogClientOptions> options) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.Remove("X-Api-Key");
        request.Headers.Add("X-Api-Key", options.Value.ApiKey);
        return base.SendAsync(request, ct);
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(client): add interface, options, api key handler"
```

---

## Task 23: Client SDK — implementation with cache + stale-cache fallback (TDD)

**Files:**
- Create: `tests/Clarive.ModelRegistry.Client.Tests/ModelCatalogClientTests.cs`
- Create: `tests/Clarive.ModelRegistry.Client.Tests/StaleCacheFallbackTests.cs`
- Create: `src/Clarive.ModelRegistry.Client/ModelCatalogClient.cs`

- [ ] **Step 1: Write failing tests — core behaviour**

```csharp
using Clarive.ModelRegistry.Client;
using Clarive.ModelRegistry.Client.Dtos;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using RichardSzalay.MockHttp;
using System.Net.Http.Json;

namespace Clarive.ModelRegistry.Client.Tests;

public class ModelCatalogClientTests
{
    private static (ModelCatalogClient client, MockHttpMessageHandler handler, IDistributedCache cache) BuildSut(
        ModelCatalogClientOptions? opts = null)
    {
        opts ??= new ModelCatalogClientOptions { BaseUrl = "http://fake/", ApiKey = "k" };
        var handler = new MockHttpMessageHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri(opts.BaseUrl) };
        var cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        var client = new ModelCatalogClient(http, cache, Options.Create(opts), TimeProvider.System,
            NullLogger<ModelCatalogClient>.Instance);
        return (client, handler, cache);
    }

    [Fact]
    public async Task GetModel_HitsNetworkThenCache()
    {
        var (sut, handler, _) = BuildSut();
        var expected = new ModelInfo("openai/gpt-5", "openai", "gpt-5", null, null, null,
            new Capabilities(null, null, null, null, null), Modality.Chat, new[] { "litellm" }, DateTimeOffset.UnixEpoch);
        handler.When("http://fake/v1/models/openai/gpt-5").Respond(JsonContent.Create(expected));

        var first = await sut.GetModelAsync("openai", "gpt-5");
        var second = await sut.GetModelAsync("openai", "gpt-5");

        first!.Id.Should().Be("openai/gpt-5");
        second!.Id.Should().Be("openai/gpt-5");
        handler.GetMatchCount(handler.When("http://fake/v1/models/openai/gpt-5")).Should().Be(1);
    }
}

// minimal null logger
internal static class NullLogger<T>
{
    public static Microsoft.Extensions.Logging.ILogger<T> Instance { get; }
        = Microsoft.Extensions.Logging.Abstractions.NullLogger<T>.Instance;
}
```

- [ ] **Step 2: Write failing test — stale-cache fallback**

```csharp
using Clarive.ModelRegistry.Client;
using Clarive.ModelRegistry.Client.Dtos;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using RichardSzalay.MockHttp;
using System.Net;
using System.Text.Json;

namespace Clarive.ModelRegistry.Client.Tests;

public class StaleCacheFallbackTests
{
    [Fact]
    public async Task GetModel_ReturnsStaleCache_WhenServiceUnreachable()
    {
        var opts = new ModelCatalogClientOptions
        {
            BaseUrl = "http://fake/",
            ApiKey = "k",
            CacheTtl = TimeSpan.FromMilliseconds(10),
            StaleGrace = TimeSpan.FromHours(24),
        };
        var handler = new MockHttpMessageHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri(opts.BaseUrl) };
        var cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        var sut = new ModelCatalogClient(http, cache, Options.Create(opts), TimeProvider.System,
            NullLogger<ModelCatalogClient>.Instance);

        var expected = new ModelInfo("openai/gpt-5", "openai", "gpt-5", null, null, null,
            new Capabilities(null, null, null, null, null), Modality.Chat, new[] { "litellm" }, DateTimeOffset.UnixEpoch);

        // seed stale cache entry directly
        var stale = new CachedEntry<ModelInfo?>(expected, DateTimeOffset.UtcNow.AddMinutes(-1));
        await cache.SetStringAsync("modelregistry:v1:model:openai/gpt-5",
            JsonSerializer.Serialize(stale),
            new DistributedCacheEntryOptions());

        handler.When("http://fake/v1/models/openai/gpt-5").Respond(HttpStatusCode.ServiceUnavailable);

        var result = await sut.GetModelAsync("openai", "gpt-5");

        result!.Id.Should().Be("openai/gpt-5");
    }
}
```

- [ ] **Step 3: Run — expect FAIL** (`ModelCatalogClient` and `CachedEntry` don't exist yet).

- [ ] **Step 4: Implement `ModelCatalogClient.cs`**

```csharp
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clarive.ModelRegistry.Client.Dtos;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Clarive.ModelRegistry.Client;

public sealed record CachedEntry<T>(T Value, DateTimeOffset StoredAt);

public sealed class ModelCatalogClient(
    HttpClient http,
    IDistributedCache cache,
    IOptions<ModelCatalogClientOptions> options,
    TimeProvider clock,
    ILogger<ModelCatalogClient> logger) : IModelCatalogClient
{
    private readonly ModelCatalogClientOptions _opts = options.Value;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public Task<ModelInfo?> GetModelAsync(string canonicalId, CancellationToken ct = default)
    {
        var parts = canonicalId.Split('/', 2);
        return GetModelAsync(parts[0], parts[1], ct);
    }

    public Task<ModelInfo?> GetModelAsync(string provider, string modelId, CancellationToken ct = default) =>
        FetchWithCacheAsync<ModelInfo?>(
            cacheKey: $"modelregistry:v1:model:{provider}/{modelId}",
            url: $"v1/models/{provider}/{modelId}",
            allow404: true, ct);

    public async Task<IReadOnlyList<ModelInfo>> ListModelsAsync(ModelQuery? query = null, CancellationToken ct = default)
    {
        var qs = query is null ? "" : BuildQuery(query);
        var key = $"modelregistry:v1:list:{StableHash(qs)}";
        var res = await FetchWithCacheAsync<IReadOnlyList<ModelInfo>>(key, "v1/models" + qs, allow404: false, ct);
        return res ?? Array.Empty<ModelInfo>();
    }

    public async Task<CatalogMeta> GetMetaAsync(CancellationToken ct = default) =>
        (await FetchWithCacheAsync<CatalogMeta>("modelregistry:v1:meta", "v1/meta", allow404: false, ct))!;

    private async Task<T?> FetchWithCacheAsync<T>(string cacheKey, string url, bool allow404, CancellationToken ct)
    {
        var fresh = await TryReadCacheAsync<T>(cacheKey, mustBeFresh: true, ct);
        if (fresh is (true, var value)) return value;

        await _lock.WaitAsync(ct);
        try
        {
            fresh = await TryReadCacheAsync<T>(cacheKey, mustBeFresh: true, ct);
            if (fresh is (true, var v2)) return v2;

            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(_opts.RequestTimeout);
                var resp = await http.GetAsync(url, cts.Token);
                if (allow404 && resp.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    await WriteCacheAsync<T>(cacheKey, default!, ct);
                    return default;
                }
                resp.EnsureSuccessStatusCode();
                var dto = await resp.Content.ReadFromJsonAsync<T>(cancellationToken: ct);
                await WriteCacheAsync(cacheKey, dto!, ct);
                return dto;
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                var stale = await TryReadCacheAsync<T>(cacheKey, mustBeFresh: false, ct);
                if (stale is (true, var sv))
                {
                    logger.LogWarning(ex, "Serving stale cache for {Url}", url);
                    return sv;
                }
                throw;
            }
        }
        finally { _lock.Release(); }
    }

    private async Task<(bool Hit, T? Value)?> TryReadCacheAsync<T>(string key, bool mustBeFresh, CancellationToken ct)
    {
        var raw = await cache.GetStringAsync(key, ct);
        if (raw is null) return null;
        var entry = JsonSerializer.Deserialize<CachedEntry<T>>(raw);
        if (entry is null) return null;
        var age = clock.GetUtcNow() - entry.StoredAt;
        if (mustBeFresh && age > _opts.CacheTtl) return null;
        if (!mustBeFresh && age > _opts.CacheTtl + _opts.StaleGrace) return null;
        return (true, entry.Value);
    }

    private async Task WriteCacheAsync<T>(string key, T value, CancellationToken ct)
    {
        var entry = new CachedEntry<T>(value, clock.GetUtcNow());
        var json = JsonSerializer.Serialize(entry);
        await cache.SetStringAsync(key, json,
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = _opts.CacheTtl + _opts.StaleGrace
            }, ct);
    }

    private static string BuildQuery(ModelQuery q)
    {
        var sb = new StringBuilder("?");
        if (q.Provider is not null) sb.Append($"provider={Uri.EscapeDataString(q.Provider)}&");
        if (q.Modality is not null) sb.Append($"modality={q.Modality}&");
        if (q.IsReasoning is not null) sb.Append($"isReasoning={q.IsReasoning}&");
        if (q.SupportsFunctionCalling is not null)
            sb.Append($"supportsFunctionCalling={q.SupportsFunctionCalling}&");
        return sb.Length == 1 ? "" : sb.ToString().TrimEnd('&');
    }

    private static string StableHash(string s)
    {
        unchecked
        {
            ulong h = 14695981039346656037UL;
            foreach (var c in s) { h ^= c; h *= 1099511628211UL; }
            return h.ToString("x");
        }
    }
}
```

- [ ] **Step 5: Run + commit**

```bash
dotnet test tests/Clarive.ModelRegistry.Client.Tests
git add -A
git commit -m "feat(client): implement model catalog client with cache + stale fallback"
```

---

## Task 24: Client SDK — DI extension + Polly

**Files:**
- Create: `src/Clarive.ModelRegistry.Client/ServiceCollectionExtensions.cs`

- [ ] **Step 1: Implement**

```csharp
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;

namespace Clarive.ModelRegistry.Client;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddModelCatalogClient(this IServiceCollection services,
        Action<ModelCatalogClientOptions> configure)
    {
        services.Configure(configure);
        services.TryAddSingleton<IDistributedCache>(sp =>
            new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions())));
        services.TryAddSingleton(TimeProvider.System);
        services.AddTransient<ApiKeyHandler>();

        services.AddHttpClient<IModelCatalogClient, ModelCatalogClient>((sp, c) =>
        {
            var opts = sp.GetRequiredService<IOptions<ModelCatalogClientOptions>>().Value;
            c.BaseAddress = new Uri(opts.BaseUrl);
            c.Timeout = opts.RequestTimeout;
        })
        .AddHttpMessageHandler<ApiKeyHandler>()
        .AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError()
            .WaitAndRetryAsync(3, a => TimeSpan.FromSeconds(Math.Pow(4, a - 1))))
        .AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError()
            .CircuitBreakerAsync(5, TimeSpan.FromMinutes(5)));

        return services;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(client): add AddModelCatalogClient extension"
```

---

## Task 25: Dockerfile + docker-compose

**Files:**
- Create: `deploy/Dockerfile`
- Create: `deploy/docker-compose.yml`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/Clarive.ModelRegistry.Service/Clarive.ModelRegistry.Service.csproj \
    -c Release -o /app/publish --no-self-contained

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/publish .
RUN mkdir -p /app/data && chown -R app:app /app
USER app
ENV ModelRegistry__SnapshotPath=/app/data/snapshot.json
EXPOSE 8080
ENTRYPOINT ["dotnet", "Clarive.ModelRegistry.Service.dll"]
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
services:
  model-registry:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    container_name: model-registry
    ports:
      - "8090:8080"
    volumes:
      - model-registry-data:/app/data
    environment:
      ASPNETCORE_URLS: http://+:8080
      ModelRegistry__ApiKeys__0__Name: dev
      ModelRegistry__ApiKeys__0__Key: ${MODEL_REGISTRY_DEV_KEY:-devkey}
    restart: unless-stopped

volumes:
  model-registry-data:
```

- [ ] **Step 3: Build image locally**

```bash
docker compose -f deploy/docker-compose.yml build
```

Expected: Image builds successfully.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(deploy): add Dockerfile and docker-compose"
```

---

## Task 26: GitHub Actions — CI on PR

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          global-json-file: global.json
      - run: dotnet tool install --global CSharpier --version 1.2.*
      - run: dotnet restore ModelRegistry.slnx
      - run: dotnet csharpier check src tests
      - run: dotnet build ModelRegistry.slnx --no-restore -c Release
      - run: dotnet test ModelRegistry.slnx --no-build -c Release --logger "trx;LogFileName=tests.trx"
      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: dotnet tests
          path: '**/tests.trx'
          reporter: dotnet-trx
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "ci: add build/test workflow"
```

---

## Task 27: GitHub Actions — release (container + NuGet)

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: Release
on:
  push:
    tags: ['v*.*.*']

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: deploy/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}
            ghcr.io/${{ github.repository }}:latest

  nuget:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          global-json-file: global.json
      - run: |
          VERSION="${{ github.ref_name }}"
          VERSION="${VERSION#v}"
          dotnet pack src/Clarive.ModelRegistry.Client/Clarive.ModelRegistry.Client.csproj \
            -c Release -o nupkg -p:Version=$VERSION
      - run: |
          dotnet nuget push "nupkg/*.nupkg" \
            --source "https://nuget.pkg.github.com/${{ github.repository_owner }}/index.json" \
            --api-key ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit + push repo**

```bash
git add -A
git commit -m "ci: add release workflow for container + NuGet"
git push -u origin main
```

---

## Task 28: Deploy to production

**Files:**
- Modify: `~/Services/Caddyfile` on the server (append a new block)

- [ ] **Step 1: Tag first release**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Wait for the Release workflow to finish publishing `ghcr.io/pinkroosterai/clarive-model-registry:v0.1.0` and `Clarive.ModelRegistry.Client` 0.1.0 to GitHub Packages. Verify in the Actions tab.

- [ ] **Step 2: Deploy directory on server**

```bash
ssh clarive-prod "mkdir -p ~/ModelRegistry && cd ~/ModelRegistry"
```

Copy `deploy/docker-compose.yml` plus a `.env` file to `~/ModelRegistry/` on the server:

```
MODEL_REGISTRY_CLARIVE_KEY=<generate with: openssl rand -hex 32>
```

Adjust `docker-compose.yml` on the server to use the published image rather than build:

```yaml
services:
  model-registry:
    image: ghcr.io/pinkroosterai/clarive-model-registry:v0.1.0
    container_name: model-registry
    volumes:
      - model-registry-data:/app/data
    environment:
      ASPNETCORE_URLS: http://+:8080
      ModelRegistry__ApiKeys__0__Name: clarive
      ModelRegistry__ApiKeys__0__Key: ${MODEL_REGISTRY_CLARIVE_KEY}
    restart: unless-stopped
volumes:
  model-registry-data:
```

- [ ] **Step 3: Authenticate Docker against GHCR on the server**

```bash
echo $GHCR_TOKEN | docker login ghcr.io -u <github-username> --password-stdin
```

(`GHCR_TOKEN` = personal access token with `read:packages`.)

- [ ] **Step 4: Start the service**

```bash
cd ~/ModelRegistry
docker compose pull
docker compose up -d
docker compose logs -f model-registry | head -50
```

Expected log line: `Sync complete: N models, 3/3 sources`.

- [ ] **Step 5: Add Caddy block**

Append to `~/Services/Caddyfile`:

```
models.internal.clarive.app {
    reverse_proxy model-registry:8080
}
```

Then reload:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

- [ ] **Step 6: Smoke test**

```bash
curl -H "X-Api-Key: $MODEL_REGISTRY_CLARIVE_KEY" https://models.internal.clarive.app/v1/meta | jq
curl -H "X-Api-Key: $MODEL_REGISTRY_CLARIVE_KEY" https://models.internal.clarive.app/v1/models/openai/gpt-5 | jq
curl https://models.internal.clarive.app/healthz
```

Expected: meta shows 3 healthy sources; gpt-5 returns a merged `ModelInfo`; healthz returns 200.

- [ ] **Step 7: Record the production API key in Clarive's `~/Clarive/deploy/.env.prod`**

Add (do NOT commit):

```
MODEL_REGISTRY_URL=https://models.internal.clarive.app
MODEL_REGISTRY_API_KEY=<same value as MODEL_REGISTRY_CLARIVE_KEY>
```

Plan B (the Clarive migration plan) consumes these.

---

## Self-Review

Spec coverage: §3 architecture → Tasks 1, 2, 19, 25. §4 data model → Tasks 3, 4, 6, 8, 11. §5 sync/failure → Tasks 13, 14, 20, 21. §6 API → Tasks 17, 18, 19. §7 auth → Task 15. §8 client SDK → Tasks 22, 23, 24. §10 testing → Tasks 4–12, 20–23. §11 ops → Tasks 25, 26, 27, 28. §11.3 metrics → Task 16. §9 migration is Plan B, not covered here intentionally.

Placeholder scan: none. All code blocks contain runnable content. No TBDs.

Type consistency: `ModelInfo`, `Pricing`, `Context`, `Capabilities`, `Modality`, `ModelQuery`, `CatalogMeta`, `SourceState`, `SourceSnapshot`, `NormalizedSnapshot`, `ISource`, `PriorityMerger`, `AliasResolver`, `SnapshotStore`, `SyncPipeline`, `SyncJob`, `IModelCatalogClient`, `ModelCatalogClient`, `ApiKeyHandler`, `CachedEntry<T>` — all names consistent across tasks.

Spec item 13 (risks) calls out SDK DTO sharing via linked files. The csproj in Task 2 uses `ProjectReference` to the Client project instead of linked files — this is actually stronger than a link, since it reuses the compiled assembly. Spec §4.2 mentioned linked files as one option; project reference satisfies the "single source of truth" intent equivalently. No gap.
