import { createContext, useContext } from 'react';

import { FeatureKey } from '@worknest/client/lib';
import { Server } from '@worknest/client/types';

interface ServerContext extends Server {
  supports(feature: FeatureKey): boolean;
}

export const ServerContext = createContext<ServerContext>({} as ServerContext);

export const useServer = () => useContext(ServerContext);
