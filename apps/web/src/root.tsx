// A workaround to make the globals.css file work in the web app
import '../../../packages/ui/src/styles/globals.css';

import { useRegisterSW } from 'virtual:pwa-register/react';

import { App } from '@worknest/ui';

export const Root = () => {
  useRegisterSW({
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  return <App type="web" />;
};
