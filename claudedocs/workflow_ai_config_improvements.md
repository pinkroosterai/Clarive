# Workflow: AI Configuration Improvements

## Overview
Enhance the super admin AI configuration with: endpoint URL override, API key validation,
model selection via combobox (auto-fetched), and hot-reload of the AI client on config change.

## Phases

---

### Phase 1: Backend Foundation (no frontend dependency)

#### Step 1.1: AiSettings + ConfigRegistry + appsettings
**Files:**
- `src/backend/Clarive.Api/Services/AiSettings.cs`
- `src/backend/Clarive.Api/Services/ConfigRegistry.cs`
- `src/backend/Clarive.Api/appsettings.json`

**Tasks:**
1. Add `EndpointUrl` property to `AiSettings` record (default: `""`)
2. Add `Ai:EndpointUrl` config definition to `ConfigRegistry` (non-secret, `RequiresRestart: false`)
3. Flip all existing AI definitions (`Ai:OpenAiApiKey`, `Ai:DefaultModel`, `Ai:PremiumModel`) to `RequiresRestart: false`
4. Remove the 3 Payments/Stripe config definitions from `ConfigRegistry`
5. Remove `ConfigSection.Payments` enum value if it exists
6. Add `"EndpointUrl": ""` to the `Ai` section in `appsettings.json`

**Validation:** `dotnet build` succeeds

---

#### Step 1.2: New API Request/Response Models
**Files:**
- `src/backend/Clarive.Api/Models/Requests/AiConfigRequests.cs` (NEW)

**Tasks:**
1. Create file with records:
   - `ValidateAiConfigRequest(string ApiKey, string? EndpointUrl)`
   - `ValidateAiConfigResponse(bool Valid, string? Error = null)`
   - `GetAiModelsRequest(string? ApiKey = null, string? EndpointUrl = null)`
   - `GetAiModelsResponse(List<string> Models)`

**Validation:** `dotnet build` succeeds

---

#### Step 1.3: Config Validation + Models Endpoints
**Files:**
- `src/backend/Clarive.Api/Endpoints/ConfigEndpoints.cs`

**Tasks:**
1. Add route: `group.MapPost("/validate-ai", HandleValidateAi)`
2. Add route: `group.MapPost("/ai-models", HandleGetAiModels)`
3. Implement `HandleValidateAi`:
   - Create temp `OpenAIClient` with provided key + optional endpoint URL
   - Call `GetOpenAIModelClient().GetModels()` with 10s `CancellationTokenSource` timeout
   - Return `ValidateAiConfigResponse(true)` on success
   - Catch `ClientResultException` (401/403) → return `(false, "Invalid API key")`
   - Catch `OperationCanceledException` → return `(false, "Connection timed out")`
   - Catch general exceptions → return `(false, ex.Message)`
4. Implement `HandleGetAiModels`:
   - Resolve API key: request body → fallback `IConfiguration["Ai:OpenAiApiKey"]`
   - Resolve endpoint: request body → fallback `IConfiguration["Ai:EndpointUrl"]`
   - If no API key available → return 400 "No API key configured"
   - Create temp `OpenAIClient`, call `GetOpenAIModelClient().GetModels()` with 10s timeout
   - Filter chat-capable models:
     - If endpoint is empty or contains "api.openai.com": filter by ID prefix (`gpt-`, `o1-`, `o3-`, `chatgpt-`)
     - Otherwise: include all models (custom providers vary too much)
   - Sort alphabetically, return `GetAiModelsResponse(models)`
   - On error → return 400 with error message

**Validation:** `dotnet build` succeeds. Manual test with valid/invalid keys if possible.

---

### Phase 2: Hot-Reload Infrastructure (backend only)

#### Step 2.1: IAgentFactory Event + IAgentSessionPool.InvalidateAll
**Files:**
- `src/backend/Clarive.Api/Services/Agents/IAgentFactory.cs`
- `src/backend/Clarive.Api/Services/Agents/IAgentSessionPool.cs`

**Tasks:**
1. Add to `IAgentFactory`: `event Action? OnReconfigured;`
2. Add to `IAgentSessionPool`: `void InvalidateAll();`

