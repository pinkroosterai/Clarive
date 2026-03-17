import { Copy, Lock, AlertTriangle, Clock } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/services/api/apiClient';
import { getPublicShare, verifySharePassword } from '@/services/api/shareLinkService';
import type { SharedEntry } from '@/types/shareLink';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'password' }
  | { kind: 'expired' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; entry: SharedEntry };

export default function PublicShareViewerPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const entry = await getPublicShare(token);
        setState({ kind: 'loaded', entry });
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setState({ kind: 'password' });
          } else if (err.status === 410) {
            setState({ kind: 'expired' });
          } else if (err.status === 404) {
            setState({ kind: 'notfound' });
          } else {
            setState({ kind: 'error', message: err.message });
          }
        } else {
          setState({ kind: 'error', message: 'Something went wrong' });
        }
      }
    })();
  }, [token]);

  const handleVerifyPassword = async () => {
    if (!token || !password) return;
    setVerifying(true);
    setPasswordError('');
    try {
      const entry = await verifySharePassword(token, password);
      setState({ kind: 'loaded', entry });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_PASSWORD') {
        setPasswordError('Incorrect password');
      } else {
        setPasswordError('Something went wrong');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyAll = useCallback(async () => {
    if (state.kind !== 'loaded') return;
    const { entry } = state;
    const parts: string[] = [];
    if (entry.systemMessage) parts.push(`[System]\n${entry.systemMessage}`);
    entry.prompts.forEach((p) => {
      parts.push(p.content);
    });
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [state]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {state.kind === 'loading' && (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {state.kind === 'password' && (
            <Card>
              <CardHeader className="text-center">
                <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <CardTitle>Password Required</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  This shared prompt is password protected.
                </p>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerifyPassword();
                  }}
                  className="space-y-3"
                >
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                  />
                  {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                  <Button className="w-full" disabled={verifying || !password}>
                    {verifying ? 'Verifying...' : 'View Prompt'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {state.kind === 'expired' && (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Link Expired</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This share link has expired and is no longer accessible.
                </p>
              </CardContent>
            </Card>
          )}

          {state.kind === 'notfound' && (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Link Not Found</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This share link is invalid or has been revoked.
                </p>
              </CardContent>
            </Card>
          )}

          {state.kind === 'error' && (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
                <h2 className="text-lg font-semibold">Error</h2>
                <p className="text-sm text-muted-foreground mt-1">{state.message}</p>
              </CardContent>
            </Card>
          )}

          {state.kind === 'loaded' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">{state.entry.title}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Version {state.entry.version}
                    {state.entry.publishedAt &&
                      ` · Published ${new Date(state.entry.publishedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyAll}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy All
                </Button>
              </div>

              {state.entry.systemMessage && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      System Message
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {state.entry.systemMessage}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {state.entry.prompts.map((prompt, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Prompt {state.entry.prompts.length > 1 ? `#${prompt.order + 1}` : ''}
                      {prompt.isTemplate && (
                        <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                          Template
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm font-mono">{prompt.content}</pre>
                    {prompt.templateFields && prompt.templateFields.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Template Variables:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {prompt.templateFields.map((field) => (
                            <span
                              key={field.name}
                              className="text-xs bg-muted px-2 py-1 rounded font-mono"
                            >
                              {`{{${field.name}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        Shared via <span className="font-medium">Clarive</span>
      </footer>
    </div>
  );
}
