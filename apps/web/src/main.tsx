import * as Comlink from 'comlink';
import { createRoot } from 'react-dom/client';

import { eventBus } from '@worknest/client/lib';
import { BrowserNotSupported } from '@worknest/web/components/browser-not-supported';
import { MobileNotSupported } from '@worknest/web/components/mobile-not-supported';
import { WorknestWorkerApi } from '@worknest/web/lib/types';
import { isMobileDevice, isOpfsSupported } from '@worknest/web/lib/utils';
import { Root } from '@worknest/web/root';
import DedicatedWorker from '@worknest/web/workers/dedicated?worker';

const initializeApp = async () => {
  const isMobile = isMobileDevice();
  if (isMobile) {
    const root = createRoot(document.getElementById('root') as HTMLElement);
    root.render(<MobileNotSupported />);
    return;
  }

  const hasOpfsSupport = await isOpfsSupported();
  if (!hasOpfsSupport) {
    const root = createRoot(document.getElementById('root') as HTMLElement);
    root.render(<BrowserNotSupported />);
    return;
  }

  const worker = new DedicatedWorker();
  const workerApi = Comlink.wrap<WorknestWorkerApi>(worker);

  window.worknest = {
    init: async () => {
      return workerApi.init();
    },
    reset: async () => {
      await workerApi.reset();
      window.location.reload();
    },
    executeMutation: async (input) => {
      return workerApi.executeMutation(input);
    },
    executeQuery: async (input) => {
      return workerApi.executeQuery(input);
    },
    executeQueryAndSubscribe: async (key, input) => {
      return workerApi.executeQueryAndSubscribe(key, input);
    },
    saveTempFile: async (file) => {
      return workerApi.saveTempFile(file);
    },
    unsubscribeQuery: async (queryId) => {
      return workerApi.unsubscribeQuery(queryId);
    },
    openExternalUrl: async (url) => {
      window.open(url, '_blank');
    },
    showItemInFolder: async () => {
      // No-op on web
    },
    showFileSaveDialog: async () => undefined,
  };

  window.eventBus = eventBus;

  workerApi.subscribe(
    Comlink.proxy((event) => {
      eventBus.publish(event);
    })
  );

  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(<Root />);
};

initializeApp().catch(() => {
  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(<BrowserNotSupported />);
});
