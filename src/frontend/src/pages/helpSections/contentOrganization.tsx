import { Braces, FolderTree, Search, Share2, Star } from 'lucide-react';

import type { SectionGroup } from './shared';
import { Code, Kbd } from './shared';

export const contentOrganizationGroup: SectionGroup = {
  label: 'Content & Organization',
  sections: [
    {
      id: 'templates',
      icon: Braces,
      title: 'Templates & Variables',
      searchText:
        'template variables curly braces placeholder type string int float enum constraints default value description popover insert variable syntax form preview rendered output',
      plainTextContent:
        'Turn prompts into reusable templates with variables. Wrap any word in double curly braces to create a placeholder. Set variable types (string, int, float, enum), constraints, defaults, and descriptions. Preview rendered output with values substituted. Full syntax: name|type:constraints:default:description.',
      searchAliases: ['how to use variables', 'template syntax', 'dynamic placeholders'],
      relatedSections: ['entry-editor', 'playground'],
      content: (
        <div className="space-y-3">
          <p>
            Turn any prompt into a reusable template by adding variables. Wrap a word in double
            curly braces — like <Code>{'{{topic}}'}</Code> — and it becomes a placeholder that gets
            filled in each time the prompt runs.
          </p>

          <h4 className="text-sm font-semibold text-foreground">Add and edit variables</h4>
          <p>
            Type variables directly, or click the <strong>{'{ }'} button</strong> on any prompt card
            to insert one. Click any highlighted variable to set its name, type, constraints,
            default value, and description — no syntax to memorize.
          </p>

          <h4 className="text-sm font-semibold text-foreground">Variable types</h4>
          <div className="bg-elevated rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-semibold text-foreground">Type</th>
                  <th className="text-left p-2 font-semibold text-foreground">Syntax</th>
                  <th className="text-left p-2 font-semibold text-foreground">Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="p-2">string</td>
                  <td className="p-2">{'{{topic}}'}</td>
                  <td className="p-2 font-sans">Text input (default)</td>
                </tr>
                <tr>
                  <td className="p-2">int</td>
                  <td className="p-2">{'{{count|int:1-100}}'}</td>
                  <td className="p-2 font-sans">Integer with min/max range</td>
                </tr>
                <tr>
                  <td className="p-2">float</td>
                  <td className="p-2">{'{{temp|float:0-1.5}}'}</td>
                  <td className="p-2 font-sans">Decimal with min/max range</td>
                </tr>
                <tr>
                  <td className="p-2">enum</td>
                  <td className="p-2">{'{{tone|enum:formal,casual}}'}</td>
                  <td className="p-2 font-sans">Dropdown with fixed options</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 className="text-sm font-semibold text-foreground">Set defaults and descriptions</h4>
          <p>Add a default value and description after the constraints, separated by colons:</p>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
            {'{{tone|enum:formal,casual:formal:The writing style}}'}
          </p>
          <p>
            The default pre-fills the form field. The description appears as a hint below it. Both
            are optional.
          </p>

          <h4 className="text-sm font-semibold text-foreground">Full syntax reference</h4>
          <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
            {'{{name|type:constraints:default:description}}'}
          </p>
          <p className="text-xs text-foreground-muted">
            Everything after the name is optional. Names can contain letters, digits, and
            underscores. If a name appears in multiple prompts, the first occurrence sets the type.
          </p>

          <h4 className="text-sm font-semibold text-foreground">Preview your template</h4>
          <p>
            When your prompt contains variables, a <strong>Template Variables</strong> form appears
            below the editor. Fill in values and click <strong>Preview</strong> to see the rendered
            output with your values substituted in.
          </p>
        </div>
      ),
    },
    {
      id: 'library',
      icon: Search,
      title: 'Library & Search',
      searchText:
        'library browse grid search filter status unpublished published sort recent alphabetical oldest tags any all pagination 50 entries per page',
      plainTextContent:
        'Find and browse all your entries in the library. Search by title, filter by status (published or unpublished) and tags, and sort by date or name. The library shows 50 entries per page in a responsive grid. Click any entry to open it in the editor.',
      searchAliases: ['how to find prompts', 'search entries', 'filter by tag'],
      relatedSections: ['folders', 'favorites'],
      content: (
        <div className="space-y-3">
          <p>
            The library shows all entries in your workspace as a responsive grid. Click any entry
            card to open it in the editor.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Search by title</h4>
          <p>
            Type in the search bar to filter entries by title. Results update as you type. The
            result count appears inline when filters are active.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Filter and sort</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Status</strong> — show All, Unpublished, or Published entries.
            </li>
            <li>
              <strong>Sort</strong> — order by Recent (default), Alphabetical, or Oldest.
            </li>
            <li>
              <strong>Tags</strong> — select one or more tags. With multiple tags selected, toggle
              between <strong>Any</strong> (match at least one) and <strong>All</strong> (match
              every tag).
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Pagination</h4>
          <p>
            The library shows 50 entries per page. Use the Previous/Next buttons to navigate.
            Changing any filter resets to page one.
          </p>
        </div>
      ),
    },
    {
      id: 'favorites',
      icon: Star,
      title: 'Favorites',
      searchText: 'star favorite entry card dashboard timestamp unstar',
      plainTextContent:
        'Bookmark your most-used entries by starring them. Star entries from the library, the editor, or the dashboard. Starred entries appear in a Favorites panel on your dashboard for quick access. Favorites are per-workspace — starring in one workspace does not affect others.',
      searchAliases: ['how to bookmark prompts', 'star entries', 'quick access'],
      relatedSections: ['library'],
      content: (
        <div className="space-y-3">
          <p>
            Bookmark your most-used entries by starring them. Starred entries appear in the{' '}
            <strong>Favorites</strong> panel on your dashboard for quick access.
          </p>
          <h4 className="text-sm font-semibold text-foreground">How to star an entry</h4>
          <p>
            Click the <strong>star icon</strong> on any entry card in the library. Click again to
            remove it. You can also star and unstar from:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              The <strong>editor title bar</strong> — star while editing without leaving the page.
            </li>
            <li>
              The <strong>dashboard Favorites panel</strong> — click to unstar directly.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Dashboard Favorites panel</h4>
          <p>
            When you have starred entries, the dashboard shows a Favorites panel with clickable
            links to each entry and timestamps showing when you favorited them.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Good to know</h4>
          <p>
            Favorites are <strong>per-workspace</strong>. Starring an entry in one workspace does
            not affect other workspaces. There is no limit on how many entries you can star.
          </p>
        </div>
      ),
    },
    {
      id: 'folders',
      icon: FolderTree,
      title: 'Folders & Organization',
      searchText:
        'folder tree sidebar new folder subfolder rename delete nest drag drop entries reorganize search breadcrumb color undo',
      plainTextContent:
        'Organize your entries with folders in the sidebar. Create folders and subfolders, assign colors for quick identification, and drag entries or folders to reorganize. Search folders by name and navigate with breadcrumbs. Undo accidental moves with the undo notification.',
      searchAliases: ['how to organize prompts', 'create folder', 'move entries'],
      relatedSections: ['library'],
      content: (
        <div className="space-y-3">
          <p>Keep your entries organized with the folder tree in the sidebar.</p>
          <h4 className="text-sm font-semibold text-foreground">Create and manage folders</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Click <strong>New folder</strong> at the bottom of the folder tree to create a
              root-level folder.
            </li>
            <li>
              Hover a folder and click the <strong>three-dot menu</strong> to add a subfolder,
              rename, delete, or assign a color.
            </li>
            <li>Nest folders as deep as you need.</li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Color-code folders</h4>
          <p>
            Assign a color from six presets via the three-dot menu. The color appears as a dot next
            to the folder name for quick visual identification. Select <strong>None</strong> to
            remove a color.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Search and navigate</h4>
          <p>
            Use the <strong>search box</strong> at the top to filter folders by name. When viewing
            nested folders, a <strong>breadcrumb trail</strong> shows the full path so you can
            navigate back to any parent with one click.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Drag and drop</h4>
          <p>
            Drag entries between folders or drag folders to reorganize your structure. Folders
            expand automatically when you hover during a drag. Moved something by mistake? An{' '}
            <strong>undo notification</strong> appears so you can reverse it immediately.
          </p>
        </div>
      ),
    },
    {
      id: 'share-links',
      icon: Share2,
      title: 'Share Links',
      searchText:
        'share link public read-only access password protect expiration copy revoke regenerate manage share link viewer token',
      plainTextContent:
        'Share a read-only view of any published prompt with anyone — no Clarive account required. Optionally set an expiration date and password. Manage existing links by copying, regenerating, or revoking them. Visitors see a clean page with the prompt content and can copy it to their clipboard.',
      searchAliases: ['how to share a prompt', 'create public link', 'share with password'],
      relatedSections: ['entry-editor'],
      content: (
        <div className="space-y-3">
          <p>
            Share a read-only view of any published prompt with anyone — no Clarive account
            required. Open an entry and click <strong>Share Link</strong> in the Actions panel.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Create a share link</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Optionally set an <strong>expiration date</strong> so the link stops working
              automatically.
            </li>
            <li>
              Optionally add a <strong>password</strong> (minimum 12 characters).
            </li>
            <li>
              Click <strong>Create Share Link</strong> to generate the URL.
            </li>
          </ol>
          <h4 className="text-sm font-semibold text-foreground">Manage an existing link</h4>
          <p>
            Once active, the button changes to <strong>Manage Share Link</strong> with these
            options:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Copy Link</strong> — copy the URL to share again.
            </li>
            <li>
              <strong>Regenerate</strong> — create a new URL. The old link stops working
              immediately.
            </li>
            <li>
              <strong>Revoke</strong> — permanently remove the link.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">What visitors see</h4>
          <p>
            A clean, read-only page with the prompt title, version number, system message, and all
            prompt content. Visitors can copy everything to their clipboard with one click.
          </p>
        </div>
      ),
    },
  ],
};
