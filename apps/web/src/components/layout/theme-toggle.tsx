import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@worknest/ui';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../stores/theme-store';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setTheme(next)}
            aria-label={label}
            className="grid h-7 w-7 place-items-center rounded-md text-[color:var(--fg-3)] transition-colors hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)]"
          >
            {resolved === 'dark' ? (
              <Sun className="h-[15px] w-[15px]" />
            ) : (
              <Moon className="h-[15px] w-[15px]" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
