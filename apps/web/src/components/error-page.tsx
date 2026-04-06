import { Button } from '@worknest/ui';

interface ErrorPageProps {
  code: '403' | '404' | '500';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorPage({
  code,
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: ErrorPageProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-center min-h-screen bg-background"
    >
      <div className="flex flex-col items-center text-center max-w-md px-6 py-20 relative">
        {/* Background error code */}
        <span
          className="text-[120px] leading-none font-bold text-muted-foreground/10 select-none pointer-events-none absolute top-12"
          aria-hidden="true"
        >
          {code}
        </span>

        {/* Icon */}
        <Icon
          className="w-16 h-16 text-muted-foreground/50 relative z-10"
          aria-hidden="true"
        />

        {/* Title */}
        <h1 className="text-2xl font-semibold text-foreground mt-4">
          {title}
        </h1>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {description}
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-3 mt-8">
          <Button variant="default" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
