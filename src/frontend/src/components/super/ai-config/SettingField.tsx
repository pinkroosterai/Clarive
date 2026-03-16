import { Database, Minus, RotateCcw, Server } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { ConfigSetting } from '@/services/api/configService';

interface SettingFieldProps {
  setting: ConfigSetting;
  onReset: () => void;
  isResetting: boolean;
  children: React.ReactNode;
}

export default function SettingField({
  setting,
  onReset,
  isResetting,
  children,
}: SettingFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{setting.label}</Label>
        <SourceBadge source={setting.source} />
      </div>
      <p className="text-xs text-foreground-muted">{setting.description}</p>
      <div className="flex items-center gap-2">
        {children}
        {setting.source === 'dashboard' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isResetting}
                  className="shrink-0"
                >
                  <RotateCcw className={`size-4 ${isResetting ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove dashboard override and revert to environment default</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: ConfigSetting['source'] }) {
  switch (source) {
    case 'dashboard':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-info-text border-info-border gap-1 text-xs">
                <Database className="size-3" />
                Dashboard
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Value set via the super user dashboard (overrides environment)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case 'environment':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-success-text border-success-border gap-1 text-xs"
              >
                <Server className="size-3" />
                Environment
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Value provided by environment variable</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case 'none':
    default:
      return (
        <Badge
          variant="outline"
          className="text-foreground-muted border-foreground-muted/30 gap-1 text-xs"
        >
          <Minus className="size-3" />
          Not configured
        </Badge>
      );
  }
}
