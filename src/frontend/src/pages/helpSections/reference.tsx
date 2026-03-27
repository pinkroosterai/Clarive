import { Blocks, FileText, Globe, Key, Keyboard, Settings, ShieldCheck } from 'lucide-react';

import type { SectionGroup } from './shared';
import { Code, Kbd } from './shared';

export const referenceGroup: SectionGroup = {
  label: 'Reference',
  sections: [
    {
      id: 'super-admin',
      icon: ShieldCheck,
      title: 'Super Admin',
      searchText:
        'super admin dashboard usage analytics users ai providers models settings logs jobs background maintenance mode system configuration email smtp resend google oauth',
      plainTextContent:
        'Manage your entire Clarive instance from the Super Admin area. Monitor platform health, track AI usage, manage users, configure AI providers, adjust system settings, view logs, and control background jobs. Access it from the user menu.',
      searchAliases: ['admin settings', 'manage users', 'configure AI providers'],
      content: (
        <div className="space-y-3">
          <p>
            Manage your entire Clarive instance from the Super Admin area. Access it from the user
            menu in the top-right corner.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Monitor platform health</h4>
          <p>
            The dashboard shows total users, entries, and AI sessions with 7-day change indicators.
            Additional metrics cover user verification rates, workspace counts, published vs.
            unpublished entries, and active API keys.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Track AI usage</h4>
          <p>
            View AI usage analytics with date filtering, summary cards, and charts. Expand any row
            in the log grid to see full request and response details.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Manage users</h4>
          <p>
            View all platform users, reset passwords, and delete accounts from the Users section.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Configure AI providers</h4>
          <p>
            Connect AI providers (OpenAI, Anthropic, or any OpenAI-compatible endpoint). Add
            providers, fetch available models, assign models to actions (generation, evaluation,
            system messages), and set per-model defaults. A warning banner appears when changes need
            a server restart.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Adjust system settings</h4>
          <p>
            Configure authentication (Google OAuth, registration toggle), email provider (SMTP,
            Resend, or console), application branding, and <strong>maintenance mode</strong> to
            temporarily disable access for non-admin users.
          </p>
          <h4 className="text-sm font-semibold text-foreground">View logs</h4>
          <p>
            Browse system-level logs with filtering and search. Expand any entry for full details.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Control background jobs</h4>
          <p>
            Monitor jobs like trash cleanup and audit log pruning. Each job shows its schedule,
            status, timing, and duration. Select a job to <strong>Trigger Now</strong>,{' '}
            <strong>Pause</strong>, or <strong>Resume</strong> it. Expand any job for its execution
            history.
          </p>
        </div>
      ),
    },
    {
      id: 'api-keys',
      icon: Key,
      title: 'API Keys',
      searchText:
        'api key programmatic rest api admin create copy store x-api-key header revoke regenerate cl_',
      plainTextContent:
        'Access Clarive programmatically with API keys. Only workspace admins can create them. Create a key from Settings > API Keys, set an optional expiration, copy it immediately (shown once), and pass it in the X-Api-Key header. Revoke keys instantly from the settings tab.',
      searchAliases: ['create api key', 'api authentication', 'programmatic access'],
      relatedSections: ['public-api', 'sdks'],
      content: (
        <div className="space-y-3">
          <p>
            Access Clarive programmatically through the REST API using API keys. Only workspace
            admins can create and manage them.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Create a key</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to <strong>Settings &gt; API Keys</strong>.
            </li>
            <li>
              Click <strong>Create API Key</strong> and give it a descriptive name.
            </li>
            <li>
              Set an <strong>expiration</strong> — choose 30 days, 60 days, 90 days, 6 months, 1
              year, or no expiration.
            </li>
            <li>Copy the key immediately — it&apos;s shown only once.</li>
          </ol>
          <h4 className="text-sm font-semibold text-foreground">Use your key</h4>
          <p>
            Include the key in the <Code>X-Api-Key</Code> header with every request:
          </p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
            X-Api-Key: your-api-key-here
          </p>
          <h4 className="text-sm font-semibold text-foreground">Revoke a key</h4>
          <p>
            Revoke any key from the API Keys settings tab — it stops working immediately. Keys
            can&apos;t be regenerated; create a new one instead.
          </p>
        </div>
      ),
    },
    {
      id: 'public-api',
      icon: Globe,
      title: 'Public API',
      searchText:
        'public api fetch render published prompts get post entries generate template fields validation authentication x-api-key curl json error 401 404 422 429 rate limit list search tags pagination openapi tabs variants tab-aware variant testing',
      plainTextContent:
        'Fetch and render published prompts via the REST API. List entries with search, tag, and pagination filters. Get entries and tabs by ID. Generate rendered prompts by substituting template variables. All endpoints require an API key. Rate-limited to 600 requests per minute. OpenAPI spec available at /public/v1/openapi.json.',
      searchAliases: ['rest api endpoints', 'api documentation', 'curl examples'],
      relatedSections: ['api-keys', 'sdks'],
      content: (
        <div className="space-y-3">
          <p>
            Fetch and render published prompts programmatically. Access tabs (working variants) for
            A/B testing and CI/CD workflows. All requests require an API key (see{' '}
            <strong>API Keys</strong> above).
          </p>

          <h4 className="text-sm font-semibold text-foreground">Authentication</h4>
          <p>
            Include your API key in every request via the <Code>X-Api-Key</Code> header. Keys use
            the format <Code>cl_...</Code>.
          </p>

          <h4 className="text-sm font-semibold text-foreground">Base URL</h4>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
            /public/v1
          </p>

          <h4 className="text-sm font-semibold text-foreground">GET /public/v1/entries</h4>
          <p>
            List all published entries in your workspace with optional filtering, search, and
            pagination.
          </p>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Parameter</th>
                  <th className="text-left p-2 font-semibold text-foreground">Type</th>
                  <th className="text-left p-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2 font-mono">search</td>
                  <td className="p-2">string</td>
                  <td className="p-2">Filter by title (case-insensitive)</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">folderId</td>
                  <td className="p-2">UUID</td>
                  <td className="p-2">Filter by folder</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">tags</td>
                  <td className="p-2">string</td>
                  <td className="p-2">Comma-separated tag names</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">tagMode</td>
                  <td className="p-2">string</td>
                  <td className="p-2">
                    <Code>and</Code> or <Code>or</Code> (default: <Code>or</Code>)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">sortBy</td>
                  <td className="p-2">string</td>
                  <td className="p-2">
                    <Code>recent</Code>, <Code>alphabetical</Code>, or <Code>oldest</Code>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">page</td>
                  <td className="p-2">int</td>
                  <td className="p-2">Page number (default: 1)</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">pageSize</td>
                  <td className="p-2">int</td>
                  <td className="p-2">Items per page (default: 50, max: 100)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -H "X-Api-Key: cl_your_key_here" \\
  "https://your-domain/public/v1/entries?search=email&tags=marketing&page=1"`}
          </p>
          <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`{
  "items": [
    {
      "id": "a1b2c3d4-...",
      "title": "Email Writer",
      "version": 3,
      "hasSystemMessage": true,
      "isTemplate": true,
      "isChain": false,
      "promptCount": 1,
      "firstPromptPreview": "Write a {{tone}} email to {{recipient}}.",
      "tags": ["marketing", "email"],
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-03-10T14:22:00Z",
      "tabs": [
        { "id": "t1b2c3d4-...", "name": "Main", "isMainTab": true, "forkedFromVersion": null },
        { "id": "t5e6f7a8-...", "name": "Experiment A", "isMainTab": false, "forkedFromVersion": 2 }
      ],
      "tabCount": 2
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 50
}`}
          </pre>

          <h4 className="text-sm font-semibold text-foreground">
            GET /public/v1/entries/{'{entryId}'}
          </h4>
          <p>Fetch the published version of an entry, including its template field definitions.</p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -H "X-Api-Key: cl_your_key_here" \\
  https://your-domain/public/v1/entries/{entryId}`}
          </p>
          <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`{
  "id": "a1b2c3d4-...",
  "title": "Email Writer",
  "systemMessage": "You are a professional writer.",
  "version": 3,
  "prompts": [
    {
      "content": "Write a {{tone}} email to {{recipient}}.",
      "order": 0,
      "isTemplate": true,
      "templateFields": [
        {
          "name": "tone",
          "type": "enum",
          "enumValues": ["formal", "casual"],
          "defaultValue": null
        },
        {
          "name": "recipient",
          "type": "string",
          "defaultValue": null
        }
      ]
    }
  ],
  "tags": ["marketing", "email"],
  "updatedAt": "2026-03-10T14:22:00Z",
  "publishedAt": "2026-03-10T14:22:00Z",
  "tabs": [
    { "id": "t1b2c3d4-...", "name": "Main", "isMainTab": true, "forkedFromVersion": null }
  ],
  "tabCount": 1
}`}
          </pre>

          <h4 className="text-sm font-semibold text-foreground">
            POST /public/v1/entries/{'{entryId}'}/generate
          </h4>
          <p>
            Render a published entry by substituting template variables with the values you provide.
            All field values are passed as strings.
          </p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -X POST \\
  -H "X-Api-Key: cl_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"fields":{"tone":"formal","recipient":"Jane"}}' \\
  https://your-domain/public/v1/entries/{entryId}/generate`}
          </p>
          <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`{
  "id": "a1b2c3d4-...",
  "title": "Email Writer",
  "version": 3,
  "systemMessage": "You are a professional writer.",
  "renderedPrompts": [
    {
      "content": "Write a formal email to Jane.",
      "order": 0
    }
  ]
}`}
          </pre>

          <h4 className="text-sm font-semibold text-foreground">
            GET /public/v1/entries/{'{entryId}'}/tabs
          </h4>
          <p>
            List all tabs (working variants) for an entry. Each tab includes its name, ID, and
            whether it&apos;s the main tab. Use this to discover available variants for testing or
            CI/CD workflows.
          </p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -H "X-Api-Key: cl_your_key_here" \\
  https://your-domain/public/v1/entries/{entryId}/tabs`}
          </p>
          <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`[
  {
    "id": "t1b2c3d4-...",
    "name": "Main",
    "isMainTab": true,
    "forkedFromVersion": null
  },
  {
    "id": "t5e6f7a8-...",
    "name": "Experiment A",
    "isMainTab": false,
    "forkedFromVersion": 2
  }
]`}
          </pre>

          <h4 className="text-sm font-semibold text-foreground">
            GET /public/v1/entries/{'{entryId}'}/tabs/{'{tabId}'}
          </h4>
          <p>
            Fetch the full content of a specific tab, including its system message, prompts,
            template fields, and tags. The response shape matches the entry detail endpoint.
          </p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -H "X-Api-Key: cl_your_key_here" \\
  https://your-domain/public/v1/entries/{entryId}/tabs/{tabId}`}
          </p>

          <h4 className="text-sm font-semibold text-foreground">
            POST /public/v1/entries/{'{entryId}'}/tabs/{'{tabId}'}/generate
          </h4>
          <p>
            Render a tab&apos;s templates by substituting variables with the values you provide.
            Works the same as the entry generate endpoint but targets a specific tab instead of the
            published version. Useful for testing prompt variants without publishing them.
          </p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -X POST \\
  -H "X-Api-Key: cl_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"fields":{"tone":"casual","recipient":"Bob"}}' \\
  https://your-domain/public/v1/entries/{entryId}/tabs/{tabId}/generate`}
          </p>

          <h4 className="text-sm font-semibold text-foreground">GET /public/v1/tags</h4>
          <p>List all tags in your workspace with entry counts.</p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle whitespace-pre">
            {`curl -H "X-Api-Key: cl_your_key_here" \\
  https://your-domain/public/v1/tags`}
          </p>
          <p className="text-xs text-foreground-muted mt-1">Response (200):</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`[
  { "name": "marketing", "entryCount": 5 },
  { "name": "support", "entryCount": 3 }
]`}
          </pre>

          <h4 className="text-sm font-semibold text-foreground">GET /public/v1/openapi.json</h4>
          <p>Download the full OpenAPI specification for the Clarive API in JSON format.</p>

          <h4 className="text-sm font-semibold text-foreground">Template Field Types</h4>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Type</th>
                  <th className="text-left p-2 font-semibold text-foreground">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2">string</td>
                  <td className="p-2 font-sans">Must be non-empty</td>
                </tr>
                <tr>
                  <td className="p-2">int</td>
                  <td className="p-2 font-sans">Must be a valid integer; optional min/max range</td>
                </tr>
                <tr>
                  <td className="p-2">float</td>
                  <td className="p-2 font-sans">Must be a valid number; optional min/max range</td>
                </tr>
                <tr>
                  <td className="p-2">enum</td>
                  <td className="p-2 font-sans">
                    Must match one of the allowed values (case-insensitive)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="text-sm font-semibold text-foreground">Rate Limiting</h4>
          <p>
            All <Code>/public/v1/</Code> endpoints are rate-limited to{' '}
            <strong>600 requests per minute</strong> per API key. Every response includes rate limit
            headers:
          </p>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Header</th>
                  <th className="text-left p-2 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2 font-mono">X-RateLimit-Limit</td>
                  <td className="p-2">Maximum requests per window</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">X-RateLimit-Remaining</td>
                  <td className="p-2">Requests remaining in current window</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">X-RateLimit-Reset</td>
                  <td className="p-2">Unix timestamp when the window resets</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="text-sm font-semibold text-foreground">Error Responses</h4>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Status</th>
                  <th className="text-left p-2 font-semibold text-foreground">Code</th>
                  <th className="text-left p-2 font-semibold text-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2 font-mono">401</td>
                  <td className="p-2 font-mono">—</td>
                  <td className="p-2">Missing or invalid API key</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">404</td>
                  <td className="p-2 font-mono">ENTRY_NOT_FOUND</td>
                  <td className="p-2">Entry doesn&apos;t exist or is trashed</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">404</td>
                  <td className="p-2 font-mono">NOT_PUBLISHED</td>
                  <td className="p-2">Entry exists but has no published version</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">404</td>
                  <td className="p-2 font-mono">TAB_NOT_FOUND</td>
                  <td className="p-2">Tab doesn&apos;t exist or isn&apos;t a valid working tab</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">422</td>
                  <td className="p-2 font-mono">VALIDATION_ERROR</td>
                  <td className="p-2">Template field validation failed (generate only)</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">429</td>
                  <td className="p-2 font-mono">RATE_LIMITED</td>
                  <td className="p-2">Too many requests (limit: 600/min per API key)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground-muted">
            All errors return a JSON body:{' '}
            <Code>{'{{"error": {"code": "...", "message": "..."}}}'}</Code>. Validation errors
            include a <Code>details</Code> object with per-field messages.
          </p>
        </div>
      ),
    },
    {
      id: 'sdks',
      icon: Blocks,
      title: 'SDKs',
      searchText:
        'sdk client library csharp python typescript npm nuget pypi install dotnet pip package retry circuit breaker error handling',
      plainTextContent:
        'Integrate Clarive into your applications with official SDKs for C#, Python, and TypeScript. Each SDK provides typed responses, automatic retries with circuit breaker, and built-in error handling. Install via NuGet, pip, or npm.',
      searchAliases: ['client library', 'npm package', 'python sdk', 'csharp sdk'],
      relatedSections: ['api-keys', 'public-api'],
      content: (
        <div className="space-y-3">
          <p>
            Official SDKs let you integrate Clarive into your applications with typed responses,
            automatic retries, and built-in error handling. Available for C#, Python, and
            TypeScript.
          </p>

          <h4 className="text-sm font-semibold text-foreground">Installation</h4>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Language</th>
                  <th className="text-left p-2 font-semibold text-foreground">Install</th>
                  <th className="text-left p-2 font-semibold text-foreground">Runtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2">C#</td>
                  <td className="p-2 font-mono">dotnet add package ClariveSDK</td>
                  <td className="p-2">.NET 9+</td>
                </tr>
                <tr>
                  <td className="p-2">Python</td>
                  <td className="p-2 font-mono">pip install clarive-sdk</td>
                  <td className="p-2">Python 3.10+</td>
                </tr>
                <tr>
                  <td className="p-2">TypeScript</td>
                  <td className="p-2 font-mono">npm install clarive-sdk</td>
                  <td className="p-2">Node 18+</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="text-sm font-semibold text-foreground">Quick Start</h4>
          <p className="text-xs font-semibold text-foreground-muted">C#</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`var client = new ClariveClient(httpClient, new ClariveOptions { ApiKey = "cl_..." });
var entry = await client.GetEntryAsync(entryId);`}
          </pre>
          <p className="text-xs font-semibold text-foreground-muted">Python</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`async with ClariveClient(api_key="cl_...") as client:
    entry = await client.get_entry(entry_id)`}
          </pre>
          <p className="text-xs font-semibold text-foreground-muted">TypeScript</p>
          <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto">
            {`const client = new ClariveClient({ apiKey: "cl_..." });
const entry = await client.getEntry(entryId);`}
          </pre>

          <h4 className="text-sm font-semibold text-foreground">Features</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Typed errors</strong> — catch <Code>ClariveNotFoundError</Code>,{' '}
              <Code>ClariveValidationError</Code>, and <Code>ClariveRateLimitError</Code> by name
              instead of parsing status codes.
            </li>
            <li>
              <strong>Automatic retries</strong> — exponential backoff with jitter and a circuit
              breaker to avoid hammering failing services. On by default, easy to turn off.
            </li>
            <li>
              <strong>Credential safety</strong> — API keys are omitted from logs and serialization
              output.
            </li>
            <li>
              <strong>HTTPS enforced</strong> — with an opt-out for local development.
            </li>
          </ul>

          <p className="text-xs text-foreground-muted">
            Source and docs:{' '}
            <a
              href="https://github.com/pinkroosterai/ClariveSDK"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              github.com/pinkroosterai/ClariveSDK
            </a>
          </p>
        </div>
      ),
    },
    {
      id: 'keyboard-shortcuts',
      icon: Keyboard,
      title: 'Keyboard Shortcuts',
      searchText:
        'keyboard shortcuts save ctrl s publish enter undo redo bold italic strikethrough inline code cmd mac sidebar toggle playground run stop escape',
      plainTextContent:
        'Speed up your workflow with keyboard shortcuts. Save with Ctrl+S, publish with Ctrl+Enter, toggle sidebar with Ctrl+B, format text with Ctrl+B/I/E, run Playground tests with Ctrl+Enter, and stop with Escape. On macOS, use Cmd instead of Ctrl.',
      searchAliases: ['keyboard shortcuts', 'hotkeys', 'key bindings'],
      relatedSections: ['entry-editor', 'playground'],
      content: (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Editor</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Save</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Publish entry</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Undo</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>Z</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Redo</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd>
              </span>
            </div>
          </div>
          <h4 className="text-sm font-semibold text-foreground">Navigation</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Toggle sidebar</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd>
              </span>
            </div>
          </div>
          <h4 className="text-sm font-semibold text-foreground">Text Formatting</h4>
          <p className="text-xs text-foreground-muted">
            These shortcuts apply when the cursor is inside the editor.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Bold</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Italic</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>I</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Strikethrough</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>X</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Inline code</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>E</Kbd>
              </span>
            </div>
          </div>
          <h4 className="text-sm font-semibold text-foreground">Playground</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Run test</span>
              <span>
                <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Stop streaming</span>
              <span>
                <Kbd>Esc</Kbd>
              </span>
            </div>
          </div>
          <p className="text-xs text-foreground-muted">
            On macOS, use <Kbd>Cmd</Kbd> instead of <Kbd>Ctrl</Kbd>.
          </p>
        </div>
      ),
    },
    {
      id: 'trash',
      icon: FileText,
      title: 'Trash & Recovery',
      searchText:
        'trash delete 30 days permanently removed restore original folder bulk restore admin permanent deletion',
      plainTextContent:
        'Recover deleted entries from Trash. Deleted entries are kept for 30 days before automatic removal. Click Restore to return an entry to its original folder. Bulk restore multiple entries at once. Only admins can permanently delete entries. Deleting a folder moves its entries to trash individually.',
      searchAliases: ['recover deleted entry', 'restore from trash', 'permanently delete'],
      content: (
        <div className="space-y-3">
          <p>
            Deleted entries go to the Trash and are kept for <strong>30 days</strong> before
            automatic permanent removal. Click <strong>Trash</strong> in the sidebar to view them.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Preview before restoring</h4>
          <p>
            Click any deleted entry to open a <strong>preview sheet</strong> with the full content —
            helpful for deciding whether to restore it.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Restore entries</h4>
          <p>
            Click <strong>Restore</strong> to move an entry back to its original folder. If the
            folder no longer exists, the entry goes to the root level. Select multiple entries for{' '}
            <strong>bulk restore</strong>.
          </p>
          <h4 className="text-sm font-semibold text-foreground">
            What happens when you delete a folder
          </h4>
          <p>
            Deleting a folder moves all its entries to Trash individually. The folder itself is
            removed immediately.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Permanent deletion</h4>
          <p>
            Only workspace <strong>admins</strong> can permanently delete entries from Trash. This
            is immediate and <strong>cannot be undone</strong>. Entries not manually deleted are
            purged automatically after 30 days.
          </p>
        </div>
      ),
    },
    {
      id: 'account-settings',
      icon: Settings,
      title: 'Account & Settings',
      searchText:
        'profile display name email password avatar google sign-in sessions browser os ip address revoke import export yaml backup audit log events created updated published trashed restored deleted 30 days appearance theme light dark system account deletion',
      plainTextContent:
        'Manage your profile, sessions, imports, and appearance. Update your name, email, password, or avatar. View and revoke active sessions. Export entries as YAML or import from YAML files. Admins can view a 30-day audit log. Switch between Light, Dark, and System themes. Delete your account with a 30-day grace period.',
      searchAliases: ['change password', 'update profile', 'delete account', 'theme'],
      relatedSections: ['workspaces'],
      content: (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Update your profile</h4>
          <p>
            Change your display name, email, password, or avatar from{' '}
            <strong>Settings &gt; Profile</strong>. Passwords must be at least 12 characters. If you
            signed up with Google, you can set a password to enable email-based login.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Sign in with Google</h4>
          <p>
            Use Google Sign-In from the login or registration page to link your Google identity to
            your Clarive account.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Manage active sessions</h4>
          <p>
            View all active sessions under <strong>Settings &gt; Profile</strong>. Each shows
            browser, OS, IP address, and creation time. Your current session has a green{' '}
            <strong>Current</strong> badge.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Click the <strong>trash icon</strong> on any other session to revoke it individually.
              This signs that device out immediately and invalidates its refresh token.
            </li>
            <li>
              Use <strong>Revoke All Others</strong> to sign out every session except the one
              you&apos;re using right now — useful if you suspect unauthorized access.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Import and export entries</h4>
          <p>Back up your work or migrate entries between workspaces using YAML files.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Export All Entries</strong> — downloads every entry in the workspace as a
              single <Code>.yaml</Code> file named <Code>clarive-export-YYYY-MM-DD.yaml</Code>.
            </li>
            <li>
              <strong>Export Folder</strong> — opens a folder picker so you can export just one
              folder&apos;s entries.
            </li>
            <li>
              <strong>Import</strong> — drag and drop a <Code>.yaml</Code> or <Code>.yml</Code>{' '}
              file, or click to browse. Imported entries are created as <strong>unpublished</strong>{' '}
              in the workspace root. Entries with duplicate titles are imported with a numeric
              suffix. The file name and size are shown before you confirm.
            </li>
          </ul>
          <p className="text-xs text-foreground-muted">
            Exports include titles, system messages, prompt content, template variables, and tags.
            Version history and folder structure are not included.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Review the audit log</h4>
          <p>
            Admins can view a timeline of workspace activity. Each event shows the timestamp, user,
            action, and entity. Logs are retained for <strong>30 days</strong> and paginated at 20
            per page.
          </p>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Event</th>
                  <th className="text-left p-2 font-semibold text-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2 font-mono">entry_created</td>
                  <td className="p-2">A new entry was created</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">entry_draft_updated</td>
                  <td className="p-2">An entry draft was edited</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">entry_published</td>
                  <td className="p-2">An entry was published</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">entry_trashed</td>
                  <td className="p-2">An entry was moved to trash</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">entry_restored</td>
                  <td className="p-2">An entry was restored from trash</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">entry_deleted</td>
                  <td className="p-2">An entry was permanently deleted</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">version_promoted</td>
                  <td className="p-2">A version or tab was promoted</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">draft_deleted</td>
                  <td className="p-2">A draft was permanently deleted</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">api_get / api_generate</td>
                  <td className="p-2">Entry accessed or rendered via Public API</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">user_invited</td>
                  <td className="p-2">A user was invited to the workspace</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">invitation_accepted</td>
                  <td className="p-2">An invitation was accepted</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">invitation_revoked</td>
                  <td className="p-2">An invitation was canceled</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">user_role_changed</td>
                  <td className="p-2">A member&apos;s role was changed</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">member_removed</td>
                  <td className="p-2">A member was removed from the workspace</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">ownership_transferred</td>
                  <td className="p-2">Workspace ownership was transferred</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">maintenance_enabled</td>
                  <td className="p-2">Maintenance mode was turned on</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">maintenance_disabled</td>
                  <td className="p-2">Maintenance mode was turned off</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h4 className="text-sm font-semibold text-foreground">Change the theme</h4>
          <p>
            Click the theme icon in the top-right corner of the page to cycle between{' '}
            <strong>Light</strong> (sun icon), <strong>Dark</strong> (moon icon), and{' '}
            <strong>System</strong> (monitor icon) modes. System mode follows your operating
            system&apos;s preference. Your choice is saved automatically.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Delete your account</h4>
          <p>
            Permanently delete your account from the Profile tab. After requesting deletion, your
            account enters a <strong>30-day grace period</strong> during which you can cancel. After
            that, all your data is permanently removed.
          </p>
        </div>
      ),
    },
  ],
};
