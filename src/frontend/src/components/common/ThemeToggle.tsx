import { Sun, Moon, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';

const cycle: ThemePreference[] = ['dark', 'light', 'system'];

const icons: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const labels: Record<ThemePreference, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
};

export function ThemeToggle() {
  const { themePreference, setThemePreference } = useTheme();

  const next = () => {
    const idx = cycle.indexOf(themePreference);
    setThemePreference(cycle[(idx + 1) % cycle.length]);
  };

  const Icon = icons[themePreference];
  const label = labels[themePreference];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={next}
          className="size-8 text-foreground-muted hover:text-foreground"
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
