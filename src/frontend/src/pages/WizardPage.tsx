import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { WizardContent } from '@/components/wizard/WizardContent';
import { useAiEnabled } from '@/hooks/useAiEnabled';

const WizardPage = () => {
  const aiEnabled = useAiEnabled();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Clarive — AI Wizard';
  }, []);

  const hasRedirected = useRef(false);
  useEffect(() => {
    if (!aiEnabled && !hasRedirected.current) {
      hasRedirected.current = true;
      toast.error('AI features are not configured.');
      navigate('/library', { replace: true });
    }
  }, [aiEnabled, navigate]);

  if (!aiEnabled) return null;

  return <WizardContent mode="new" onClose={() => navigate('/library')} />;
};

export default WizardPage;
