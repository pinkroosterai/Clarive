import { useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { flattenFolders } from '@/lib/folderUtils';
import { handleApiError } from '@/lib/handleApiError';
import { entryService, folderService } from '@/services';

const NewEntryPage = () => {
  useEffect(() => {
    document.title = 'Clarive — New Entry';
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
    <div className="flex items-start justify-center pt-16">
      <Card className="w-full max-w-md rounded-xl elevation-1">
        <CardHeader>
          <CardTitle>Create New Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
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
            />
          </div>

          <div className="space-y-2">
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
          </div>

          <Button className="w-full" onClick={handleCreate} disabled={!title.trim() || isCreating}>
            {isCreating && <Loader2 className="animate-spin" />}
            Create Entry
          </Button>

          <div className="relative py-2">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-foreground-muted">
              or
            </span>
          </div>

          <Button variant="ghost" className="w-full gap-2" asChild>
            <Link to="/entry/new/wizard">
              <Sparkles className="h-4 w-4" />
              Use the AI Wizard to generate a prompt
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewEntryPage;
