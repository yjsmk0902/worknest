import { Link } from '@tanstack/react-router';
import { Folder } from 'lucide-react';

interface ProjectCardProps {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
  iconUrl: string | null;
  issueCounter: number;
  updatedAt: string;
  orgSlug: string;
  wsSlug: string;
}

function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

export function ProjectCard({
  name,
  prefix,
  description,
  iconUrl,
  issueCounter,
  updatedAt,
  orgSlug,
  wsSlug,
  id,
}: ProjectCardProps) {
  return (
    <Link
      to={`/${orgSlug}/${wsSlug}/projects/${id}/issues`}
      className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-all duration-150 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      role="listitem"
      aria-label={`프로젝트: ${name}`}
    >
      {/* Icon */}
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted p-2">
        {iconUrl ? (
          <span className="text-lg">{iconUrl}</span>
        ) : (
          <Folder className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Prefix */}
      <span className="text-xs font-mono text-muted-foreground">{prefix}</span>

      {/* Name */}
      <span className="mt-0.5 truncate text-sm font-medium text-foreground">{name}</span>

      {/* Description */}
      {description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
      )}

      {/* Meta */}
      <span className="mt-2 text-xs text-muted-foreground">
        이슈 {issueCounter} &middot; {getRelativeTime(updatedAt)}
      </span>
    </Link>
  );
}
