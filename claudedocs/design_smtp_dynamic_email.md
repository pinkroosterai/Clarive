# Design: SMTP Email Provider & Dynamic Email Settings Form

## 1. Backend Changes

### 1.1 New Settings Record: `SmtpSettings`

**File**: `src/backend/Clarive.Api/Services/SmtpSettings.cs` (NEW)

```csharp
namespace Clarive.Api.Services;

public record SmtpSettings
{
    public string Host { get; init; } = "";
    public int Port { get; init; } = 587;
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
    public bool UseTls { get; init; } = true;
}
```

Bound from config section `Email:Smtp*` keys. Read via `IConfiguration` at send time (no options binding needed since we read individual keys).

### 1.2 New Service: `SmtpEmailService`

**File**: `src/backend/Clarive.Api/Services/SmtpEmailService.cs` (NEW)

Implements `IEmailService`. Uses **MailKit** (`MailKit` NuGet package).

```csharp
public class SmtpEmailService(
    IConfiguration configuration,
    IOptions<EmailSettings> settings,
    ILogger<SmtpEmailService> logger) : IEmailService
```

**Design decisions**:
- Reads SMTP credentials from `IConfiguration` at each send (hot-reloadable via `DbConfigurationProvider`)
- Uses `EmailSettings.FromAddress` / `FromName` for the sender (shared with Resend)
- 30-second connect + send timeout
- `SecureSocketOptions.StartTls` when `UseTls` is true, `Auto` otherwise
- All 6 `IEmailService` methods follow the same pattern: build `MimeMessage`, connect, authenticate, send, disconnect

**Send pattern** (shared helper):
```csharp
private async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct)
{
    var host = configuration["Email:SmtpHost"] ?? "";
    var port = int.TryParse(configuration["Email:SmtpPort"], out var p) ? p : 587;
    var username = configuration["Email:SmtpUsername"] ?? "";
    var password = configuration["Email:SmtpPassword"] ?? "";
    var useTls = !string.Equals(configuration["Email:SmtpUseTls"], "false", StringComparison.OrdinalIgnoreCase);

    var message = new MimeMessage();
    message.From.Add(new MailboxAddress(settings.Value.FromName, settings.Value.FromAddress));
    message.To.Add(MailboxAddress.Parse(to));
    message.Subject = subject;
    message.Body = new TextPart("html") { Text = htmlBody };

    using var client = new MailKit.Net.Smtp.SmtpClient();
    client.Timeout = 30_000;
    var tlsOption = useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;
    await client.ConnectAsync(host, port, tlsOption, ct);

    if (!string.IsNullOrEmpty(username))
        await client.AuthenticateAsync(username, password, ct);

    await client.SendAsync(message, ct);
    await client.DisconnectAsync(true, ct);
}
```

### 1.3 Extended `ConfigDefinition` with `VisibleWhen`

**File**: `src/backend/Clarive.Api/Services/ConfigRegistry.cs`

Add a new record for conditional visibility:

```csharp
public record ConfigVisibleWhen(string Key, string[] Values);
```

Extend `ConfigDefinition`:
```csharp
public record ConfigDefinition(
    string Key, string Label, string Description,
    ConfigSection Section, bool IsSecret, bool RequiresRestart,
    string? ValidationHint = null,
    ConfigInputType InputType = ConfigInputType.Text,
    string[]? SelectOptions = null,
    string? SubGroup = null,
    ConfigVisibleWhen? VisibleWhen = null);
```

### 1.4 Updated Config Registry Entries

**Email:Provider** — add `"smtp"` to SelectOptions:
```csharp
new ConfigDefinition("Email:Provider", "Email Provider",
    "Email delivery provider. Requires restart to switch between providers.",
    ConfigSection.Email, false, true,
    SubGroup: "Provider",
    InputType: ConfigInputType.Select, SelectOptions: ["console", "resend", "smtp"]),
```

