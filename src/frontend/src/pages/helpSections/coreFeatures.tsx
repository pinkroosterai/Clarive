import { FileText, FlaskConical, Grid3X3, PanelLeft, Rocket, Wand2 } from 'lucide-react';

import type { SectionGroup } from './shared';
import { Kbd } from './shared';

export const coreFeaturesGroup: SectionGroup = {
  label: 'Core Features',
  sections: [
    {
      id: 'getting-started',
      icon: Rocket,
      title: 'Getting Started',
      searchText:
        'dashboard entry count published prompts recently edited activity new entry ai wizard title system message tabs publish versioned snapshot guided tour onboarding',
      plainTextContent:
        'Get up and running with Clarive in minutes. Explore your dashboard to see entry counts, recent edits, and team activity. Create your first entry by clicking New Entry, writing a prompt, and publishing it. Or use the AI Wizard to generate a prompt from a description. A guided tour walks you through the key features on your first visit.',
      searchAliases: ['how to create a prompt', 'first steps', 'new to clarive', 'get started'],
      relatedSections: ['entry-editor', 'ai-wizard'],
      content: (
        <div className="space-y-3">
          <p>Get up and running with Clarive in minutes. Here&apos;s what to do first.</p>
          <h4 className="text-sm font-semibold text-foreground">Explore your dashboard</h4>
          <p>
            The dashboard is your home base. It shows how many entries you have, which ones
            you&apos;ve published, what you edited recently, and what your teammates are working on.
            Click any stat card to jump to a filtered view of your library.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Create your first entry</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Click <strong>New Entry</strong> in the sidebar.
            </li>
            <li>Give it a title and write your prompt.</li>
            <li>
              Click <strong>Save</strong>. Your entry is always editable — keep refining it.
            </li>
            <li>
              When you&apos;re ready, click <strong>Publish</strong> to take a versioned snapshot.
            </li>
          </ol>
          <p>
            Prefer to let AI do the heavy lifting? Choose <strong>Use AI Wizard</strong> instead and
            describe what you need — the wizard generates a prompt for you.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Take the guided tour</h4>
          <p>
            On your first visit, an interactive tour walks you through the dashboard, sidebar,
            editor, and key features step by step. It only appears once, so you can focus on your
            work afterward.
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
        'Navigate Clarive from the sidebar. Switch workspaces at the top. Browse folders to find entries. Drag the edge to resize, or press Ctrl+B to collapse to icons. A bell badge means you have a pending workspace invitation. On mobile, the sidebar becomes a slide-over panel.',
      searchAliases: ['how to navigate', 'collapse sidebar', 'resize sidebar'],
      relatedSections: ['folders', 'keyboard-shortcuts'],
      content: (
        <div className="space-y-3">
          <p>
            The sidebar is your starting point for everything in Clarive — switching workspaces,
            browsing folders, creating entries, and accessing settings.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Switch workspaces</h4>
          <p>
            Click the workspace name at the top of the sidebar to switch between workspaces. Each
            workspace has its own entries, folders, and settings.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Browse your folders</h4>
          <p>
            Folders appear below the workspace switcher. Click any folder to see its entries. The
            number badge shows how many entries each folder contains.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Resize or collapse</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Resize</strong> — drag the sidebar&apos;s right edge to make it wider or
              narrower.
            </li>
            <li>
              <strong>Collapse</strong> — press <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd> (<Kbd>Cmd</Kbd> +{' '}
              <Kbd>B</Kbd> on macOS) to switch to icon-only mode. Everything is still accessible.
            </li>
          </ul>
          <p className="text-xs text-foreground-muted">
            Clarive remembers your sidebar width and collapse preference.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Check notifications</h4>
          <p>
            A badge on the bell icon means someone invited you to a workspace. Click it to accept or
            decline without leaving your current page.
          </p>
          <h4 className="text-sm font-semibold text-foreground">On mobile</h4>
          <p>
            On smaller screens, the sidebar becomes a slide-over panel that opens when you need it
            and closes when you navigate.
          </p>
        </div>
      ),
    },
    {
      id: 'entry-editor',
      icon: FileText,
      title: 'Entry Editor',
      searchText:
        'title system message prompt cards rich-text editor sidebar tabs actions details versions prompt chains follow-up bold italic headings bubble menu tabs published historical versioning diff restore ai enhance generate system message decompose chain test prompt playground duplicate copy tags activity timeline',
      plainTextContent:
        'Write, refine, and publish prompts in the editor. Every entry has a title, an optional system message, and one or more prompt cards. Use tabs to experiment with different versions. Publish any tab to create a versioned snapshot. Compare versions side by side. Use AI tools to enhance, generate system messages, decompose into chains, or test against live models. Add tags to organize entries. View the activity timeline to track changes.',
      searchAliases: ['how to edit a prompt', 'save', 'publish entry', 'version history', 'tabs'],
      relatedSections: [
        'playground',
        'test-matrix',
        'templates',
        'ai-wizard',
        'share-links',
        'collaboration',
      ],
      content: (
        <div className="space-y-3">
          <p>
            The editor is where you write, refine, and publish your prompts. Every entry has three
            parts:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Title</strong> — the name of your entry.
            </li>
            <li>
              <strong>System message</strong> (optional) — tells the AI how to behave.
            </li>
            <li>
              <strong>Prompt cards</strong> — where you write your actual prompt content.
            </li>
          </ul>
          <p>
            The right sidebar has panels for <strong>Actions</strong> (save, publish, AI tools),{' '}
            <strong>Details</strong> (tags, folder, activity), and <strong>Versions</strong>.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Build multi-step prompts</h4>
          <p>
            Click <strong>Add follow-up prompt</strong> to create a chain of prompts that run in
            sequence. Reorder steps with the arrows, or remove any step you don&apos;t need.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Format your content</h4>
          <p>
            Select text to see the formatting toolbar — bold, italic, headings, lists, inline code,
            and code blocks are all available. Keyboard shortcuts work too.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Experiment with tabs</h4>
          <p>
            Every entry starts with a <strong>Main</strong> tab. Click <strong>+</strong> to create
            additional named tabs by forking from any published or historical version. Compare
            approaches, then delete tabs you no longer need.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Publish and version</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Publish</strong> any tab to take a snapshot. The tab stays editable, and the
              snapshot becomes the live version served via the API.
            </li>
            <li>
              <strong>Version history</strong> — browse all published versions, compare any two side
              by side, or restore an older version into a new tab.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Use AI tools</h4>
          <p>
            Find these in the <strong>Actions</strong> panel:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>AI Enhance</strong> — analyzes your prompt and suggests improvements.
            </li>
            <li>
              <strong>Generate System Message</strong> — creates a system message based on your
              prompt content.
            </li>
            <li>
              <strong>Decompose to Chain</strong> — splits a single prompt into a multi-step chain.
            </li>
            <li>
              <strong>Test Prompt</strong> — opens the Playground to run your prompt against a live
              AI model.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Duplicate an entry</h4>
          <p>
            Right-click an entry in the library (or use the action menu) and choose{' '}
            <strong>Duplicate</strong>. Pick a destination folder — Clarive creates a full copy with
            content, system message, and tags intact.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Organize with tags</h4>
          <p>
            In the <strong>Details</strong> panel, type a tag name and press <Kbd>Enter</Kbd> to add
            it. Clarive suggests existing tags as you type. Tags are case-insensitive and appear on
            entry cards in the library for easy filtering.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Copy the entry ID</h4>
          <p>
            In the <strong>Details</strong> panel, click <strong>Copy Entry ID</strong> to copy the
            unique identifier to your clipboard — useful for API integrations.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Track changes</h4>
          <p>
            The <strong>Details</strong> panel includes an activity timeline showing every action on
            the entry — created, updated, published, trashed, restored. Each event shows who did it,
            when, and links to the relevant version.
          </p>
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
        'Generate a prompt from a description using the AI Wizard. Describe what you need, optionally enable system message, template variables, prompt chains, or web research. Review the generated prompt with quality scores. Save it as a new entry. You can also enhance existing prompts with AI Enhance in the editor.',
      searchAliases: ['generate prompt with AI', 'ai create prompt', 'wizard generate'],
      relatedSections: ['entry-editor', 'templates'],
      content: (
        <div className="space-y-3">
          <p>
            Let AI write your prompt for you. Describe what you need, and the wizard generates a
            ready-to-use prompt in three steps.
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Describe</strong> — Explain what your prompt should do: the task, expected
              inputs, and desired output. The more detail, the better the result.
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>
                  Click the <strong>wand button</strong> to polish your description before
                  generating.
                </li>
                <li>
                  Enable <strong>system message</strong> to define the AI&apos;s role.
                </li>
                <li>
                  Add <strong>template variables</strong> for dynamic {'{{placeholders}}'}.
                </li>
                <li>
                  Turn on <strong>prompt chain</strong> to split into multiple steps.
                </li>
                <li>
                  Enable <strong>web research</strong> so the AI gathers relevant context first.
                </li>
              </ul>
            </li>
            <li>
              <strong>Review</strong> — See the generated prompt with quality scores (clarity,
              effectiveness, completeness, faithfulness — each 0–10). A chart tracks how scores
              improve across iterations. Pick from suggested improvements, answer clarification
              questions, or regenerate entirely.
            </li>
            <li>
              <strong>Save</strong> — Save the result as a new entry in your library.
            </li>
          </ol>
          <h4 className="text-sm font-semibold text-foreground">Enhance an existing prompt</h4>
          <p>
            Already have a prompt? Open any entry and click <strong>AI Enhance</strong> in the
            Actions panel. The wizard analyzes your prompt, scores it, and suggests specific
            improvements.
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
        'Test your prompts against live AI models in the Playground. Choose a model, adjust temperature, max tokens, and reasoning effort, then click Run. Compare multiple models by queueing them up. Use AI Judge to score responses on accuracy, helpfulness, relevance, coherence, and safety. View tool calls and reasoning blocks inline. Browse run history and pin results for comparison.',
      searchAliases: [
        'how to test a prompt',
        'compare models',
        'run prompt against AI',
        'batch comparison',
      ],
      relatedSections: ['entry-editor', 'test-matrix', 'tools'],
      content: (
        <div className="space-y-3">
          <p>
            Test any prompt against a live AI model and see the response in real time. Open the
            Playground by clicking <strong>Test Prompt</strong> in the editor.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Choose a model and settings</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Model</strong> — pick from available models, grouped by provider.
            </li>
            <li>
              <strong>Temperature</strong> — lower values produce more predictable output, higher
              values produce more creative output. Use 0 for factual tasks.
            </li>
            <li>
              <strong>Max Tokens</strong> — sets the maximum response length.
            </li>
            <li>
              <strong>Reasoning Effort</strong> — for reasoning models only. Higher effort produces
              better answers on complex problems.
            </li>
            <li>
              <strong>Show Thinking</strong> — reveals the model&apos;s reasoning process in a
              collapsible section above the response.
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">Run a test</h4>
          <p>
            Click <strong>Run</strong> (or press <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>). The response
            streams in live with a timer and token count. Press <Kbd>Esc</Kbd> to stop early.
          </p>
          <p>
            If your prompt uses template variables, a form appears to fill them in first. Your
            values persist between runs.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Compare models side by side</h4>
          <p>
            Click <strong>Enqueue</strong> to save the current model and settings to a comparison
            queue. Add as many combinations as you like, then click <strong>Run Queue</strong>.
            Results appear in columns for easy comparison.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Score responses with AI Judge</h4>
          <p>
            After a batch run, let AI Judge score each response on accuracy, helpfulness, relevance,
            coherence, and safety (0–10 each). You get color-coded bars, numeric scores, and written
            feedback for every dimension.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Copy responses</h4>
          <p>Click the copy icon on any response to copy it to your clipboard.</p>
          <h4 className="text-sm font-semibold text-foreground">Tool calls and reasoning</h4>
          <p>
            Tool calls and results appear inline, exactly as they happened. When{' '}
            <strong>Show Thinking</strong> is enabled, reasoning blocks appear in a collapsible
            section — useful for debugging prompts and evaluating reasoning quality.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Browse run history</h4>
          <p>
            Every test run is saved. Open the history sidebar to browse past runs,{' '}
            <strong>pin</strong> a result for side-by-side comparison, or <strong>rerun</strong> any
            previous test with one click.
          </p>
        </div>
      ),
    },
    {
      id: 'test-matrix',
      icon: Grid3X3,
      title: 'Test Matrix & Reports',
      searchText:
        'test matrix grid versions models comparison report pdf export evaluation scores run all run column run row configuration temperature reasoning effort max tokens batch compare side by side download report prompt variants',
      plainTextContent:
        'Compare prompt versions across multiple AI models in a grid. Add versions and models to build the matrix. Run all cells at once, or run individual rows, columns, or cells. Configure temperature, reasoning effort, and max tokens per model. View color-coded evaluation scores. Generate and download PDF reports with full results.',
      searchAliases: [
        'compare models',
        'batch test',
        'model comparison',
        'playground matrix',
        'pdf report',
      ],
      relatedSections: ['playground', 'entry-editor', 'tools'],
      content: (
        <div className="space-y-3">
          <p>
            Find out which model handles your prompt best — or which version of a prompt performs
            better across the board. The Test Matrix runs prompt versions against multiple AI models
            in a grid and compares results side by side.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Build the matrix</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Open any entry and click <strong>Test Prompt</strong> in the Actions panel.
            </li>
            <li>
              Add <strong>versions</strong> (tabs, published, or historical snapshots) — each
              becomes a row.
            </li>
            <li>
              Add <strong>models</strong> from your configured providers — each becomes a column.
            </li>
          </ol>
          <p>Every version × model combination creates a testable cell.</p>
          <h4 className="text-sm font-semibold text-foreground">Run tests</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Run All</strong> — tests every cell. Progress shows in the toolbar.
            </li>
            <li>
              <strong>Run a row</strong> — hover a version label and click the play icon.
            </li>
            <li>
              <strong>Run a column</strong> — hover a model header and click the play icon.
            </li>
            <li>
              <strong>Run one cell</strong> — double-click any cell or use its play icon.
            </li>
          </ul>
          <p className="text-xs text-foreground-muted">
            If your entry uses template variables, fill them in on the Setup tab before running.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Configure each model</h4>
          <p>Click any model column header to adjust its settings independently:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Temperature</strong> — controls randomness (0–2). Hidden for reasoning models.
            </li>
            <li>
              <strong>Reasoning Effort</strong> — Low, Medium, High, or Extra High (reasoning models
              only).
            </li>
            <li>
              <strong>Max Tokens</strong> — caps response length (1–128,000).
            </li>
          </ul>
          <h4 className="text-sm font-semibold text-foreground">View and compare results</h4>
          <p>
            Completed cells show a color-coded score (red → yellow → green). Click any cell for
            detailed evaluation scores across accuracy, helpfulness, relevance, coherence, and
            safety — each scored 0–10 with written feedback. The comparison panel below the grid
            shows responses side by side.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Generate a report</h4>
          <p>
            Click <strong>Report</strong> in the toolbar to preview a structured summary covering
            run configuration, rendered prompts, full responses, and evaluation scores. Click{' '}
            <strong>Download PDF</strong> to save it for sharing.
          </p>
          <h4 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h4>
          <p>
            Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd> to navigate cells. Press{' '}
            <Kbd>Enter</Kbd> to run the selected cell.
          </p>
        </div>
      ),
    },
  ],
};