**Validation:** `dotnet build` succeeds

---

#### Step 2.2: OpenAIAgentFactory Hot-Reload
**Files:**
- `src/backend/Clarive.Api/Services/Agents/OpenAIAgentFactory.cs`

**Tasks:**
1. Change constructor param: `IOptions<AiSettings>` → `IOptionsMonitor<AiSettings>`
2. Add fields:
   - `private readonly ReaderWriterLockSlim _lock = new();`
   - `private readonly ILogger<OpenAIAgentFactory> _logger;`
3. Make `_premiumClient` and `_defaultClient` non-readonly (mutable for hot-reload)
4. Make `IsConfigured` backed by a private field (mutable)
5. Add `public event Action? OnReconfigured;`
6. Extract client creation into `private void ReinitializeClients(AiSettings settings)`:
   - Acquire write lock
   - Dispose old clients if `IDisposable`
   - If API key non-empty:
     - If `EndpointUrl` non-empty: create `OpenAIClient(new ApiKeyCredential(key), new OpenAIClientOptions { Endpoint = new Uri(url) })`
     - Else: create `OpenAIClient(key)`
     - Create `_premiumClient` and `_defaultClient` from new client
     - Set `IsConfigured = true`
   - Else: null both clients, `IsConfigured = false`
   - Release write lock
   - Invoke `OnReconfigured`
7. In constructor: call `ReinitializeClients(optionsMonitor.CurrentValue)`
8. Register change callback: `optionsMonitor.OnChange((newSettings, _) => { _logger.LogInformation(...); ReinitializeClients(newSettings); })`
9. Wrap all `CreateXxxAgent()` methods with read lock:
   ```
   _lock.EnterReadLock();
   try { EnsureConfigured(); return _premiumClient!.AsAIAgent(...); }
   finally { _lock.ExitReadLock(); }
   ```

**Validation:** `dotnet build` succeeds

---

#### Step 2.3: AgentSessionPool Subscribe to Reconfiguration
**Files:**
- `src/backend/Clarive.Api/Services/Agents/AgentSessionPool.cs`

**Tasks:**
1. Implement `InvalidateAll()`:
   - Iterate `_sessions`, `TryRemove` each, `DisposeEntry`, count
   - Log count if > 0
2. Subscribe in constructor: `factory.OnReconfigured += InvalidateAll;`
3. Unsubscribe in `Dispose()`: `_factory.OnReconfigured -= InvalidateAll;`
   - Requires storing `_factory` as `IAgentFactory` (already done)

**Validation:** `dotnet build` succeeds

**Checkpoint:** Run `dotnet test` for backend unit + integration tests to verify no regressions.

---

### Phase 3: Frontend — API Service + Custom AI Config UI

#### Step 3.1: Config Service Extensions
**Files:**
- `src/frontend/src/services/api/configService.ts`

**Tasks:**
1. Add interfaces: `ValidateAiRequest`, `ValidateAiResponse`, `AiModelsRequest`, `AiModelsResponse`
2. Add functions: `validateAiConfig(req)`, `getAiModels(req)`

**Validation:** TypeScript compiles (`npx tsc --noEmit`)

---

#### Step 3.2: AiConfigSection Component
**Files:**
- `src/frontend/src/components/super/AiConfigSection.tsx` (NEW)

**Tasks:**
1. Create component accepting `{ settings: ConfigSetting[], onSaved: () => void }`
2. Extract individual settings by key (`Ai:EndpointUrl`, `Ai:OpenAiApiKey`, `Ai:DefaultModel`, `Ai:PremiumModel`)
3. Manage local state:
   - `dirtyValues: Record<string, string>` for tracking changes
   - `validationState: "idle" | "validating" | "valid" | "invalid"`
   - `validationError: string | null`
4. Auto-fetch models on mount (via `useQuery`):
   - Enabled when `Ai:OpenAiApiKey` setting has `isConfigured: true`
   - `queryKey: ["super", "ai-models"]`
   - `queryFn: () => getAiModels({})`
   - `staleTime: 5 * 60 * 1000` (5 min cache)
