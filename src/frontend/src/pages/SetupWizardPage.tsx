import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bot,
  Mail,
  Shield,
  Settings,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  SkipForward,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api/apiClient';
import { setConfigValue } from '@/services/api/configService';

const STEPS = [
  { key: 'welcome', label: 'Welcome', icon: Settings },
  { key: 'ai', label: 'AI Provider', icon: Bot },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'auth', label: 'Google OAuth', icon: Shield },
  { key: 'complete', label: 'Complete', icon: Check },
] as const;

const SetupWizardPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    document.title = 'Clarive \u2014 Setup Wizard';
  }, []);

  // AI Provider state
  const [aiProviderName, setAiProviderName] = useState('');
  const [aiEndpoint, setAiEndpoint] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');

  // Email state
  const [emailProvider, setEmailProvider] = useState('none');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailSmtpHost, setEmailSmtpHost] = useState('');
  const [emailSmtpPort, setEmailSmtpPort] = useState('587');
  const [emailSmtpUsername, setEmailSmtpUsername] = useState('');
  const [emailSmtpPassword, setEmailSmtpPassword] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [emailFromName, setEmailFromName] = useState('Clarive');

  // Google OAuth state
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');

  // Track what was configured
  const [configured, setConfigured] = useState<string[]>([]);

  const saveMutation = useMutation({
    mutationFn: async (entries: { key: string; value: string }[]) => {
      for (const { key, value } of entries) {
        if (value) await setConfigValue(key, value);
      }
    },
  });

  const saveAiConfig = async () => {
    if (!aiApiKey) {
      setStep(step + 1);
      return;
    }
    try {
      // Create provider via the authenticated providers API
      await api.post('/api/super/ai-providers', {
        name: aiProviderName || 'OpenAI',
        endpointUrl: aiEndpoint || null,
        apiKey: aiApiKey,
      });
      setConfigured((prev) => [...prev, 'AI Provider']);
      toast.success('AI provider configured');
      setStep(step + 1);
    } catch {
      toast.error('Failed to save AI provider');
    }
  };

  const saveEmailConfig = async () => {
    if (emailProvider === 'none') {
      setStep(step + 1);
      return;
    }
    const entries: { key: string; value: string }[] = [
      { key: 'Email:Provider', value: emailProvider },
      { key: 'Email:FromAddress', value: emailFromAddress },
      { key: 'Email:FromName', value: emailFromName },
    ];
    if (emailProvider === 'resend') {
      entries.push({ key: 'Email:ApiKey', value: emailApiKey });
    } else if (emailProvider === 'smtp') {
      entries.push(
        { key: 'Email:SmtpHost', value: emailSmtpHost },
        { key: 'Email:SmtpPort', value: emailSmtpPort },
        { key: 'Email:SmtpUsername', value: emailSmtpUsername },
        { key: 'Email:SmtpPassword', value: emailSmtpPassword }
      );
    }
    try {
      await saveMutation.mutateAsync(entries);
      setConfigured((prev) => [...prev, 'Email']);
      toast.success('Email configured');
      setStep(step + 1);
    } catch {
      toast.error('Failed to save email config');
    }
  };

  const saveGoogleConfig = async () => {
    if (!googleClientId) {
      setStep(step + 1);
      return;
    }
    try {
      await saveMutation.mutateAsync([
        { key: 'Google:ClientId', value: googleClientId },
        { key: 'Google:ClientSecret', value: googleClientSecret },
      ]);
      setConfigured((prev) => [...prev, 'Google OAuth']);
      toast.success('Google OAuth configured');
      setStep(step + 1);
    } catch {
      toast.error('Failed to save Google config');
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                i === step
                  ? 'text-primary'
                  : i < step
                    ? 'text-foreground-muted'
                    : 'text-foreground-muted/40'
              }`}
            >
              {i < step ? (
                <Check className="size-3.5" />
              ) : (
                <s.icon className="size-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="size-3 text-foreground-muted/30 ml-1" />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <motion.div
          key={currentStep.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-border-subtle bg-surface elevation-1 p-6"
        >
          {/* Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <AnvilIcon className="mx-auto size-16" />
              <h1 className="text-2xl font-bold tracking-tight">Configure Your Instance</h1>
              <p className="text-foreground-muted text-sm max-w-sm mx-auto">
                Let's set up the core services for your Clarive instance. You can skip optional steps
                and configure them later via Super Admin &gt; Settings.
              </p>
              <Button className="w-full" onClick={() => setStep(1)}>
                Get Started <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          {/* AI Provider */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">AI Provider</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Connect an OpenAI-compatible API to enable AI features (prompt generation,
                  evaluation, playground).
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Provider Name</Label>
                  <Input
                    value={aiProviderName}
                    onChange={(e) => setAiProviderName(e.target.value)}
                    placeholder="e.g., OpenAI, Azure OpenAI, Ollama"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={aiEndpoint}
                    onChange={(e) => setAiEndpoint(e.target.value)}
                    placeholder="Leave empty for default OpenAI endpoint"
                    autoComplete="off"
                  />
                  <p className="text-xs text-foreground-muted">
                    For custom providers: https://your-endpoint.com/v1
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder="sk-..."
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="gap-1">
                  <ChevronLeft className="size-4" /> Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep(step + 1)}
                  className="gap-1 text-foreground-muted"
                >
                  <SkipForward className="size-4" /> Skip
                </Button>
                <Button className="ml-auto gap-1" onClick={saveAiConfig}>
                  {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Save & Continue <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Email */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Email Service</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Configure email for verification, invitations, and password resets. Leave as "None"
                  to auto-verify users.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Select value={emailProvider} onValueChange={setEmailProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (auto-verify users)</SelectItem>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="smtp">SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {emailProvider === 'resend' && (
                  <div className="space-y-1.5">
                    <Label>Resend API Key</Label>
                    <Input
                      type="password"
                      value={emailApiKey}
                      onChange={(e) => setEmailApiKey(e.target.value)}
                      placeholder="re_..."
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {emailProvider === 'smtp' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>SMTP Host</Label>
                        <Input
                          value={emailSmtpHost}
                          onChange={(e) => setEmailSmtpHost(e.target.value)}
                          placeholder="smtp.gmail.com"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Port</Label>
                        <Input
                          value={emailSmtpPort}
                          onChange={(e) => setEmailSmtpPort(e.target.value)}
                          placeholder="587"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Username</Label>
                      <Input
                        value={emailSmtpUsername}
                        onChange={(e) => setEmailSmtpUsername(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={emailSmtpPassword}
                        onChange={(e) => setEmailSmtpPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}
                {emailProvider !== 'none' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>From Address</Label>
                      <Input
                        type="email"
                        value={emailFromAddress}
                        onChange={(e) => setEmailFromAddress(e.target.value)}
                        placeholder="noreply@example.com"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>From Name</Label>
                      <Input
                        value={emailFromName}
                        onChange={(e) => setEmailFromName(e.target.value)}
                        placeholder="Clarive"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                  <ChevronLeft className="size-4" /> Back
                </Button>
                {emailProvider === 'none' && (
                  <Button
                    variant="ghost"
                    onClick={() => setStep(step + 1)}
                    className="gap-1 text-foreground-muted"
                  >
                    <SkipForward className="size-4" /> Skip
                  </Button>
                )}
                <Button className="ml-auto gap-1" onClick={saveEmailConfig}>
                  {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  {emailProvider === 'none' ? 'Continue' : 'Save & Continue'}{' '}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Google OAuth */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Google OAuth (Optional)</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Allow users to sign in with their Google account. Skip this if you don't need
                  Google authentication.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Client ID</Label>
                  <Input
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="123456789.apps.googleusercontent.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1">
                  <ChevronLeft className="size-4" /> Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep(step + 1)}
                  className="gap-1 text-foreground-muted"
                >
                  <SkipForward className="size-4" /> Skip
                </Button>
                <Button className="ml-auto gap-1" onClick={saveGoogleConfig}>
                  {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Save & Continue <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Complete */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-bg">
                <Check className="size-6 text-success-text" />
              </div>
              <h2 className="text-lg font-semibold">Setup Complete</h2>
              {configured.length > 0 ? (
                <div className="text-sm text-foreground-muted">
                  <p>Configured: {configured.join(', ')}</p>
                  <p className="mt-1">
                    You can change these anytime in Super Admin &gt; Settings.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">
                  No services configured yet. You can set them up later in Super Admin &gt;
                  Settings.
                </p>
              )}
              <Button className="w-full" onClick={() => navigate('/', { replace: true })}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SetupWizardPage;
