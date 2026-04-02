import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/orgs')({
  component: OrgsPage,
});

function OrgsPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">
          Organization
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select or create an organization to get started.
        </p>
      </div>
    </div>
  );
}