**Email:ApiKey** — add VisibleWhen:
```csharp
new ConfigDefinition("Email:ApiKey", "Email API Key (Resend)",
    "API key for the Resend email service. Only needed when provider is 'resend'.",
    ConfigSection.Email, true, false,
    "re_...",
    SubGroup: "Provider",
    VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend"])),
```

**New SMTP entries** (all in SubGroup "SMTP Server", all with `VisibleWhen: smtp`):

| Key | Label | IsSecret | RequiresRestart | InputType | ValidationHint | VisibleWhen |
|-----|-------|----------|-----------------|-----------|----------------|-------------|
| `Email:SmtpHost` | SMTP Host | false | false | Text | e.g., smtp.gmail.com | Email:Provider = smtp |
| `Email:SmtpPort` | SMTP Port | false | false | Number | Default: 587 | Email:Provider = smtp |
| `Email:SmtpUsername` | SMTP Username | false | false | Text | (none) | Email:Provider = smtp |
| `Email:SmtpPassword` | SMTP Password | true | false | (password) | (none) | Email:Provider = smtp |
| `Email:SmtpUseTls` | Use TLS | false | false | Select [true, false] | (none) | Email:Provider = smtp |

**Email:FromAddress** / **Email:FromName** — add VisibleWhen for both resend and smtp:
```csharp
VisibleWhen: new ConfigVisibleWhen("Email:Provider", ["resend", "smtp"])
```

### 1.5 Extended `ConfigSettingResponse`

**File**: `src/backend/Clarive.Api/Models/Responses/ConfigSettingResponse.cs`

Add `VisibleWhen` field:
```csharp
public record ConfigSettingResponse(
    // ... existing fields ...
    string? SubGroup,
    ConfigVisibleWhenResponse? VisibleWhen);

public record ConfigVisibleWhenResponse(string Key, string[] Values);
```

### 1.6 Updated `HandleGetAll` in `ConfigEndpoints.cs`

Pass `VisibleWhen` through:
```csharp
VisibleWhen: def.VisibleWhen is not null
    ? new ConfigVisibleWhenResponse(def.VisibleWhen.Key, def.VisibleWhen.Values)
    : null
```

### 1.7 DI Registration in `Program.cs`

Add third branch for SMTP:
```csharp
if (string.Equals(emailProvider, "resend", StringComparison.OrdinalIgnoreCase))
{
    // ... existing Resend registration ...
}
else if (string.Equals(emailProvider, "smtp", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddScoped<IEmailService, SmtpEmailService>();
    Log.Information("Email provider: SMTP");
}
else
{
    builder.Services.AddScoped<IEmailService, ConsoleEmailService>();
    Log.Information("Email provider: Console (default)");
}
```

### 1.8 NuGet Package

Add `MailKit` to `Clarive.Api.csproj`:
```xml
<PackageReference Include="MailKit" Version="4.*" />
```

---

## 2. Frontend Changes

### 2.1 Extended `ConfigSetting` Type

**File**: `src/frontend/src/services/api/configService.ts`

```typescript
export interface ConfigVisibleWhen {
  key: string;
  values: string[];
}

export interface ConfigSetting {
  // ... existing fields ...
  visibleWhen: ConfigVisibleWhen | null;
}
```

### 2.2 Dynamic Visibility in `ConfigSectionForm`

**File**: `src/frontend/src/components/super/ConfigSectionForm.tsx`

The form already manages `dirtyValues` state. We need to determine field visibility based on the **effective value** of the dependency key (dirty value takes precedence over server value).

**Core logic** — new helper inside `ConfigSectionForm`:
```typescript
function getEffectiveValue(key: string): string | null {
  if (dirtyValues[key] !== undefined) return dirtyValues[key];
  const setting = settings.find(s => s.key === key);
  return setting?.value ?? null;
}

function isVisible(setting: ConfigSetting): boolean {
  if (!setting.visibleWhen) return true;
  const effectiveValue = getEffectiveValue(setting.visibleWhen.key);
  return setting.visibleWhen.values.includes(effectiveValue ?? "");
}
```