5. Render fields in order:
   a. **Endpoint URL** — text input with source badge, reset button
   b. **API Key** — password input with source badge, reset button, + "Validate" button
      - Validate button calls `validateAiConfig({ apiKey, endpointUrl })`
      - Shows checkmark on success, error message on failure
      - On validation success: invalidate `["super", "ai-models"]` query to re-fetch models with new key
   c. **Default Model** — combobox (Popover + Command) when models available, text input fallback
   d. **Premium Model** — same combobox pattern
6. Save button:
   - Disabled when no dirty values
   - If API key is dirty and validation state is not "valid" → show toast "Validate API key before saving"
   - Otherwise: iterate dirty values, call `setConfigValue()` for each
   - On success: clear dirty state, invalidate config query, call `onSaved()`
7. Reuse existing UI patterns from `ConfigSectionForm`:
   - `SourceBadge` component (extract or import)
   - `SecretInput` pattern for API key
   - Reset button with tooltip for dashboard overrides

**Validation:** Dev server renders without errors, AI tab shows new UI

---

#### Step 3.3: Wire AiConfigSection into SuperDashboardPage
**Files:**
- `src/frontend/src/pages/SuperDashboardPage.tsx`

**Tasks:**
1. Import `AiConfigSection` (lazy or direct)
2. In the `CONFIG_SECTIONS.map()` render block, add special case for AI section:
   - When `key === "Ai"`: render `<AiConfigSection settings={sectionSettings} onSaved={refreshRestartKeys} />`
   - All other sections: render `<ConfigSectionForm>` as before
3. Since AI settings no longer require restart, the restart banner won't appear for AI changes

**Validation:** Dev server works, AI tab renders `AiConfigSection`, other tabs render `ConfigSectionForm`

---

### Phase 4: Testing + Cleanup

#### Step 4.1: Backend Tests
**Tasks:**
1. Update any existing unit tests that mock `IOptions<AiSettings>` to use `IOptionsMonitor<AiSettings>` instead
2. Update any integration tests that reference Payments config or `RequiresRestart: true` for AI settings
3. Run full backend test suite: `make test-backend`

---

#### Step 4.2: Frontend Tests
**Tasks:**
1. Update any tests referencing Payments or Monitoring tabs in SuperDashboardPage
2. Run frontend unit tests: `make test-frontend`
3. Run linter: `make lint`

---

#### Step 4.3: E2E Smoke Test (if dev servers available)
**Tasks:**
1. Navigate to Super Admin → AI tab
2. Verify endpoint URL field appears
3. Verify validate button works with test key (or shows proper error)
4. Verify model combobox populates (or falls back to text input)
5. Verify save flow works end-to-end

---

## Execution Order & Dependencies

```
Phase 1: Backend Foundation
  Step 1.1 ──→ Step 1.2 ──→ Step 1.3
                              │
Phase 2: Hot-Reload           │ (depends on 1.1 for AiSettings.EndpointUrl)
  Step 2.1 ──→ Step 2.2 ──→ Step 2.3
                              │
                    ┌─────────┘
                    ▼
              BUILD CHECK (dotnet test)
                    │
Phase 3: Frontend   │ (depends on Phase 1 endpoints existing)
  Step 3.1 ──→ Step 3.2 ──→ Step 3.3
                              │
Phase 4: Testing              │
  Step 4.1 ─┐                │
  Step 4.2 ─┤ (parallel)     │
             └──→ Step 4.3   │
```

**Parallelizable:** Phase 1 (Steps 1.1+1.2) and Phase 2 (Step 2.1) can start in parallel since they modify different files. Phase 3.1 can start as soon as Phase 1.3 is done.

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| OpenAI `GetModels()` not available on all providers | Fallback to free-text input when fetch fails |
| Thread safety in hot-reload | ReaderWriterLockSlim with read locks on agent creation |
| Circular DI (factory ↔ session pool) | Event-based decoupling via `OnReconfigured` |
| Breaking existing tests | Phase 4 dedicated to test updates |
| ConfigSection.Payments removal cascades | Check for references before removing enum value |
