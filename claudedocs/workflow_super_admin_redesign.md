# Workflow: Unified Super Admin Settings Page + Credit Removal

## Phase 1: Remove Credit System (Frontend)
**Goal**: Eliminate all credit-related code from the frontend codebase.

### Step 1.1: Remove credit types
- **File**: `src/frontend/src/types/index.ts` (or wherever `CreditBalance`, `CreditTransaction`, `CreditPack` are defined)
- **Action**: Delete `CreditBalance`, `CreditTransaction`, `CreditPack` type definitions

### Step 1.2: Remove credit state from auth store
- **File**: `src/frontend/src/store/authStore.ts`
- **Action**: Remove `creditBalance` state, `setCreditBalance` action, and `CreditBalance` import

### Step 1.3: Remove credit test factories and tests
- **File**: `src/frontend/src/test/factories.ts`
- **Action**: Remove `createCreditBalance`, `createCreditTransaction`, `createCreditPack` and their type imports
- **File**: `src/frontend/src/store/authStore.test.ts`
- **Action**: Remove `setCreditBalance` describe block (lines ~112-134) and `createCreditBalance` import

### Step 1.4: Remove credit fields from SuperStats
- **File**: `src/frontend/src/services/api/superService.ts`
- **Action**: Remove `totalFreeCredits`, `totalPurchasedCredits`, `creditsUsed30d`, `totalTransactions` from `SuperStats` interface

### Step 1.5: Clean up billing query invalidations
- **File**: `src/frontend/src/hooks/useEditorMutations.ts`
- **Action**: Remove `queryClient.invalidateQueries({ queryKey: ["billing", "balance"] })` calls (lines ~81, ~96)

### Step 1.6: Remove credit references from UI components
- **File**: `src/frontend/src/components/wizard/ReviewStep.tsx` (line ~137)
- **Action**: Remove "Refine uses 1 credit" display text
- **File**: `src/frontend/src/components/onboarding/tourSteps.ts` (lines ~132-141)
- **Action**: Remove "Your Credits" tour step (step 10)
- **File**: `src/frontend/src/components/onboarding/tourSteps.test.ts` (lines ~63-67, ~78)
- **Action**: Remove credits tour step test assertions

### Step 1.7: Clean up E2E test references
- **File**: `src/frontend/e2e/settings.spec.ts`
- **Action**: Remove "Billing" from tab list (line ~14), remove "Billing tab shows credit balance" test (lines ~32-38)
- **File**: `src/frontend/e2e/helpers/wizard-mocks.ts`
- **Action**: Remove billing balance route mocks (lines ~127-136, ~203-212)
- **File**: `src/frontend/e2e/onboarding.spec.ts` (lines ~65-68)
- **Action**: Remove "Your Credits" onboarding step test assertion

### Step 1.8: Remove credit config definitions (backend)
- **File**: `src/backend/Clarive.Api/Services/ConfigRegistry.cs`
- **Action**: Remove `Billing:FreeMonthlyCredits` and all `Billing:CreditPacks:*` config definitions (lines ~91-140)
- **Note**: Keep Stripe key configs if Stripe is used for non-credit billing; remove if Stripe is fully unused

### Step 1.9: Clean up AI service comments (backend)
- **File**: `src/backend/Clarive.Api/Services/AiGenerationService.cs`
- **Action**: Remove "caller should refund credits" comments (5 occurrences)
- **File**: `src/backend/Clarive.Api/Services/Interfaces/IAiGenerationService.cs`
- **Action**: Remove all "credit deduction" / "refund credits" doc comments

### Step 1.10: Clean up integration test data
- **File**: `tests/backend/Clarive.Api.IntegrationTests/Helpers/TestData.cs`
- **Action**: Remove `CreditBalanceId` GUID (line ~43)
- **File**: `tests/backend/Clarive.Api.IntegrationTests/Helpers/MockPromptOrchestrator.cs` (line ~63)
- **Action**: Remove "Simulated AI failure for testing credit refund" comment

**Checkpoint**: `make lint && make build` — verify no compile/lint errors from removals.

---

## Phase 2: Unify Super Admin Page
**Goal**: Merge SuperDashboardPage + ServiceConfigPage into one tabbed page matching SettingsPage pattern.

### Step 2.1: Rewrite SuperDashboardPage as unified tabbed page
- **File**: `src/frontend/src/pages/SuperDashboardPage.tsx`
- **Action**: Complete rewrite combining dashboard + config tabs

**New structure**:
```
<h1>Super Admin</h1>
{restartBanner}  ← from ServiceConfigPage
<Tabs value={activeTab} ...>
  <TabsList>
    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
    <TabsTrigger value="authentication">Authentication</TabsTrigger>
    <TabsTrigger value="ai">AI</TabsTrigger>
    <TabsTrigger value="payments">Payments</TabsTrigger>
    <TabsTrigger value="email">Email</TabsTrigger>
    <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
    <TabsTrigger value="application">Application</TabsTrigger>
  </TabsList>
  <TabsContent value="dashboard">
    {maintenanceCard}
    <StatsSection "Users & Growth" />
    <StatsSection "Workspaces" />
    <StatsSection "Content" />
  </TabsContent>
  {SECTIONS.map → <TabsContent><ConfigSectionForm /></TabsContent>}
</Tabs>
```

