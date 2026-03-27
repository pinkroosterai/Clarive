import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, X, CheckCircle2, Loader2, FolderOpen } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { HelpLink } from '@/components/common/HelpLink';
import { FolderPickerDialog } from '@/components/library/FolderPickerDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { handleApiError } from '@/lib/handleApiError';
import { importExportService } from '@/services';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerDownload(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clarive-export-${new Date().toISOString().slice(0, 10)}.yaml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ImportExportPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const blob = await importExportService.exportEntries();
      triggerDownload(blob);
      toast.success('Exported entries');
    } catch (err) {
      handleApiError(err, { title: 'Export failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFolder = async (folderId: string | null) => {
    setFolderPickerOpen(false);
    if (!folderId) return;
    setIsExporting(true);
    try {
      const blob = await importExportService.exportEntries([folderId]);
      triggerDownload(blob);
      toast.success('Exported entries');
    } catch (err) {
      handleApiError(err, { title: 'Export failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.ya?ml$/i.test(file.name)) {
      toast.error('Please select a .yaml or .yml file');
      return;
    }
    setSelectedFile(file);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const result = await importExportService.importEntries(selectedFile);
      setImportResult({ imported: result.imported });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success(`Imported ${result.imported} entries as drafts`);
    } catch (err) {
      handleApiError(err, { title: 'Import failed — check the file format' });
    } finally {
      setIsImporting(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <Card className="bg-surface elevation-1 border-border-subtle rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Export Entries</CardTitle>
            <HelpLink section="account-settings" />
          </div>
          <CardDescription>Download your prompt entries as a YAML file.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export All Entries
          </Button>
          <Button
            variant="outline"
            onClick={() => setFolderPickerOpen(true)}
            disabled={isExporting}
          >
            <FolderOpen className="size-4" />
            Export Folder…
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card className="bg-surface elevation-1 border-border-subtle rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Import Entries</CardTitle>
          <CardDescription>Upload a YAML file to import entries as drafts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={handleFileChange}
          />

          {!selectedFile && !importResult && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-elevated/30 p-8 text-sm text-foreground-muted hover:text-foreground"
            >
              <Upload className="size-6" />
              Click to select a .yaml or .yml file
            </button>
          )}

          {selectedFile && !importResult && (
            <div className="flex items-center gap-3">
              <div className="flex-1 truncate text-sm" title={selectedFile.name}>
                <span className="font-medium">{selectedFile.name}</span>
                <span className="ml-2 text-foreground-muted">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={clearFile} disabled={isImporting}>
                <X className="size-4" />
              </Button>
              <Button size="sm" onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {isImporting ? 'Importing…' : 'Import'}
              </Button>
            </div>
          )}

          {importResult && (
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="size-5 text-primary" />
              <span>Imported {importResult.imported} entries as drafts</span>
              <Button size="sm" variant="outline" onClick={clearFile} className="ml-auto">
                Import another
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <FolderPickerDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        onSelect={handleExportFolder}
      />
    </div>
  );
}
