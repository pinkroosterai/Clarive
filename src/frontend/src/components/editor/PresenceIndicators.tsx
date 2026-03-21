import { Eye, Pencil } from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PresenceUser } from '@/types';

const MAX_VISIBLE = 3;

interface PresenceIndicatorsProps {
  users: PresenceUser[];
}

export function PresenceIndicators({ users }: PresenceIndicatorsProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1">
      {visible.map((user) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger asChild>
            <div className="relative">
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-7 w-7" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-background bg-background">
                {user.state === 'editing' ? (
                  <Pencil className="h-2 w-2 text-green-500" />
                ) : (
                  <Eye className="h-2 w-2 text-muted-foreground" />
                )}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>
              {user.name} is {user.state}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              +{overflow}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>
              {users
                .slice(MAX_VISIBLE)
                .map((u) => u.name)
                .join(', ')}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
