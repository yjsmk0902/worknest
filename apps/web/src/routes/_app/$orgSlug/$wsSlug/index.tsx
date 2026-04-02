import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$orgSlug/$wsSlug/my/inbox',
      params: {
        orgSlug: params.orgSlug,
        wsSlug: params.wsSlug,
      },
    });
  },
});