**Key details**:
- Use same `TAB_STYLE` constant as SettingsPage
- `?tab=` URL param for tab state (same pattern as SettingsPage)
- `document.title = "Clarive — Super Admin"`
- No back arrow, no shield icon — just `<h1>` header
- Maintenance card: keep as full-width card (not in a 2-col grid since config link card is removed)
- Remove `creditStats` array and its `StatsSection`
- Remove unused icon imports (`Coins`, `CreditCard`, `TrendingDown`, `Receipt`, `ArrowLeft`, `ShieldAlert`, `Settings`)
- Import and inline config logic from ServiceConfigPage (SECTIONS, restart banner, settingsBySection, getAllConfig query)

### Step 2.2: Delete ServiceConfigPage
- **File**: `src/frontend/src/pages/ServiceConfigPage.tsx`
- **Action**: Delete file

### Step 2.3: Update App.tsx routing
- **File**: `src/frontend/src/App.tsx`
- **Action**: Remove `ServiceConfigPage` lazy import and `/super/config` route

**Checkpoint**: `make lint` — verify clean.

---

## Phase 3: Content & Test Cleanup
**Goal**: Update text references and tests affected by changes.

### Step 3.1: Update Help/Legal page text references (low priority / optional)
- **Files**: `src/frontend/src/pages/HelpPage.tsx`, `TermsPage.tsx`, `PrivacyPage.tsx`
- **Action**: Review and update/remove credit and billing text references
- **Note**: These are content pages — flag to user for review rather than auto-editing

### Step 3.2: Update E2E settings test
- Already handled in Step 1.6

### Step 3.3: Verify account deletion text
- **File**: `src/frontend/src/components/settings/AccountDeletionSection.tsx` (line ~84)
- **Action**: Remove "billing history" from deletion warning text

**Checkpoint**: `make test` — run all tests to catch regressions.

---

## Execution Order & Dependencies

```
Phase 1 (Steps 1.1-1.9) → Checkpoint: build + lint
    ↓
Phase 2 (Steps 2.1-2.3) → Checkpoint: lint
    ↓
Phase 3 (Steps 3.1-3.3) → Checkpoint: full test suite
```

Phases must be sequential. Within each phase, steps can be done in listed order (some have soft dependencies on prior type removals).

## Files Summary

| Action | File | Phase |
|--------|------|-------|
| Edit | `src/frontend/src/types/index.ts` (or types file) | 1 |
| Edit | `src/frontend/src/store/authStore.ts` | 1 |
| Edit | `src/frontend/src/store/authStore.test.ts` | 1 |
| Edit | `src/frontend/src/test/factories.ts` | 1 |
| Edit | `src/frontend/src/services/api/superService.ts` | 1 |
| Edit | `src/frontend/src/hooks/useEditorMutations.ts` | 1 |
| Edit | `src/frontend/src/components/wizard/ReviewStep.tsx` | 1 |
| Edit | `src/frontend/src/components/onboarding/tourSteps.ts` | 1 |
| Edit | `src/frontend/src/components/onboarding/tourSteps.test.ts` | 1 |
| Edit | `src/frontend/e2e/settings.spec.ts` | 1 |
| Edit | `src/frontend/e2e/helpers/wizard-mocks.ts` | 1 |
| Edit | `src/frontend/e2e/onboarding.spec.ts` | 1 |
| Edit | `src/backend/Clarive.Api/Services/ConfigRegistry.cs` | 1 |
| Edit | `src/backend/Clarive.Api/Services/AiGenerationService.cs` | 1 |
| Edit | `src/backend/Clarive.Api/Services/Interfaces/IAiGenerationService.cs` | 1 |
| Edit | `tests/backend/Clarive.Api.IntegrationTests/Helpers/TestData.cs` | 1 |
| Edit | `tests/backend/Clarive.Api.IntegrationTests/Helpers/MockPromptOrchestrator.cs` | 1 |
| **Rewrite** | `src/frontend/src/pages/SuperDashboardPage.tsx` | 2 |
| **Delete** | `src/frontend/src/pages/ServiceConfigPage.tsx` | 2 |
| Edit | `src/frontend/src/App.tsx` | 2 |
| Review | `src/frontend/src/pages/HelpPage.tsx` | 3 |
| Review | `src/frontend/src/pages/TermsPage.tsx` | 3 |
| Review | `src/frontend/src/pages/PrivacyPage.tsx` | 3 |
| Edit | `src/frontend/src/components/settings/AccountDeletionSection.tsx` | 3 |
