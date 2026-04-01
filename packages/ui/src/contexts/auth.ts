import { createContext, useContext } from 'react';

import { Server } from '@worknest/client/types';

export interface AuthContextValue {
  server: Server;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthLayout');
  }
  return context;
};
