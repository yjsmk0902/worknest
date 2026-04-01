import { useEffect, useState } from 'react';

import { AppInitOutput, AppType } from '@worknest/client/types';
import { build } from '@worknest/core';
import { collections } from '@worknest/ui/collections';
import { AppAssets } from '@worknest/ui/components/app/app-assets';
import { AppLayout } from '@worknest/ui/components/app/app-layout';
import { AppLoading } from '@worknest/ui/components/app/app-loading';
import { AppReset } from '@worknest/ui/components/app/app-reset';
import { AppThemeProvider } from '@worknest/ui/components/app/app-theme-provider';
import { RadarProvider } from '@worknest/ui/components/app/radar-provider';
import { AppContext } from '@worknest/ui/contexts/app';

interface AppProviderProps {
  type: AppType;
}

export const AppProvider = ({ type }: AppProviderProps) => {
  const [initOutput, setInitOutput] = useState<AppInitOutput | null>(null);

  useEffect(() => {
    console.log(`Worknest | Version: ${build.version} | SHA: ${build.sha}`);

    window.worknest.init().then((output) => {
      console.log('Worknest | Initialized');

      if (output === 'success') {
        collections
          .preload()
          .then(() => {
            setInitOutput('success');
          })
          .catch((err) => {
            setInitOutput('error');
            console.error('Worknest | Error preloading', err);
          });
      } else {
        setInitOutput(output);
      }
    });
  }, []);

  return (
    <AppContext.Provider value={{ type }}>
      <AppThemeProvider init={initOutput}>
        <AppAssets />
        {initOutput === null && <AppLoading />}
        {initOutput === 'reset' && <AppReset />}
        {initOutput === 'success' && (
          <RadarProvider>
            <AppLayout type={type} />
          </RadarProvider>
        )}
      </AppThemeProvider>
    </AppContext.Provider>
  );
};
