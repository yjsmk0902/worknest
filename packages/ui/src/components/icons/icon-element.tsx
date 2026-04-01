import { ShieldQuestionMark } from 'lucide-react';

import { useApp } from '@worknest/ui/contexts/app';
import { useQuery } from '@worknest/ui/hooks/use-query';
import { cn } from '@worknest/ui/lib/utils';

interface IconElementProps {
  id: string;
  className?: string;
}

const IconElementWeb = ({ id, className }: IconElementProps) => {
  return (
    <div className={cn('icon-element', className)}>
      <svg fill="currentColor" viewBox="0 0 24 24">
        <use href={`/assets/icons.svg#${id}`} />
      </svg>
    </div>
  );
};

const IconElementDesktop = ({ id, className }: IconElementProps) => {
  const svgQuery = useQuery(
    {
      type: 'icon.svg.get',
      id,
    },
    {
      staleTime: Infinity,
    }
  );

  if (svgQuery.isLoading) {
    return null;
  }

  const svg = svgQuery.data;
  if (!svg) {
    return (
      <div className={cn('icon-element', className)}>
        <ShieldQuestionMark />
      </div>
    );
  }

  return (
    <div
      className={cn('icon-element', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export const IconElement = ({ id, className }: IconElementProps) => {
  const app = useApp();

  if (app.type === 'web') {
    return <IconElementWeb id={id} className={className} />;
  }

  return <IconElementDesktop id={id} className={className} />;
};