**Rendering change**: Filter settings through `isVisible` before rendering. Hidden fields are excluded from the form — their dirty values are cleared when they become hidden (to avoid saving values for a provider that isn't selected).

```typescript
// When provider changes, clear dirty values for now-hidden fields
useEffect(() => {
  setDirtyValues(prev => {
    const next = { ...prev };
    for (const setting of settings) {
      if (!isVisible(setting) && next[setting.key] !== undefined) {
        delete next[setting.key];
      }
    }
    return next;
  });
}, [dirtyValues["Email:Provider"], settings]);
```

### 2.3 No Changes to `SuperDashboardPage`

The Email tab already renders `ConfigSectionForm` for the email section. The dynamic visibility is handled entirely within `ConfigSectionForm` via the `visibleWhen` metadata — no special-case rendering needed.

---

## 3. Data Flow

```
User selects "smtp" in Email:Provider dropdown
  │
  ├─► ConfigSectionForm updates dirtyValues["Email:Provider"] = "smtp"
  │
  ├─► isVisible() re-evaluates all fields:
  │     Email:ApiKey        → hidden (visibleWhen: resend only)
  │     Email:SmtpHost      → visible (visibleWhen: smtp)
  │     Email:SmtpPort      → visible
  │     Email:SmtpUsername   → visible
  │     Email:SmtpPassword   → visible
  │     Email:SmtpUseTls    → visible
  │     Email:FromAddress   → visible (visibleWhen: resend, smtp)
  │     Email:FromName      → visible (visibleWhen: resend, smtp)
  │
  ├─► User fills in SMTP fields and clicks Save
  │
  ├─► handleSave() sends PUT for each dirty key
  │     (Email:Provider requires restart → banner shown)
  │
  └─► On next restart, Program.cs reads Email:Provider = "smtp"
        → registers SmtpEmailService
        → reads SMTP config from IConfiguration at send time
```

---

## 4. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `Services/SmtpSettings.cs` | CREATE | Settings record (for documentation, not bound via IOptions) |
| `Services/SmtpEmailService.cs` | CREATE | IEmailService implementation using MailKit |
| `Services/ConfigRegistry.cs` | MODIFY | Add VisibleWhen record, SMTP config entries, update existing entries |
| `Models/Responses/ConfigSettingResponse.cs` | MODIFY | Add VisibleWhen field + response record |
| `Endpoints/ConfigEndpoints.cs` | MODIFY | Pass VisibleWhen in HandleGetAll |
| `Program.cs` | MODIFY | Add SMTP DI branch |
| `Clarive.Api.csproj` | MODIFY | Add MailKit package |
| `configService.ts` | MODIFY | Add visibleWhen to types |
| `ConfigSectionForm.tsx` | MODIFY | Add visibility logic + cleanup of hidden dirty values |

---

## 5. Design Decisions

1. **MailKit over System.Net.Mail**: MailKit is the recommended .NET SMTP library — better TLS support, async API, actively maintained. `System.Net.SmtpClient` is deprecated.

2. **No IOptions binding for SMTP**: Since we want hot-reload of credentials, reading directly from `IConfiguration` at send time is simpler than setting up `IOptionsMonitor<SmtpSettings>` + change callbacks. The `IConfiguration` is already kept live by `DbConfigurationProvider`.

3. **Metadata-driven visibility**: The `VisibleWhen` condition lives in `ConfigDefinition` on the backend, not hardcoded in the frontend. This means future conditional fields (for any section) work automatically without frontend changes.

4. **Provider switch still requires restart**: Changing `Email:Provider` changes which `IEmailService` implementation is registered in DI — this is a startup-time decision. Individual provider settings (host, port, credentials) are hot-reloadable.

5. **SubGroup for SMTP fields**: SMTP fields use SubGroup "SMTP Server" for visual grouping, separate from the "Provider" subgroup (which contains provider selection + Resend API key).

6. **Clean hidden dirty values**: When a provider change hides fields, their pending dirty values are cleared. This prevents accidentally saving SMTP credentials when switching to Resend.
