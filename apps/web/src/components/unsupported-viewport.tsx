import { Monitor } from 'lucide-react';
import { useMediaQuery } from '../hooks/use-media-query';

export function UnsupportedViewport() {
  const isTooSmall = useMediaQuery('(max-width: 1023px)');

  if (!isTooSmall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center text-center max-w-sm px-6">
        <Monitor className="w-16 h-16 text-muted-foreground/50" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground mt-6">
          데스크톱 브라우저를 사용해 주세요
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Worknest는 1024px 이상의 화면에서 최적화되어 있습니다. 더 넓은 화면의 브라우저에서 다시
          접속해 주세요.
        </p>
      </div>
    </div>
  );
}
