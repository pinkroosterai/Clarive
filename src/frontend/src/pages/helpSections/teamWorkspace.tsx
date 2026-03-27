import { GitCompareArrows, Users, Wrench } from 'lucide-react';

import type { SectionGroup } from './shared';

export const teamWorkspaceGroup: SectionGroup = {
  label: 'Team & Workspace',
  sections: [
    {
      id: 'workspaces',
      icon: Users,
      title: 'Workspaces & Teams',
      searchText:
        'personal shared workspace team collaboration workspace switcher invite members email admin editor viewer roles leave revoke invitation bell notification',
      plainTextContent:
        'Collaborate with your team using workspaces. Every account starts with a private personal workspace. Get invited to shared workspaces for team collaboration. Switch between workspaces from the sidebar. Invite members by email. Assign roles: Admin (full control), Editor (create and publish), or Viewer (read-only). Transfer ownership to another admin (your role changes to editor).',
      searchAliases: ['how to invite team members', 'switch workspace', 'team collaboration'],
      relatedSections: ['account-settings'],
      content: (
        <div className="space-y-3">
          <p>
            Workspaces keep your team&apos;s entries, folders, and settings organized in one place.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Personal workspace</h4>
          <p>
            Every account starts with a <strong>personal workspace</strong> that&apos;s private to
            you. Everything in it — entries, folders, settings — belongs to you alone.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Shared workspaces</h4>
          <p>
            Collaborate by joining a <strong>shared workspace</strong>. Each workspace is
            independent with its own entries, folders, and settings. Switch between workspaces using
            the <strong>workspace switcher</strong> at the top of the sidebar.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Invite team members</h4>
          <p>
            Admins can invite people from <strong>Settings &gt; Users</strong>. Enter their email
            address — they&apos;ll receive an invitation and need to accept before they can access
            the workspace. You can resend or cancel pending invitations.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Accept an invitation</h4>
          <p>
            A badge on the bell icon in the sidebar means you have a pending invitation. Click it to
            accept or decline.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Understand roles</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Admin</strong> — full control over members, settings, and all entries.
            </li>
            <li>
              <strong>Editor</strong> — create, edit, and publish entries. Cannot manage members.
            </li>
            <li>
              <strong>Viewer</strong> — read-only access. Cannot create or modify content.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Leave or transfer a workspace</h4>
          <p>
            Leave any shared workspace from <strong>Settings &gt; Users</strong>. Workspace owners
            can transfer ownership to another admin using the <strong>Transfer Ownership</strong>{' '}
            option — your role changes to editor after the transfer.
          </p>
        </div>
      ),
    },
    {
      id: 'collaboration',
      icon: GitCompareArrows,
      title: 'Real-Time Collaboration',
      searchText:
        'collaboration real-time presence editing viewing soft lock conflict resolution merge save concurrent users avatar indicators override edit anyway keep mine keep theirs resolve with AI',
      plainTextContent:
        'Work on entries with your team in real time. See who is viewing or editing with presence indicators. Soft lock prevents accidental overwrites. If two people save at the same time, a conflict dialog lets you choose between versions, manually merge, or let AI resolve the conflict. Your editing state updates automatically when you switch tabs.',
      searchAliases: [
        'multi-user editing',
        'who is editing',
        'merge conflict',
        'concurrent editing',
      ],
      relatedSections: ['entry-editor', 'workspaces'],
      content: (
        <div className="space-y-3">
          <p>
            Work on entries together without losing anyone&apos;s changes. Clarive shows who else is
            viewing or editing an entry in real time.
          </p>
          <h4 className="text-sm font-semibold text-foreground">See who&apos;s here</h4>
          <p>Avatars in the editor header show other users in the same entry:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Green pencil</strong> — actively editing.
            </li>
            <li>
              <strong>Gray eye</strong> — viewing (read-only).
            </li>
          </ul>
          <p>
            Hover any avatar for their name and state. A <strong>+N</strong> badge appears when more
            than three users are present.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Soft lock</h4>
          <p>
            When another user is editing, a banner shows their name. You can still read the entry,
            but editing is soft-locked to prevent conflicts. Click <strong>Edit anyway</strong> to
            override — a confirmation dialog reminds you that simultaneous editing may cause
            conflicts when saving.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Resolve conflicts</h4>
          <p>
            If two users save overlapping changes, a conflict dialog shows each field with your
            version and the server version side by side. For each field, choose:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Keep mine</strong> — use your version.
            </li>
            <li>
              <strong>Keep theirs</strong> — use the server version.
            </li>
            <li>
              <strong>Edit merged</strong> — manually combine both in an editable area.
            </li>
            <li>
              <strong>Resolve with AI</strong> — let AI intelligently merge both versions.
            </li>
          </ul>
          <p>
            A <strong>live preview</strong> shows exactly what will be saved. Click{' '}
            <strong>Save resolved</strong> when you&apos;re satisfied.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Automatic state tracking</h4>
          <p>
            Your status updates automatically. Switch to another browser tab and Clarive marks you
            as &quot;viewing.&quot; Return, and your editing state resumes.
          </p>
        </div>
      ),
    },
    {
      id: 'tools',
      icon: Wrench,
      title: 'Tools & MCP',
      searchText:
        'tool descriptions external functions ai model name identifier add tool edit delete mcp model context protocol server import bearer token sync manage servers playground',
      plainTextContent:
        'Give AI models access to external tools and functions. Define tool descriptions manually or connect MCP (Model Context Protocol) servers to auto-sync tool definitions. Enable or disable tools per Playground run.',
      searchAliases: ['how to add tools', 'mcp server setup', 'connect mcp'],
      relatedSections: ['playground'],
      content: (
        <div className="space-y-3">
          <p>Give AI models access to external tools and functions when running your prompts.</p>
          <h4 className="text-sm font-semibold text-foreground">Add tools manually</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Go to <strong>Settings → Tools</strong>.
            </li>
            <li>
              Click <strong>Add Tool</strong> and provide a display name, identifier, and
              description.
            </li>
            <li>Edit a tool with the pencil icon, or delete with the trash icon.</li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Connect MCP servers</h4>
          <p>
            <strong>MCP (Model Context Protocol) servers</strong> automatically sync tool
            definitions to your workspace. In <strong>Settings → Tools</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Add Server</strong> — provide a name, URL, and optional bearer token. Tools
              sync automatically.
            </li>
            <li>
              <strong>Sync</strong> — click the refresh button to re-sync. Each card shows tool
              count, last sync time, and any errors.
            </li>
            <li>
              <strong>Remove</strong> — removes the server and all its synced tools.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Use tools in the Playground</h4>
          <p>
            When testing prompts, use the toolbar dropdown to enable or disable MCP servers and
            individual tools per run. Only enabled tools are sent to the AI model.
          </p>
        </div>
      ),
    },
  ],
};
