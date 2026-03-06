# Workflow: First User = Super User

## Summary
Make the first registered user automatically a super user with a dedicated setup page in the UI.

---

## Phase 1: Backend — Repository Layer
**Goal:** Add the ability to check if any users exist in the database.

### Task 1.1: Add `AnyUsersExistAsync` to `IUserRepository`
- **File:** `src/backend/Clarive.Api/Repositories/Interfaces/IUserRepository.cs`
- **Action:** Add method signature `Task<bool> AnyUsersExistAsync(CancellationToken ct = default)`

### Task 1.2: Implement in `EfUserRepository`
- **File:** `src/backend/Clarive.Api/Repositories/EfCore/EfUserRepository.cs`
- **Action:** Implement using `db.Users.IgnoreQueryFilters().AnyAsync(ct)` to bypass tenant scoping

**Checkpoint:** `dotnet build` passes

---

## Phase 2: Backend — Service Layer
**Goal:** Auto-promote first user to super user with auto-verified email.

### Task 2.1: Modify `CreateUserWithPersonalWorkspaceAsync`
- **File:** `src/backend/Clarive.Api/Services/AccountService.cs`
- **Action:** Add `bool isSuperUser = false` parameter, set `IsSuperUser = isSuperUser` on user creation

### Task 2.2: Modify `RegisterAsync`
- **File:** `src/backend/Clarive.Api/Services/AccountService.cs`
- **Action:** Before creating user, check `!await userRepo.AnyUsersExistAsync(ct)`. If true:
  - Pass `emailVerified: true` and `isSuperUser: true` to `CreateUserWithPersonalWorkspaceAsync`
  - Skip verification token generation (wrap existing token logic in `if (!isFirstUser)`)
- **Depends on:** Task 1.1, 1.2, 2.1

**Checkpoint:** `dotnet build` passes

---

## Phase 3: Backend — Endpoint Layer
**Goal:** Expose setup status and adjust registration endpoint behavior.

### Task 3.1: Add `HandleSetupStatus` endpoint
- **File:** `src/backend/Clarive.Api/Endpoints/AuthEndpoints.cs`
- **Action:** Add `GET /api/auth/setup-status` (anonymous, no rate limiting needed)
  - Inject `IUserRepository`, call `AnyUsersExistAsync`, return `{ isSetupComplete: true/false }`
  - Register in `MapAuthEndpoints` with `.AllowAnonymous()`

### Task 3.2: Modify `HandleRegister` to skip verification email for first user
- **File:** `src/backend/Clarive.Api/Endpoints/AuthEndpoints.cs`
- **Action:** After `RegisterAsync`, check `result.User.IsSuperUser`. If true, skip the verification email fire-and-forget block. The `RawVerificationToken` will be `null` for first user (from Task 2.2).
- **Depends on:** Task 2.2

### Task 3.3: Update `RegisterResult` to allow null verification token
- **File:** `src/backend/Clarive.Api/Models/Results/RegisterResult.cs` (or wherever defined)
- **Action:** Change `RawVerificationToken` from `string` to `string?`
- **Depends on:** Task 2.2

**Checkpoint:** `dotnet build` passes, `dotnet test` in UnitTests passes

---

## Phase 4: Frontend — API Service
**Goal:** Add setup status check to the auth service.

### Task 4.1: Add `getSetupStatus` function
- **File:** `src/frontend/src/services/api/authService.ts`
- **Action:** Add:
  ```typescript
  export async function getSetupStatus(): Promise<{ isSetupComplete: boolean }> {
    return api.get<{ isSetupComplete: boolean }>("/api/auth/setup-status");
  }
  ```

### Task 4.2: Export from services index (if needed)
- **File:** `src/frontend/src/services/index.ts`
- **Action:** Verify `authService` is already re-exported (it is)

**Checkpoint:** `npm run lint` passes

---

## Phase 5: Frontend — Setup Page
**Goal:** Create the branded setup wizard page.

### Task 5.1: Create `SetupPage.tsx`
- **File:** `src/frontend/src/pages/SetupPage.tsx` (new)
- **Action:** Create branded setup wizard:
  - Reuse: `AnvilIcon`, `PasswordStrengthBar`, `registerSchema`, shadcn form components
  - Layout: centered card matching login/register style (`auth-bg`, `bg-surface/80`, etc.)
  - Header: `ShieldCheck` icon + "Set Up Your Instance" + admin messaging
  - Info callout explaining super admin privileges
  - Form: Name, Email, Password, Confirm Password (no Google OAuth)
  - Submit: calls `authService.register()`, navigates to `/` on success
  - No "check your email" toast (email is auto-verified)
  - If already authenticated, redirect to `/`
- **Depends on:** Task 4.1

**Checkpoint:** `npm run lint` passes

---

## Phase 6: Frontend — Routing & Guards
**Goal:** Wire up setup routing with automatic redirects.

### Task 6.1: Add `SetupGuard` and `/setup` route to `App.tsx`
- **File:** `src/frontend/src/App.tsx`
- **Action:**
  - Lazy-import `SetupPage`
  - Create `SetupGuard` component (similar to `MaintenanceGuard`):
    - On mount: call `getSetupStatus()`, store in state
    - While loading: show `<LoadingSpinner />`
    - If `!isSetupComplete`: redirect `/login` and `/register` to `/setup`
    - If `isSetupComplete`: redirect `/setup` to `/login`
  - Add `<Route path="/setup" element={<SetupPage />} />` in public routes
  - Wrap public auth routes (`/login`, `/register`) with the guard logic
- **Depends on:** Task 4.1, 5.1

**Checkpoint:** `npm run lint` passes, `npx vitest --run` passes

---

## Phase 7: Verification

### Task 7.1: Backend build + tests
```bash
cd src/backend && dotnet build
cd tests/backend/Clarive.Api.UnitTests && dotnet test
cd tests/backend/Clarive.Api.IntegrationTests && dotnet test
```

### Task 7.2: Frontend lint + tests
```bash
cd src/frontend && npm run lint
cd src/frontend && npx vitest --run
```

### Task 7.3: Manual end-to-end test
```bash
make db-reset && make dev-all
```
1. Visit `http://localhost:8080/login` -> should redirect to `/setup`
2. Visit `http://localhost:8080/register` -> should redirect to `/setup`
3. Fill setup form -> create admin account
4. Verify: lands on home page, sidebar shows "Super Admin" link
5. Visit `http://localhost:8080/setup` -> should redirect to `/login`
6. Register a second user -> should be normal flow (not super user)

---

## Dependency Graph

```
1.1 ──┐
      ├── 2.1 ── 2.2 ── 3.2
1.2 ──┘              └── 3.3
                 3.1 (independent)
                 4.1 ── 5.1 ── 6.1
```

## Execution Order
1. Tasks 1.1 + 1.2 (parallel)
2. Task 2.1
3. Tasks 2.2 + 3.1 (parallel — 3.1 is independent)
4. Tasks 3.2 + 3.3 (parallel)
5. Task 4.1
6. Task 5.1
7. Task 6.1
8. Verification (Phase 7)
