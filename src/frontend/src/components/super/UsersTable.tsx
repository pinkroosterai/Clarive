import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  Check,
  KeyRound,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { DeleteUserDialog } from '@/components/super/DeleteUserDialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export default function UsersTable() {
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  // ── Table state ──
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);

  // ── Dialog state ──
  const [deleteTarget, setDeleteTarget] = useState<SuperUser | null>(null);
  const [resetTarget, setResetTarget] = useState<SuperUser | null>(null);

  const sortBy = sorting[0]?.id;
  const sortDesc = sorting[0]?.desc ?? true;

  // ── Data fetching ──
  const { data, isLoading } = useQuery({
    queryKey: ['super', 'users', { page, pageSize, search: debouncedSearch, sortBy, sortDesc }],
    queryFn: () =>
      getSuperUsers({ page, pageSize, search: debouncedSearch || undefined, sortBy, sortDesc }),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // ── Columns ──
  const columns = useMemo<ColumnDef<SuperUser>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            User
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{user.name}</span>
                  {user.isSuperUser && (
                    <Badge variant="outline" className="text-xs px-1 py-0 gap-0.5">
                      <Shield className="size-3" />
                      Super
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-foreground-muted truncate">{user.email}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Role
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: 'auth',
        header: 'Auth',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.isGoogleAccount ? 'Google' : 'Password'}
          </Badge>
        ),
      },
      {
        id: 'verified',
        header: 'Verified',
        cell: ({ row }) =>
          row.original.emailVerified ? (
            <Check className="size-4 text-success-text" />
          ) : (
            <X className="size-4 text-foreground-muted" />
          ),
      },
      {
        id: 'workspaces',
        header: 'Workspaces',
        cell: ({ row }) => {
          const ws = row.original.workspaces;
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
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-foreground-muted whitespace-nowrap">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.id === currentUserId;
          if (isSelf) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!user.isGoogleAccount && (
                  <DropdownMenuItem onClick={() => setResetTarget(user)}>
                    <KeyRound className="size-4 mr-2" />
                    Reset Password
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(user)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [currentUserId]
  );

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, ci) => (
                    <TableCell key={ci}>
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {debouncedSearch ? 'No users found matching your search.' : 'No users found.'}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-foreground-muted">
          {total} user{total !== 1 ? 's' : ''} total
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
                {[10, 20, 50, 100].map((size) => (
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

      <DeleteUserDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}
