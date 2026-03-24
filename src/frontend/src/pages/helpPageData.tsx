import {
  Blocks,
  Braces,
  FileText,
  FlaskConical,
  FolderTree,
  Globe,
  Key,
  Keyboard,
  PanelLeft,
  Rocket,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Star,
  Users,
  Wand2,
  Wrench,
} from 'lucide-react';
import type React from 'react';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-elevated rounded px-1.5 py-0.5 text-xs font-mono border border-border-subtle">
      {children}
    </kbd>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-elevated rounded px-1.5 py-0.5 text-xs font-mono border border-border-subtle">
      {children}
    </code>
  );
}

export function SectionIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="size-4 shrink-0 text-foreground-muted mr-2" />;
}

export interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  searchText: string;
  plainTextContent: string;
  searchAliases?: string[];
  relatedSections?: string[];
  content: React.ReactNode;
}

export interface SectionGroup {
  label: string;
  sections: Section[];
}

export const sectionGroups: SectionGroup[] = [
  {
    label: 'Core Features',
    sections: [
      {
        id: 'getting-started',
        icon: Rocket,
        title: 'Getting Started',
        searchText:
          'dashboard entry count published prompts recently edited activity new entry ai wizard title system message tabs publish versioned snapshot guided tour onboarding',
        plainTextContent:
          'Your Dashboard. When you open Clarive, you land on the dashboard. It shows how many entries you have, which ones you published, what you edited recently, and what your teammates have been up to. Creating Your First Entry. Hit New Entry in the sidebar, give it a title, write your prompt, and save. Publish when you are happy to take a versioned snapshot. Or choose Use AI Wizard to let AI generate a prompt from your description. Guided Tour. First time? An interactive tour walks you through the dashboard, sidebar, editor, and key features step by step.',
        searchAliases: ['how to create a prompt', 'first steps', 'new to clarive', 'get started'],
        relatedSections: ['entry-editor', 'ai-wizard'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-dashboard.png"
              alt="Dashboard showing greeting, stat cards for entries, published, unpublished, and folders, plus recent entries list"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <h4 className="text-sm font-semibold text-foreground">Your Dashboard</h4>
            <p>
              When you open Clarive, you land on the dashboard. It shows how many entries you have,
              which ones you&apos;ve published, what you edited recently, and what your teammates
              have been up to. Think of it as your home base.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Creating Your First Entry</h4>
            <p>
              Hit <strong>New Entry</strong> in the sidebar. Give it a title, write your prompt, and
              save. Your entry is always editable — just keep writing. When you&apos;re happy
              with it, click <strong>Publish</strong> to take a versioned snapshot.
            </p>
            <p>
              Don&apos;t want to start from scratch? Choose <strong>Use AI Wizard</strong> instead
              and let the AI generate a prompt based on your description.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Guided Tour</h4>
            <p>
              First time here? You&apos;ll see an interactive tour that walks you through the
              dashboard, sidebar, editor, and key features step by step. It only shows up once, so
              you won&apos;t be bothered by it later.
            </p>
          </div>
        ),
      },
      {
        id: 'sidebar',
        icon: PanelLeft,
        title: 'Sidebar & Navigation',
        searchText:
          'sidebar resize drag width collapse expand toggle keyboard shortcut ctrl b workspace switcher folder tree new entry trash notifications',
        plainTextContent:
          'Everything in Clarive starts from the sidebar on the left. Workspace Switcher. At the top you see which workspace you are in and your role. Click it to switch between workspaces. Folder Tree. Your folders live right below the workspace switcher. Click any folder to jump to its contents. Resizing. Drag the sidebar right edge to make it wider or narrower. Clarive remembers your preference. Collapsing. Press Ctrl+B to collapse to icon-only mode. You can still reach everything. Notifications. Badge on the bell icon means someone invited you to a workspace. Click to accept or decline. On Mobile. The sidebar becomes a slide-over panel on smaller screens.',
        searchAliases: ['how to navigate', 'collapse sidebar', 'resize sidebar'],
        relatedSections: ['folders', 'keyboard-shortcuts'],
        content: (
          <div className="space-y-3">
            <p>
              Everything in Clarive starts from the sidebar on the left. It&apos;s where you switch
              workspaces, browse your folders, create new entries, and get to settings.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Workspace Switcher</h4>
            <p>
              At the top you&apos;ll see which workspace you&apos;re in and your role. Click it to
              switch between workspaces — each one has its own entries, folders, and settings, so
              switching changes everything you see.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Folder Tree</h4>
            <p>
              Your folders live right below the workspace switcher. Click any folder to jump
              straight to its contents. The number next to each folder tells you how many entries
              are in it.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Resizing</h4>
            <p>
              Need more room? Drag the sidebar&apos;s right edge to make it wider or narrower.
              Clarive remembers your preference.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Collapsing</h4>
            <p>
              Press <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd> (<Kbd>Cmd</Kbd> + <Kbd>B</Kbd> on macOS) to
              collapse the sidebar down to just icons. You can still reach everything — New Entry,
              Library, Dashboard, Trash, Settings, Help — it just takes less space. Clarive
              remembers whether you prefer it open or collapsed.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
            <p>
              See a badge on the bell icon? That means someone invited you to a workspace. Click it
              to accept or decline without leaving what you&apos;re working on.
            </p>
            <h4 className="text-sm font-semibold text-foreground">On Mobile</h4>
            <p>
              On smaller screens, the sidebar becomes a slide-over panel. It opens when you need it
              and closes when you navigate somewhere.
            </p>
          </div>
        ),
      },
      {
        id: 'entry-editor',
        icon: FileText,
        title: 'Entry Editor',
        searchText:
          'title system message prompt cards rich-text editor sidebar tabs actions details versions prompt chains follow-up bold italic headings bubble menu tabs published historical versioning diff restore ai enhance generate system message decompose chain test prompt playground',
        plainTextContent:
          'How the Editor Works. Every entry has a title, an optional system message that tells the AI how to behave, and one or more prompt cards. On the right you find panels for Actions, Details, and Versions. Tabs. Every entry has a Main tab that is always editable. Create additional named tabs to experiment with different approaches. Any tab can be published. Published and Historical. Published is the live version served via the API. Historical versions are older snapshots you can view or restore to a new tab. Version History. Every time you publish a tab, Clarive takes a snapshot. Browse versions, compare side by side, or restore any version to a new tab. AI Tools. AI Enhance, Generate System Message, Decompose to Chain, Test Prompt.',
        searchAliases: ['how to edit a prompt', 'save', 'publish entry', 'version history', 'tabs'],
        relatedSections: ['playground', 'templates', 'ai-wizard', 'share-links'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-editor.png"
              alt="Entry Editor showing tab bar, title, system message, prompt card with highlighted template variables, and Add follow-up button"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <h4 className="text-sm font-semibold text-foreground">How the Editor Works</h4>
            <p>
              Every entry has three parts: a <strong>title</strong> at the top, an optional{' '}
              <strong>system message</strong> (tells the AI how to behave), and one or more{' '}
              <strong>prompt cards</strong> where you write your actual prompt. On the right
              you&apos;ll find panels for <strong>Actions</strong> (save, publish, AI tools),{' '}
              <strong>Details</strong> (tags, folder, activity), and <strong>Versions</strong>.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Prompt Chains</h4>
            <p>
              Got a complex task? Break it into steps. Click <strong>Add follow-up prompt</strong>{' '}
              to create a chain of prompts that run in sequence. Reorder them with the arrows, or
              remove any step you don&apos;t need.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Formatting</h4>
            <p>
              The editor gives you bold, italic, headings, lists, inline code, and code blocks.
              Select any text to see the formatting toolbar, or use keyboard shortcuts if you prefer.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Tabs</h4>
            <p>
              Every entry has a <strong>Main</strong> tab that&apos;s always editable — no draft
              ceremony. Want to experiment? Click <strong>+</strong> to create a named tab by
              forking from any published or historical version. Switch between tabs to compare
              approaches. Delete any tab except Main when you&apos;re done.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Publishing</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Publish</strong> any tab to take a snapshot — the tab stays editable, and
                the snapshot becomes the live version served via the API.
              </li>
              <li>
                <strong>Historical</strong> — previous snapshots you can view, compare, or restore
                to a new tab.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Version History</h4>
            <p>
              Every time you publish, Clarive saves a numbered version. Open the{' '}
              <strong>Versions</strong> panel to browse them, compare any two side by side, or
              restore an older version into an existing tab or a new one.
            </p>
            <h4 className="text-sm font-semibold text-foreground">AI Tools</h4>
            <p>You&apos;ll find these in the Actions tab:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>AI Enhance</strong> — let AI analyze your prompt and suggest improvements.
              </li>
              <li>
                <strong>Generate System Message</strong> — AI creates a system message based on your
                prompt. Shows up when you haven&apos;t set one yet.
              </li>
              <li>
                <strong>Decompose to Chain</strong> — turns a single prompt into a multi-step chain.
                Handy for complex tasks.
              </li>
              <li>
                <strong>Test Prompt</strong> — opens the playground so you can try your prompt
                against a live AI model.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'ai-wizard',
        icon: Wand2,
        title: 'AI Wizard',
        searchText:
          'ai wizard generate prompts description polish refine wand system message template variables prompt chain web research review quality scores clarity effectiveness completeness faithfulness clarification enhancement save enhance existing entries',
        plainTextContent:
          'Don\'t know where to start? Describe what you need and the AI Wizard will write the prompt for you. Describe — tell the wizard what your prompt should do. Click the wand button to polish your description. Turn on system message, template variables, prompt chain, or web research. Review — see the generated prompt with quality scores for clarity, effectiveness, completeness, and faithfulness. Pick improvements or regenerate. Save — save it as a new entry. Already Have a Prompt? Open any entry and click AI Enhance to analyze and improve it.',
        searchAliases: ['generate prompt with AI', 'ai create prompt', 'wizard generate'],
        relatedSections: ['entry-editor', 'templates'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-wizard.png"
              alt="AI Wizard Describe step with 3-step progress bar, text area, and configuration toggles for system message, template, chain, and web research"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <p>
              Don&apos;t know where to start? Describe what you need and the AI Wizard will write
              the prompt for you. It works in three steps:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Describe</strong> — Tell the wizard what your prompt should do. What task
                does it handle? What inputs does it need? What should the output look like? The more
                detail you give, the better the result. You can also:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>
                    Click the <strong>wand button</strong> to let AI polish your description before
                    generating
                  </li>
                  <li>
                    Turn on <strong>system message</strong> to set the AI&apos;s role
                  </li>
                  <li>
                    Add <strong>template variables</strong> for dynamic {'{{placeholders}}'}
                  </li>
                  <li>
                    Enable <strong>prompt chain</strong> to split the output into multiple steps
                  </li>
                  <li>
                    Turn on <strong>web research</strong> so the AI looks up relevant context first
                  </li>
                </ul>
              </li>
              <li>
                <strong>Review</strong> — The wizard shows you the generated prompt with quality
                scores (clarity, effectiveness, completeness, faithfulness — each scored 0–10). Not
                happy? Pick from the suggested improvements or regenerate. The wizard might also ask
                you clarification questions to get it right.
              </li>
              <li>
                <strong>Save</strong> — When you&apos;re satisfied, save it as a new entry in your
                library.
              </li>
            </ol>
            <h4 className="text-sm font-semibold text-foreground">Already Have a Prompt?</h4>
            <p>
              You can use the wizard on existing entries too. Open any entry and click{' '}
              <strong>AI Enhance</strong> in the Actions tab — the wizard will analyze your prompt,
              score it, and suggest improvements.
            </p>
          </div>
        ),
      },
      {
        id: 'playground',
        icon: FlaskConical,
        title: 'Playground',
        searchText:
          'playground test prompt model temperature max tokens reasoning effort show thinking run stop streaming token count history comparison pin rerun copy response chain step ctrl enter escape batch queue compare models judge evaluation scoring accuracy helpfulness relevance coherence safety tool calls',
        plainTextContent:
          'Try Your Prompts. The Playground lets you run any entry against a live AI model and watch the response come in. Pick a Model and Tweak the Settings. Model — choose from available models. Temperature — lower is more predictable, higher is more creative. Max Tokens — caps response length. Reasoning Effort — higher effort means better answers on hard problems. Show Thinking — peeks behind the curtain. Running a Test. Click Run or Ctrl+Enter. Response streams live with timer and token count. Hit Esc to stop. Template variables get a form to fill in first. Comparing Models Side by Side. Click Enqueue to save model and settings to a queue. Run Queue to compare them all. AI Judge. Let AI score each response on accuracy, helpfulness, relevance, coherence, safety. Run History. Every test run is saved. Browse, pin for comparison, or rerun with one click.',
        searchAliases: ['how to test a prompt', 'compare models', 'run prompt against AI', 'batch comparison'],
        relatedSections: ['entry-editor', 'tools'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-playground.png"
              alt="Playground toolbar with model selector, Enqueue button, Run button, reasoning and token parameters, and template variable inputs"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <h4 className="text-sm font-semibold text-foreground">Try Your Prompts</h4>
            <p>
              The Playground lets you run any entry against a live AI model and watch the response
              come in. Click <strong>Test Prompt</strong> in the editor, or go directly to any
              entry&apos;s test page.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Pick a Model and Tweak the Settings</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Model</strong> — choose from available models, grouped by provider. Each one
                comes with sensible defaults.
              </li>
              <li>
                <strong>Temperature</strong> — lower means more predictable, higher means more
                creative. Set it to 0 for factual tasks, crank it up for brainstorming.
              </li>
              <li>
                <strong>Max Tokens</strong> — caps how long the response can be.
              </li>
              <li>
                <strong>Reasoning Effort</strong> — for reasoning models only. Higher effort =
                better answers on hard problems, but takes longer.
              </li>
              <li>
                <strong>Show Thinking</strong> — peeks behind the curtain to see how the model
                reasons through its answer.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Running a Test</h4>
            <p>
              Click <strong>Run</strong> (or <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>) and the response
              streams in live, with a timer and token count. For prompt chains, you&apos;ll see
              progress through each step. Need to stop? Hit <Kbd>Esc</Kbd>.
            </p>
            <p>
              If your entry uses template variables, you&apos;ll get a form to fill them in first.
              Your values stick around between runs so you don&apos;t have to retype them.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Comparing Models Side by Side</h4>
            <p>
              Want to see how different models handle the same prompt? Click{' '}
              <strong>Enqueue</strong> to save the current model and settings to a queue. Add as
              many combinations as you like, then hit <strong>Run Queue</strong>. Results show up in
              columns so you can compare them at a glance.
            </p>
            <h4 className="text-sm font-semibold text-foreground">AI Judge</h4>
            <p>
              After a batch run, let an AI judge score each response on accuracy, helpfulness,
              relevance, coherence, and safety (0–10 each). You get color-coded bars, scores, and
              written feedback — no need to read every response yourself.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Tool Calls</h4>
            <p>
              If a model calls tools during a run, you&apos;ll see the calls and results inline,
              exactly as they happened. Nothing gets cut off.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Run History</h4>
            <p>
              Every test run is saved. Open the history sidebar to browse past runs, expand any one
              to read the full response, or <strong>pin</strong> it for side-by-side comparison with
              your latest result. You can also <strong>rerun</strong> any previous test with one
              click.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    label: 'Content & Organization',
    sections: [
      {
        id: 'templates',
        icon: Braces,
        title: 'Templates & Variables',
        searchText:
          'template variables curly braces placeholder type string int float enum constraints default value description popover insert variable syntax form preview rendered output',
        plainTextContent:
          'What Are Template Variables? Variables turn prompts into reusable templates. Wrap any word in double curly braces and it becomes a placeholder. Adding and Editing Variables. Type variables directly or click the button to insert one. Click any highlighted variable to set name, type, constraints, default value, and description. Variable Types. string — text input. int — integer with min/max range. float — decimal with min/max. enum — dropdown with fixed options. Defaults and Descriptions. Variables can carry a default value and description. Full Syntax: name|type:constraints:default:description. Template Form. A Template Variables section appears below the editor with form fields for each variable. Preview shows rendered output with values substituted.',
        searchAliases: ['how to use variables', 'template syntax', 'dynamic placeholders'],
        relatedSections: ['entry-editor', 'playground'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-templates.png"
              alt="Variable edit popover showing name, type, default value, and description fields over a prompt card with highlighted template variables"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <h4 className="text-sm font-semibold text-foreground">Make Your Prompts Reusable</h4>
            <p>
              Wrap any word in double curly braces — like{' '}
              <Code>{'{{topic}}'}</Code> — and it becomes a placeholder that gets filled in each
              time the prompt runs. Clarive highlights variables in the editor so you can spot them.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Adding &amp; Editing Variables</h4>
            <p>
              Type them directly, or click the <strong>{'{ }'} button</strong> on any prompt card to
              insert one. Click any highlighted variable to open a popover where you can set its
              name, type, constraints, default value, and description — no syntax to memorize.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Variable Types</h4>
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

            <h4 className="text-sm font-semibold text-foreground">Defaults & Descriptions</h4>
            <p>
              Variables can carry a default value and a description for whoever fills in the
              template. Add them after the constraints, separated by colons:
            </p>
            <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
              {'{{tone|enum:formal,casual:formal:The writing style}}'}
            </p>
            <p>
              The default pre-fills the form field. The description shows as a hint underneath it.
              Both are optional — skip them and the variable works the same as before.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Full Syntax</h4>
            <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
              {'{{name|type:constraints:default:description}}'}
            </p>
            <p className="text-xs text-foreground-muted">
              Everything after the name is optional. Variable names can contain letters, digits, and
              underscores. If a name appears in multiple prompts, the first occurrence sets the
              type.
            </p>

            <h4 className="text-sm font-semibold text-foreground">Template Form</h4>
            <p>
              When your prompt contains variables, a <strong>Template Variables</strong> section
              appears below the editor with a form field for each one. Default values are
              pre-filled, descriptions show as hints, and you can click <strong>Preview</strong> to
              see the rendered output with your values substituted in.
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
          'Browsing Your Library. The library shows all entries as a responsive grid. Searching. Type in the search bar to filter entries by title. Results update as you type. Filtering and Sorting. Status — All, Unpublished, or Published. Sort — Recent, Alphabetical, or Oldest. Tags — select one or more tags. Toggle between Any and All matching. Pagination. 50 entries per page with Previous/Next buttons.',
        searchAliases: ['how to find prompts', 'search entries', 'filter by tag'],
        relatedSections: ['folders', 'favorites'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-library.png"
              alt="Library card grid with search bar, status filter, sort dropdown, and entry cards showing quality scores and tags"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <h4 className="text-sm font-semibold text-foreground">Browsing Your Library</h4>
            <p>
              The library shows all entries in your workspace as a responsive grid — one column on
              mobile, two on tablet, three on desktop. Click any entry card to open it in the
              editor.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Searching</h4>
            <p>
              Type in the search bar to filter entries by title. Results update as you type with a
              short delay. The result count shows inline when filters are active.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Filtering & Sorting</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Status</strong> — filter by All, Unpublished, or Published.
              </li>
              <li>
                <strong>Sort</strong> — order by Recent (default), Alphabetical, or Oldest.
              </li>
              <li>
                <strong>Tags</strong> — select one or more tags to filter. When two or more tags are
                selected, a toggle appears to switch between <strong>Any</strong> (entries matching
                at least one tag) and <strong>All</strong> (entries matching every selected tag).
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Pagination</h4>
            <p>
              The library shows 50 entries per page. Use the Previous/Next buttons at the bottom to
              navigate. Changing any filter resets you to the first page.
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
          'Starring Entries. Click the star icon on any entry card in the library to mark it as a favorite. Click again to remove it. You can also star or unstar entries from the editor title bar. Where to Star. Star icon appears on entry cards in the library grid, in the entry editor next to the title, and in the dashboard favorites panel. Dashboard Favorites Panel. The dashboard shows a dedicated Favorites panel when you have starred entries. Each favorite is a clickable link with a timestamp. Click the star icon in the panel to unstar. Workspace Scope. Favorites are per-workspace. Starring an entry in one workspace does not affect other workspaces. There is no limit on how many entries you can favorite.',
        searchAliases: ['how to bookmark prompts', 'star entries', 'quick access'],
        relatedSections: ['library'],
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Starring Entries</h4>
            <p>
              Click the <strong>star icon</strong> on any entry card in the library to mark it as a
              favorite. Click again to remove it. Starred entries appear in the{' '}
              <strong>Favorites</strong> section on your dashboard for quick access, along with a
              timestamp showing when you favorited them.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Where to Star</h4>
            <p>The star icon appears in three places:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>On <strong>entry cards</strong> in the library grid</li>
              <li>
                In the <strong>entry editor</strong>, next to the title — so you can star an entry
                while editing without going back to the library
              </li>
              <li>
                In the <strong>dashboard Favorites panel</strong> — click to unstar directly
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Dashboard Favorites Panel</h4>
            <p>
              When you have starred entries, the dashboard shows a dedicated Favorites panel. Each
              favorite is a clickable link that opens the entry directly, along with a timestamp
              showing when you favorited it.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Workspace Scope</h4>
            <p>
              Favorites are <strong>per-workspace</strong>. Starring an entry in one workspace does
              not affect other workspaces you belong to. There is no limit on how many entries you
              can favorite.
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
          'Use the folder tree in the sidebar to organize entries. Managing Folders. Click New folder to create a root-level folder. Hover and click three-dot menu for subfolder, rename, delete, or set a color. Nest folders as deep as you need. Folder Colors. Assign a color from six presets. Appears as a dot next to the folder name. Search and Breadcrumbs. Search box filters folders by name. Breadcrumb trail shows full path. Drag and Drop. Drag entries between folders. Drag folders to reorganize. Undo notification appears for mistakes.',
        searchAliases: ['how to organize prompts', 'create folder', 'move entries'],
        relatedSections: ['library'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-folders.png"
              alt="Sidebar folder tree showing workspace name, colored folders with entry counts, search box, and New folder button"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <p>Use the folder tree in the sidebar to organize your entries.</p>
            <h4 className="text-sm font-semibold text-foreground">Managing Folders</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Click <strong>New folder</strong> at the bottom of the folder tree to create a
                root-level folder.
              </li>
              <li>
                Hover over a folder and click the <strong>three-dot menu</strong> to add a
                subfolder, rename, delete, or <strong>set a color</strong>.
              </li>
              <li>Nest folders as deep as you need.</li>
              <li>Click any folder to see its entries.</li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Folder Colors</h4>
            <p>
              Assign a color to any folder from the three-dot menu. Choose from six preset colors or
              select <strong>None</strong> to remove it. The color appears as a dot next to the
              folder name in the sidebar for quick visual identification.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Search & Breadcrumbs</h4>
            <p>
              Use the <strong>search box</strong> at the top of the folder tree to filter folders by
              name in real time. When viewing a nested folder, a <strong>breadcrumb trail</strong>{' '}
              shows the full path from the root so you can navigate back to any parent with one
              click.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Drag and Drop</h4>
            <p>
              Drag entries between folders in the library view. Drag folders to reorganize your
              structure. Drop onto a folder to move inside it — folders expand automatically when
              you hover during a drag. If you move something by mistake, an{' '}
              <strong>undo notification</strong> appears so you can reverse the action immediately.
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
          'Share a read-only view of any published prompt with anyone — no account required. Creating a Share Link. Optionally set an expiration date. Optionally add a password minimum 12 characters. Click Create Share Link to generate the URL. Managing an Existing Link. Copy Link, Regenerate (new URL, old stops working), Revoke (permanently remove). What Visitors See. Clean read-only page with prompt title, version number, system message, and all prompt content. Copy to clipboard with one click.',
        searchAliases: ['how to share a prompt', 'create public link', 'share with password'],
        relatedSections: ['entry-editor'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-share.png"
              alt="Manage Share Link dialog showing status, view count, creation date, and Copy Link, Regenerate, Revoke actions"
              className="rounded-lg border border-border-subtle mb-4 w-full max-w-sm"
              loading="lazy"
            />
            <p>
              Share a read-only view of any published prompt with anyone — no account required. Open
              an entry and click <strong>Share Link</strong> in the Actions sidebar to create one.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Creating a Share Link</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Optionally set an <strong>expiration date</strong> so the link stops working
                automatically.
              </li>
              <li>
                Optionally add a <strong>password</strong> (minimum 12 characters). Visitors will
                need to enter it before viewing.
              </li>
              <li>
                Click <strong>Create Share Link</strong> to generate the URL. Copy it and share with
                anyone.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Managing an Existing Link</h4>
            <p>
              Once a link is active, the button changes to <strong>Manage Share Link</strong>. From
              there you can:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Copy Link</strong> — copy the existing URL to share again without
                invalidating it.
              </li>
              <li>
                <strong>Regenerate</strong> — create a new URL. The old link stops working
                immediately.
              </li>
              <li>
                <strong>Revoke</strong> — permanently remove the share link. The public page will
                show &quot;Link Not Found.&quot;
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">What Visitors See</h4>
            <p>
              Visitors see a clean, read-only page with the prompt title, version number, system
              message (if any), and all prompt content. They can copy everything to their clipboard
              with one click. Template variables are shown as metadata but not editable.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    label: 'Team & Workspace',
    sections: [
      {
        id: 'workspaces',
        icon: Users,
        title: 'Workspaces & Teams',
        searchText:
          'personal shared workspace team collaboration workspace switcher invite members email admin editor viewer roles leave revoke invitation bell notification',
        plainTextContent:
          'Personal vs Shared Workspaces. Every account starts with a personal workspace. You can be invited to shared workspaces for team collaboration. Each workspace has its own entries, folders, and settings. Switching Workspaces. Use the workspace switcher at the top of the sidebar. Inviting Members. Admins can invite from Settings > Users. Invitations go by email. Accepting Invitations. Badge on bell icon. Click to accept or decline. Roles. Admin — full control. Editor — create, edit, publish. Viewer — read-only. Leaving a Workspace. Leave from Settings > Users.',
        searchAliases: ['how to invite team members', 'switch workspace', 'team collaboration'],
        relatedSections: ['account-settings'],
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Your Personal Workspace</h4>
            <p>
              You start with a <strong>personal workspace</strong> that&apos;s just yours. Everything
              in it — entries, folders, settings — is private to you.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Shared Workspaces</h4>
            <p>
              When you need to collaborate, someone can invite you to a{' '}
              <strong>shared workspace</strong>. Each workspace is its own world with separate
              entries, folders, and settings. Switch between them using the{' '}
              <strong>workspace switcher</strong> at the top of the sidebar.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Inviting People</h4>
            <p>
              If you&apos;re an admin, go to <strong>Settings &gt; Users</strong> to invite people
              by email. They&apos;ll get an email and need to accept before they can see anything.
              You can resend or cancel pending invitations.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Got an Invitation?</h4>
            <p>
              Look for a badge on the bell icon in the sidebar. Click it to accept or decline.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Roles</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Admin</strong> — full control: manage members, settings, and all entries.
              </li>
              <li>
                <strong>Editor</strong> — create, edit, and publish entries. Cannot manage members.
              </li>
              <li>
                <strong>Viewer</strong> — read-only access. Cannot create or modify content.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Leaving a Workspace</h4>
            <p>
              Leave any shared workspace from <strong>Settings &gt; Users</strong>. Personal
              workspaces can&apos;t be left.
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
          'What Are Tool Descriptions? Tool descriptions define external tools or functions that an AI model can call. Each has a name, identifier, and description. Managing Tools. Go to Settings > Tools. Add Tool with display name, identifier, description. Edit with pencil icon. Delete with trash icon. MCP Servers. Connect to MCP Model Context Protocol servers to automatically sync tool definitions. Add Server with name, URL, optional bearer token. Sync to refresh tool definitions. Remove server also removes synced tools. MCP One-Off Import. Import tools from MCP server without registering it. Tools in the Playground. Toolbar dropdown to enable or disable MCP servers and tools per run.',
        searchAliases: ['how to add tools', 'mcp server setup', 'connect mcp'],
        relatedSections: ['playground'],
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">What Are Tool Descriptions?</h4>
            <p>
              Tool descriptions define external tools or functions that an AI model can call when
              running your prompts. Each one has a name, a tool identifier, and a description of
              what it does.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Managing Tools</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Go to <strong>Settings → Tools</strong>.
              </li>
              <li>
                Click <strong>Add Tool</strong> to define a tool with a display name, identifier,
                and description.
              </li>
              <li>Edit a tool by clicking the pencil icon on its card.</li>
              <li>Delete with the trash icon (you&apos;ll be asked to confirm).</li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">MCP Servers</h4>
            <p>
              Connect to <strong>MCP (Model Context Protocol) servers</strong> to automatically sync
              tool definitions. Go to <strong>Settings → Tools</strong> and use the MCP Servers
              panel:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Add Server</strong> — provide a name, server URL, and optional bearer token
                for authentication. Tools are synced automatically after adding.
              </li>
              <li>
                <strong>Sync</strong> — click the refresh button on any server card to re-sync its
                tool definitions. Each card shows the tool count, last sync time, and any sync
                errors.
              </li>
              <li>
                <strong>Remove</strong> — deleting a server also removes all of its synced tools
                from your workspace.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">MCP One-Off Import</h4>
            <p>
              To import tools from an MCP server without registering it, use the{' '}
              <strong>MCP Import</strong> section. Enter the server URL (and optional bearer token)
              to discover and import available tools. Tools that already exist in your workspace are
              skipped.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Tools in the Playground</h4>
            <p>
              When testing prompts in the Playground, a toolbar dropdown lets you enable or disable
              MCP servers and individual tools per run. Only enabled tools are sent to the AI model.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    label: 'Reference',
    sections: [
      {
        id: 'super-admin',
        icon: ShieldCheck,
        title: 'Super Admin',
        searchText:
          'super admin dashboard usage analytics users ai providers models settings logs maintenance mode system configuration email smtp resend google oauth',
        plainTextContent:
          'Super Admins have access to a dedicated administration area. Dashboard. Overview of platform health: total users, entries, AI sessions with 7-day deltas. Usage. AI usage analytics with date filtering, charts, and detailed log grid. Users. Manage all platform users, reset passwords, delete accounts. AI Configuration. Configure external AI providers like OpenAI, Anthropic, or any OpenAI-compatible endpoint. Add providers, fetch models, assign to actions. Settings. Email provider, Google OAuth, registration toggle, maintenance mode. Logs. Application logs with level filtering and search. Jobs. Background job status and history.',
        searchAliases: ['admin settings', 'manage users', 'configure AI providers'],
        content: (
          <div className="space-y-3">
            <p>
              Super Admins have access to a dedicated administration area for managing the entire
              Clarive instance. Access it from the user menu in the top-right corner.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Dashboard</h4>
            <p>
              Overview of platform health: total users, entries, and AI sessions with 7-day deltas.
              Additional metrics cover verified and onboarded user percentages, workspace counts,
              shared workspace stats, published vs. unpublished entry counts, and active API keys.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Usage</h4>
            <p>
              AI usage analytics with date filtering, summary cards, charts, and a detailed log
              grid. Expand any row to see full request and response details in a side panel.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Users</h4>
            <p>
              Manage all platform users. Admins can reset passwords, delete accounts, and view
              detailed user information.
            </p>
            <h4 className="text-sm font-semibold text-foreground">AI Configuration</h4>
            <p>
              Configure external AI providers (e.g. OpenAI, Anthropic, or any OpenAI-compatible
              endpoint). Add or edit providers, fetch available models, assign models to specific
              actions (generation, evaluation, system messages), and adjust per-model defaults.
              Changes that require a server restart show a warning banner.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Settings</h4>
            <p>
              Consolidated system configuration covering authentication (Google OAuth, registration
              toggle), email provider (SMTP, Resend, or console for development), application
              branding, and <strong>maintenance mode</strong> which temporarily disables access for
              non-admin users.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Logs</h4>
            <p>
              System-level logs with filtering and search. Expand any log entry for full details.
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
          'API keys let you access Clarive programmatically through the REST API. Only workspace admins can create and manage them. Creating a Key. Go to Settings > API Keys and click Create API Key. The full key is shown only once — copy it and store it somewhere safe. Using Your Key. Pass the key in the X-Api-Key header. Revoking Keys. Revoke any key from the API Keys settings tab. It stops working immediately. Keys cannot be regenerated — create a new one instead.',
        searchAliases: ['create api key', 'api authentication', 'programmatic access'],
        relatedSections: ['public-api', 'sdks'],
        content: (
          <div className="space-y-3">
            <img
              src="/static/help/help-apikeys.png"
              alt="API Keys settings tab showing tab navigation, Create API Key button, and key table with name, masked key, dates, and usage"
              className="rounded-lg border border-border-subtle mb-4 w-full"
              loading="lazy"
            />
            <p>
              API keys let you access Clarive programmatically through the REST API. Only workspace
              admins can create and manage them.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Creating a Key</h4>
            <p>
              Go to <strong>Settings &gt; API Keys</strong> and click{' '}
              <strong>Create API Key</strong>. Give it a name you&apos;ll recognize later. The full
              key is shown only once — copy it right away and store it somewhere safe.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Using Your Key</h4>
            <p>
              Pass the key in the <Code>X-Api-Key</Code> header:
            </p>
            <p className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle">
              X-Api-Key: your-api-key-here
            </p>
            <h4 className="text-sm font-semibold text-foreground">Revoking Keys</h4>
            <p>
              Revoke any key from the API Keys settings tab. It stops working immediately. Keys
              can&apos;t be regenerated — create a new one instead.
            </p>
          </div>
        ),
      },
      {
        id: 'public-api',
        icon: Globe,
        title: 'Public API',
        searchText:
          'public api fetch render published prompts get post entries generate template fields validation authentication x-api-key curl json error 401 404 422 429 rate limit list search tags pagination openapi',
        plainTextContent:
          'Public API for fetching and rendering published prompts. Authentication via X-Api-Key header. Endpoints: List entries with search, tags, and pagination. Get single entry by ID. Generate AI response using entry prompt with template field values. Render entry with template field values substituted. Error codes: 401 Unauthorized, 404 Not Found, 422 Validation Error, 429 Rate Limited. OpenAPI spec available. Curl examples for fetching and generating.',
        searchAliases: ['rest api endpoints', 'api documentation', 'curl examples'],
        relatedSections: ['api-keys', 'sdks'],
        content: (
          <div className="space-y-3">
            <p>
              The Public API lets you list, fetch, and render published prompts programmatically.
              All requests require an API key (see <strong>API Keys</strong> above).
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
      "updatedAt": "2026-03-10T14:22:00Z"
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
            <p>
              Fetch the published version of an entry, including its template field definitions.
            </p>
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
  "publishedAt": "2026-03-10T14:22:00Z"
}`}
            </pre>

            <h4 className="text-sm font-semibold text-foreground">
              POST /public/v1/entries/{'{entryId}'}/generate
            </h4>
            <p>
              Render a published entry by substituting template variables with the values you
              provide. All field values are passed as strings.
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
            <p>Download the full OpenAPI specification for the Clarive API in YAML format.</p>

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
                    <td className="p-2 font-sans">
                      Must be a valid integer; optional min/max range
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2">float</td>
                    <td className="p-2 font-sans">
                      Must be a valid number; optional min/max range
                    </td>
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
              <strong>600 requests per minute</strong> per API key. Every response includes rate
              limit headers:
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
          'Official SDK client libraries for TypeScript, Python, and C#. TypeScript SDK via npm. Python SDK via pip. C# SDK via NuGet. Each SDK provides typed clients for all API endpoints, automatic retry with circuit breaker pattern, and error handling. Installation and usage examples for each language.',
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
                <strong>Credential safety</strong> — API keys are omitted from logs and
                serialization output.
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
          'Keyboard Shortcuts. Editor: Ctrl+S save. Ctrl+Shift+Enter publish. Ctrl+Z undo. Ctrl+Shift+Z redo. Formatting: Ctrl+B bold. Ctrl+I italic. Ctrl+Shift+X strikethrough. Ctrl+E inline code. Navigation: Ctrl+B toggle sidebar. Playground: Ctrl+Enter run prompt. Escape stop streaming. Cmd replaces Ctrl on macOS.',
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
          'Accessing Trash. Click Trash in the sidebar to view all deleted entries. Deleted entries are kept for 30 days before automatic permanent removal. Trash View. The trash shows each deleted entry with its name, when it was deleted, and who deleted it. Click any entry to open a preview sheet with the full content. Restoring Entries. Click Restore to move an entry back to its original folder. If the original folder was deleted, the entry goes to the root level. Select multiple entries and use bulk restore to recover them all at once. Folders and Deletion. Deleting a folder moves all its entries to trash individually. The folder itself is removed immediately. Restoring an entry from a deleted folder places it at the root level. Permanent Deletion. Only workspace admins can permanently delete entries from trash. This removes the entry immediately and cannot be undone. Entries not manually deleted are automatically purged after 30 days.',
        searchAliases: ['recover deleted entry', 'restore from trash', 'permanently delete'],
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Accessing Trash</h4>
            <p>
              Click <strong>Trash</strong> in the sidebar to view all deleted entries. Deleted
              entries are kept for <strong>30 days</strong> before they&apos;re automatically and
              permanently removed.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Trash View</h4>
            <p>
              The trash shows each deleted entry with its name, when it was deleted, and who deleted
              it. Click any entry to open a <strong>preview sheet</strong> showing the full content
              — useful for checking whether you want to restore it.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Restoring Entries</h4>
            <p>
              Click <strong>Restore</strong> to move an entry back to its original folder. If the
              original folder was deleted, the entry goes to the root level instead. Select multiple
              entries and use <strong>bulk restore</strong> to recover them all at once.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Folders &amp; Deletion</h4>
            <p>
              Deleting a folder moves all its entries to trash individually — the folder itself is
              removed immediately. When you restore an entry whose folder no longer exists, it&apos;s
              placed at the root level.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Permanent Deletion</h4>
            <p>
              Only workspace <strong>admins</strong> can permanently delete entries from the trash.
              This removes the entry immediately and <strong>cannot be undone</strong>. Entries that
              aren&apos;t manually deleted are automatically purged after 30 days.
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
          'Profile. Update your display name, email, or avatar from the Profile tab. Change your password with minimum 12 characters. Google Sign-In users can set a password to enable email-based login. Active Sessions. View all active sessions showing browser, OS, IP address, and creation time. Revoke any session except your current one — revoking a session signs that device out immediately and invalidates its refresh token. Use Revoke All Others to sign out everywhere else. Import and Export. Export all entries or a single folder as YAML. The export includes titles, system messages, prompt content, template variables, and tags. Import creates entries as unpublished in the workspace root. Entries with duplicate titles are imported with a numeric suffix. Audit Log. Admins can view a timeline of workspace activity with events: entry_created, entry_updated, entry_published, entry_trashed, entry_restored, entry_deleted. Logs are retained for 30 days, paginated at 20 per page. Appearance. Click the theme icon to cycle between Light, Dark, and System. System follows your OS preference and updates automatically. Account Deletion. Permanently delete your account from the Profile tab with a 30-day grace period during which you can cancel.',
        searchAliases: ['change password', 'update profile', 'delete account', 'theme'],
        relatedSections: ['workspaces'],
        content: (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Profile</h4>
            <p>
              Update your display name, email, and password from{' '}
              <strong>Settings &gt; Profile</strong>. You can upload a profile picture here too. If
              you signed up with Google, you can set a password to enable email-based login as well.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Google Sign-In</h4>
            <p>
              Sign in with Google from the login or registration page. This links your Google
              identity to your Clarive account.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Sessions</h4>
            <p>
              View all active sessions under <strong>Settings &gt; Profile</strong>. Each session
              shows the browser name, operating system, IP address, and when it was created. Your
              current session is marked with a green <strong>Current</strong> badge and cannot be
              revoked.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Click the <strong>trash icon</strong> on any other session to revoke it
                individually. This signs that device out immediately and invalidates its refresh
                token.
              </li>
              <li>
                Use <strong>Revoke All Others</strong> to sign out every session except the one
                you&apos;re using right now — useful if you suspect unauthorized access.
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-foreground">Import & Export</h4>
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
                file, or click to browse. Imported entries are created as <strong>unpublished</strong> in
                the workspace root. Entries with duplicate titles are imported with a numeric suffix.
                The file name and size are shown before you confirm.
              </li>
            </ul>
            <p className="text-xs text-foreground-muted">
              Exports include titles, system messages, prompt content, template variables, and tags.
              Version history and folder structure are not included.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Audit Log</h4>
            <p>
              Admins can view a timeline of workspace activity. Each entry shows the timestamp,
              user, action, entity, and optional details. Logs are retained for{' '}
              <strong>30 days</strong> and paginated at 20 entries per page.
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
                    <td className="p-2 font-mono">entry_updated</td>
                    <td className="p-2">An entry was edited</td>
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
                </tbody>
              </table>
            </div>
            <h4 className="text-sm font-semibold text-foreground">Appearance</h4>
            <p>
              Click the theme icon in the top-right corner of the page to cycle between{' '}
              <strong>Light</strong> (sun icon), <strong>Dark</strong> (moon icon), and{' '}
              <strong>System</strong> (monitor icon) modes. System mode follows your operating
              system&apos;s preference. Your choice is saved automatically.
            </p>
            <h4 className="text-sm font-semibold text-foreground">Account Deletion</h4>
            <p>
              Permanently delete your account from the Profile tab. This removes all your data and
              can&apos;t be undone.
            </p>
          </div>
        ),
      },
    ],
  },
];

export const allSections = sectionGroups.flatMap((g) => g.sections);
