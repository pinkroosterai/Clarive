import { useQuery } from '@tanstack/react-query';
import {
  AllCommunityModule,
  type ColDef,
  type ICellRendererParams,
  type SortChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { format } from 'date-fns';
import {
  Check,
  Download,
  KeyRound,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { DeleteUserDialog } from '@/components/super/DeleteUserDialog';
import { agGridTheme } from '@/lib/agGridTheme';
import { ResetPasswordDialog } from '@/components/super/ResetPasswordDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/formatters';
import { getSuperUsers, type SuperUser } from '@/services/api/superService';
import { useAuthStore } from '@/store/authStore';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Cell Renderers ──

interface GridContext {
  currentUserId: string | undefined;
  setResetTarget: (user: SuperUser) => void;
  setDeleteTarget: (user: SuperUser) => void;
}

function UserCell({ data }: ICellRendererParams<SuperUser>) {
  if (!data) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      <Avatar className="size-7">
        {data.avatarUrl && <AvatarImage src={data.avatarUrl} alt={data.name} />}
        <AvatarFallback className="text-xs">{getInitials(data.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate" title={data.name}>{data.name}</span>
          {data.isSuperUser && (
            <Badge variant="outline" className="text-xs px-1 py-0 gap-0.5">
              <Shield className="size-3" />
              Super
            </Badge>
          )}
        </div>
        <div className="text-xs text-foreground-muted truncate" title={data.email}>{data.email}</div>
      </div>
    </div>
  );
}

function RoleCell({ data }: ICellRendererParams<SuperUser>) {
  if (!data) return null;
  return (
    <Badge variant="outline" className="capitalize">
      {data.role}
    </Badge>
  );
}

function AuthCell({ data }: ICellRendererParams<SuperUser>) {
  if (!data) return null;
  return (
    <Badge variant="outline" className="text-xs">
      {data.isGoogleAccount ? 'Google' : 'Password'}
    </Badge>
  );
}

function VerifiedCell({ data }: ICellRendererParams<SuperUser>) {
  if (!data) return null;
  return data.emailVerified ? (
    <Check className="size-4 text-success-text" />
  ) : (
    <X className="size-4 text-foreground-muted" />
  );
}

function WorkspacesCell({ data }: ICellRendererParams<SuperUser>) {
  if (!data) return null;
  const ws = data.workspaces;
  if (ws.length === 0) return <span className="text-xs text-foreground-muted">None</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="cursor-default">
            {ws.length}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="text-xs space-y-0.5">
            {ws.map((w) => (
              <li key={w.id}>
                {w.name} ({w.role})
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActionsCell({ data, context }: ICellRendererParams<SuperUser, unknown, GridContext>) {
  if (!data) return null;
  const { currentUserId, setResetTarget, setDeleteTarget } = context;
  if (data.id === currentUserId) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!data.isGoogleAccount && (
          <DropdownMenuItem onClick={() => setResetTarget(data)}>
            <KeyRound className="size-4 mr-2" />
            Reset Password
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => setDeleteTarget(data)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4 mr-2" />
          Delete User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main Component ──

export default function UsersTable() {
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const gridRef = useRef<AgGridReact<SuperUser>>(null);

  // ── Table state ──
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [authFilter, setAuthFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);

  // ── Dialog state ──
  const [deleteTarget, setDeleteTarget] = useState<SuperUser | null>(null);
  const [resetTarget, setResetTarget] = useState<SuperUser | null>(null);

  // ── Data fetching ──
  const { data, isLoading } = useQuery({
    queryKey: [
      'super',
      'users',
      { page, pageSize, search: debouncedSearch, roleFilter, authFilter, sortBy, sortDesc },
    ],
    queryFn: () =>
      getSuperUsers({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        authType: authFilter || undefined,
        sortBy,
        sortDesc,
      }),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // ── Column definitions ──
  const columnDefs = useMemo<ColDef<SuperUser>[]>(
    () => [
      {
        field: 'name',
        headerName: 'User',
        sortable: true,
        flex: 3,
        minWidth: 160,
        cellRenderer: UserCell,
      },
      {
        field: 'role',
        headerName: 'Role',
        sortable: true,
        flex: 1,
        minWidth: 70,
        cellRenderer: RoleCell,
      },
      {
        headerName: 'Auth',
        sortable: false,
        flex: 1,
        minWidth: 70,
        cellRenderer: AuthCell,
      },
      {
        headerName: 'Verified',
        sortable: false,
        flex: 1,
        minWidth: 70,
        cellRenderer: VerifiedCell,
      },
      {
        headerName: 'Workspaces',
        sortable: false,
        flex: 1,
        minWidth: 80,
        cellRenderer: WorkspacesCell,
      },
      {
        field: 'createdAt',
        headerName: 'Created',
        sortable: true,
        sort: 'desc',
        flex: 1,
        minWidth: 90,
        valueFormatter: (p) => (p.value ? formatDate(p.value) : ''),
      },
      {
        headerName: '',
        sortable: false,
        width: 50,
        cellRenderer: ActionsCell,
        suppressHeaderMenuButton: true,
      },
    ],
    []
  );

  // ── Sort handler ──
  const onSortChanged = useCallback((event: SortChangedEvent<SuperUser>) => {
    const sortModel = event.api.getColumnState().find((c) => c.sort != null);
    if (sortModel) {
      const fieldMap: Record<string, string> = {
        name: 'name',
        role: 'role',
        createdAt: 'createdAt',
      };
      setSortBy(fieldMap[sortModel.colId] ?? 'createdAt');
      setSortDesc(sortModel.sort === 'desc');
    } else {
      setSortBy('createdAt');
      setSortDesc(true);
    }
    setPage(1);
  }, []);

  // ── CSV export ──
  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `users-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    });
  }, []);

  // ── Grid context (passed to cell renderers) ──
  const gridContext = useMemo<GridContext>(
    () => ({ currentUserId, setResetTarget, setDeleteTarget }),
    [currentUserId]
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-foreground-muted">
          {total.toLocaleString()} user{total !== 1 ? 's' : ''} total
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={users.length === 0}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="Editor">Editor</SelectItem>
            <SelectItem value="Viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={authFilter}
          onValueChange={(v) => {
            setAuthFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All auth" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All auth</SelectItem>
            <SelectItem value="password">Password</SelectItem>
            <SelectItem value="google">Google</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty state — no users at all */}
      {!isLoading && total === 0 && !debouncedSearch && (
        <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-12 flex flex-col items-center gap-3 text-center">
          <Users className="size-10 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No users found.</p>
        </div>
      )}

      {/* Zero-results state — search returned nothing */}
      {!isLoading && total === 0 && debouncedSearch && (
        <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 flex flex-col items-center gap-2 text-center">
          <Search className="size-8 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No matching users</p>
          <p className="text-xs text-foreground-muted">Try adjusting your search term</p>
        </div>
      )}

      {/* Grid */}
      {(isLoading || total > 0) && (
        <div
          className="ag-theme-quartz rounded-md border"
          style={{ height: users.length > 0 ? Math.min(500, 48 + users.length * 58) : 500 }}
        >
          <AgGridReact<SuperUser>
            ref={gridRef}
            theme={agGridTheme}
            modules={[AllCommunityModule]}
            rowData={users}
            columnDefs={columnDefs}
            rowHeight={56}
            loading={isLoading}
            context={gridContext}
            suppressMovableColumns
            suppressCellFocus
            animateRows={false}
            onSortChanged={onSortChanged}
          />
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-foreground-muted">
            Showing {users.length > 0 ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-muted">Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-foreground-muted">
                {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteUserDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}
