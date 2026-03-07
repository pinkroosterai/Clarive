import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, PenLine } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { flattenFolders } from '@/lib/folderUtils';
import { handleApiError } from '@/lib/handleApiError';
import { entryService, folderService } from '@/services';

const NewEntryPage = () => {
  const aiEnabled = useAiEnabled();
  useEffect(() => {
    document.title = 'Clarive \u2014 New Entry';
  }, []);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('__root__');
  const [isCreating, setIsCreating] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const flatFolders = flattenFolders(folders);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const entry = await entryService.createEntry({
        title: title.trim(),
        folderId: folderId === '__root__' ? null : folderId,
      });
      toast.success('Entry created');
      navigate(`/entry/${entry.id}`);
    } catch (err) {
      handleApiError(err, { title: 'Failed to create entry' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-start justify-center pt-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg"
      >
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-b-0 border-border-subtle px-6 py-8 text-center">
          <div className="absolute top-4 left-8 size-24 rounded-full bg-primary/8 blur-2xl" />
          <div className="absolute bottom-2 right-10 size-16 rounded-full bg-primary/6 blur-xl" />
          <div className="relative">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15">
              <PenLine className="size-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Create New Entry</h1>
            <p className="mt-1.5 text-sm text-foreground-muted">
              Start from scratch or let AI generate a prompt for you
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-b-xl border border-border-subtle bg-surface elevation-1 px-6 py-6 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="space-y-2"
          >
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="My prompt entry"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              className="h-11"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="space-y-2"
          >
            <Label htmlFor="folder">Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger id="folder">
                <SelectValue placeholder="Root (no folder)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">Root (no folder)</SelectItem>
                {flatFolders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {'\u00A0\u00A0'.repeat(f.depth) + f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <Button
              className="w-full h-11"
              onClick={handleCreate}
              disabled={!title.trim() || isCreating}
            >
              {isCreating && <Loader2 className="animate-spin" />}
              Create Entry
            </Button>
          </motion.div>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-xs text-foreground-muted">or</span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    variant="outline"
                    className="w-full gap-2 h-11 hover:border-primary/30 hover:bg-primary/5 transition-all"
                    disabled={!aiEnabled}
                    onClick={() => navigate('/entry/new/wizard')}
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Use the AI Wizard to generate a prompt
                  </Button>
                </span>
              </TooltipTrigger>
              {!aiEnabled && <TooltipContent>AI features are not configured</TooltipContent>}
            </Tooltip>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewEntryPage;
