import {
  codeBlockLookBack,
  findCompleteCodeBlock,
  findPartialCodeBlock,
  useCodeBlockToHtml,
  loadHighlighter,
} from '@llm-ui/code';
import { markdownLookBack } from '@llm-ui/markdown';
import { useLLMOutput, type LLMOutputFallbackBlock } from '@llm-ui/react';
import type { BlockMatch } from '@llm-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createHighlighter } from 'shiki';

// ── Shiki highlighter (lazy-loaded on first code block render) ──
let highlighterInstance: ReturnType<typeof loadHighlighter> | null = null;

function getHighlighter() {
  if (!highlighterInstance) {
    highlighterInstance = loadHighlighter(
      createHighlighter({
        langs: [
          'javascript',
          'typescript',
          'python',
          'bash',
          'json',
          'html',
          'css',
          'sql',
          'yaml',
          'markdown',
          'jsx',
          'tsx',
          'go',
          'rust',
          'java',
          'csharp',
          'xml',
        ],
        themes: ['github-dark', 'github-light'],
      })
    );
  }
  return highlighterInstance;
}

// ── Markdown block component ──
function MarkdownBlock({ blockMatch }: { blockMatch: BlockMatch }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-elevated prose-pre:border prose-pre:border-border-subtle prose-code:text-xs prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{blockMatch.output}</ReactMarkdown>
    </div>
  );
}

// ── Code block component ──
function CodeBlockComponent({ blockMatch }: { blockMatch: BlockMatch }) {
  const { html, code } = useCodeBlockToHtml({
    markdownCodeBlock: blockMatch.output,
    highlighter: getHighlighter(),
    codeToHtmlOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  });

  if (!html) {
    // Fallback while highlighter loads
    return (
      <pre className="bg-elevated rounded-md p-3 text-xs font-mono border border-border-subtle overflow-x-auto my-2">
        <code>{code || blockMatch.output}</code>
      </pre>
    );
  }

  return (
    <div
      className="my-2 rounded-md overflow-hidden border border-border-subtle [&_pre]:!p-3 [&_pre]:!text-xs [&_pre]:!rounded-md [&_code]:!text-xs"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Block configurations ──
const codeBlock = {
  component: CodeBlockComponent,
  findCompleteMatch: findCompleteCodeBlock(),
  findPartialMatch: findPartialCodeBlock(),
  lookBack: codeBlockLookBack(),
};

const markdownFallback: LLMOutputFallbackBlock = {
  component: MarkdownBlock,
  lookBack: markdownLookBack(),
};

// ── Main component ──
interface LLMResponseBlockProps {
  output: string;
  isStreaming: boolean;
}

export default function LLMResponseBlock({ output, isStreaming }: LLMResponseBlockProps) {
  const blocks = [codeBlock];

  const { blockMatches } = useLLMOutput({
    llmOutput: output,
    blocks,
    fallbackBlock: markdownFallback,
    isStreamFinished: !isStreaming,
  });

  if (!output && !isStreaming) return null;

  return (
    <div className="min-w-0">
      {blockMatches.map((match, i) => {
        const Component = match.block.component;
        return <Component key={i} blockMatch={match} />;
      })}
      {isStreaming && (
        <span className="inline-block w-[4px] h-[1.1em] bg-primary align-text-bottom ml-0.5 animate-cursor-blink" />
      )}
    </div>
  );
}
