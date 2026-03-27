import { useQuery } from '@tanstack/react-query';
import { LogOut, Settings } from 'lucide-react';
import React from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { UserAvatar } from '@/components/common/UserAvatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { buildFolderAncestorPath } from '@/lib/folderUtils';
import { entryService, folderService } from '@/services';
import { useAuthStore } from '@/store/authStore';

interface Crumb {
  label: string;
  href?: string;
}

const LIBRARY_CRUMB: Crumb = { label: 'Library', href: '/library' };

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { entryId, version, folderId } = useParams<{
    entryId?: string;
    version?: string;
    folderId?: string;
  }>();

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const { data: entry } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId,
  });

  // --- Folder page: /library/folder/:folderId ---
  if (folderId && pathname.startsWith('/library/folder/')) {
    const ancestors = buildFolderAncestorPath(folders, folderId);
    if (ancestors.length === 0) {
      return [LIBRARY_CRUMB, { label: 'Folder' }];
    }
    const folderCrumbs: Crumb[] = ancestors.slice(0, -1).map((a) => ({
      label: a.name,
      href: `/library/folder/${a.id}`,
    }));
    const current = ancestors[ancestors.length - 1];
    return [LIBRARY_CRUMB, ...folderCrumbs, { label: current.name }];
  }

  // --- Static routes that don't need data ---
  if (pathname.startsWith('/entry/new/wizard')) {
    return [LIBRARY_CRUMB, { label: 'AI Wizard' }];
  }
  if (pathname.startsWith('/entry/new')) {
    return [LIBRARY_CRUMB, { label: 'New Entry' }];
  }

  // --- Entry routes: build folder context + entry title ---
  if (entryId) {
    const entryTitle = entry?.title ?? '...';
    const folderAncestors = entry ? buildFolderAncestorPath(folders, entry.folderId) : [];
    const folderCrumbs: Crumb[] = folderAncestors.map((a) => ({
      label: a.name,
      href: `/library/folder/${a.id}`,
    }));

    // /entry/:entryId/test
    if (pathname.match(/^\/entry\/[^/]+\/test/)) {
      return [
        LIBRARY_CRUMB,
        ...folderCrumbs,
        { label: entryTitle, href: `/entry/${entryId}` },
        { label: 'Playground' },
      ];
    }

    // /entry/:entryId/enhance
    if (pathname.match(/^\/entry\/[^/]+\/enhance/)) {
      return [
        LIBRARY_CRUMB,
        ...folderCrumbs,
        { label: entryTitle, href: `/entry/${entryId}` },
        { label: 'AI Enhance' },
      ];
    }

    // /entry/:entryId/version/:version
    if (version) {
      return [
        LIBRARY_CRUMB,
        ...folderCrumbs,
        { label: entryTitle, href: `/entry/${entryId}` },
        { label: `Version ${version}` },
      ];
    }

    // /entry/:entryId
    return [LIBRARY_CRUMB, ...folderCrumbs, { label: entryTitle }];
  }

  // --- Top-level pages ---
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/library': 'Library',
    '/settings': 'Settings',
    '/trash': 'Trash',
    '/super': 'Super Admin',
    '/setup-wizard': 'Setup Wizard',
    '/select-workspace': 'Select Workspace',
  };

  return [{ label: map[pathname] || 'Page' }];
}

/** Collapse middle crumbs into an ellipsis when the trail is too long. */
function truncateCrumbs(crumbs: Crumb[]): (Crumb | 'ellipsis')[] {
  if (crumbs.length <= 4) return crumbs;
  return [crumbs[0], 'ellipsis', crumbs[crumbs.length - 2], crumbs[crumbs.length - 1]];
}

export function TopBar() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const rawCrumbs = useBreadcrumbs();
  const crumbs = truncateCrumbs(rawCrumbs);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle px-4">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((item, i) => (
              <React.Fragment key={item === 'ellipsis' ? 'ellipsis' : i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item === 'ellipsis' ? (
                    <BreadcrumbEllipsis />
                  ) : item.href ? (
                    <BreadcrumbLink asChild>
                      <Link to={item.href} className="transition-colors duration-150">
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent outline-none">
            <UserAvatar
              name={currentUser?.name || '?'}
              avatarUrl={currentUser?.avatarUrl}
              className="ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-200"
            />
            <span className="text-sm font-medium hidden sm:inline">{currentUser?.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
