import {
  Plus,
  Trash2,
  Settings,
  ShieldAlert,
  LayoutDashboard,
  CircleHelp,
  Library,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { InvitationNotificationBell } from './InvitationNotificationBell';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

import { FolderTree } from '@/components/library/FolderTree';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/config';
import { useAuthStore } from '@/store/authStore';

const navLinks = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/' },
  { title: 'Trash', icon: Trash2, url: '/trash' },
];

const utilLinks = [
  { title: 'Settings', icon: Settings, url: '/settings' },
  { title: 'Help', icon: CircleHelp, url: '/help' },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarSeparator />

      {/* New Entry action */}
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New Entry"
              onClick={() => navigate('/entry/new')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground transition-lift hover:glow-brand-sm"
              data-tour="new-entry-btn"
            >
              <Plus className="size-4" />
              <span>New Entry</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block group-data-[collapsible=icon]:mt-1">
            <SidebarMenuButton asChild tooltip="All Prompts">
              <NavLink
                to="/library"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                className="transition-colors duration-150"
              >
                <Library className="size-4" />
                <span>All Prompts</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarContent data-tour="sidebar-nav">
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <FolderTree />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <InvitationNotificationBell />
        <SidebarMenu>
          {navLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink
                  to={item.url}
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                  className="transition-colors duration-150"
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {utilLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink
                  to={item.url}
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                  className="transition-colors duration-150"
                >
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {currentUser?.isSuperUser && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Super Admin">
                <NavLink
                  to="/super"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                  className="transition-colors duration-150"
                >
                  <ShieldAlert className="size-4" />
                  <span>Super Admin</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <p className="px-2 py-1 text-[10px] text-muted-foreground/50 group-data-[collapsible=icon]:hidden">
          {APP_VERSION}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
