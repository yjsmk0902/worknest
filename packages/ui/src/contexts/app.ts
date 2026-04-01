import { createContext, useContext } from 'react';

import { AppType } from '@worknest/client/types';

interface AppContext {
  type: AppType;
}

export const AppContext = createContext<AppContext>({} as AppContext);

export const useApp = () => useContext(AppContext);
