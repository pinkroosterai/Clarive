import { Home } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { buildFolderAncestorPath } from '@/lib/folderUtils';
import type { Folder } from '@/types';

/** Max visible segments before truncation kicks in (root + last 2). */
const MAX_VISIBLE = 3;

function BreadcrumbSegment({
  segment,
  isLast,
}: {
  segment: { id: string; name: string };
  isLast: boolean;
}) {
  return (
    <BreadcrumbItem>
      {isLast ? (
        <BreadcrumbPage>{segment.name}</BreadcrumbPage>
      ) : (
        <>
          <BreadcrumbLink asChild>
            <Link to={`/library/folder/${segment.id}`}>{segment.name}</Link>
          </BreadcrumbLink>
          <BreadcrumbSeparator />
        </>
      )}
    </BreadcrumbItem>
  );
}

export function FolderBreadcrumb({
  folderId,
  folders,
}: {
  folderId: string;
  folders: Folder[];
}) {
  const path = useMemo(
    () => buildFolderAncestorPath(folders, folderId),
    [folders, folderId]
  );
  if (path.length === 0) return null;

  const needsTruncation = path.length > MAX_VISIBLE;
  const visibleSegments = needsTruncation
    ? [path[0], ...path.slice(-2)]
    : path;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Root / Home */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/library">
              <Home className="size-3.5" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {needsTruncation && (
          <>
            <BreadcrumbSegment segment={visibleSegments[0]} isLast={false} />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {(needsTruncation ? visibleSegments.slice(1) : visibleSegments).map(
          (segment, i, arr) => (
            <BreadcrumbSegment
              key={segment.id}
              segment={segment}
              isLast={i === arr.length - 1}
            />
          )
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
