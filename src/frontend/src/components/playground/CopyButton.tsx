import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  index: number;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => Promise<void>;
}

export default function CopyButton({ text, index, copiedIndex, onCopy }: CopyButtonProps) {
  return (
    <button
      onClick={() => onCopy(text, index)}
      className="absolute top-2 right-2 p-2 rounded-md bg-surface/80 border border-border-subtle opacity-40 hover:opacity-100 focus:opacity-100 transition-opacity"
      title="Copy response"
    >
      {copiedIndex === index ? (
        <Check className="size-3.5 text-success-text" />
      ) : (
        <Copy className="size-3.5 text-foreground-muted" />
      )}
    </button>
  );
}
