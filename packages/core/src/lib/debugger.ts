import debug from 'debug';

export const createDebugger = (namespace: string) => {
  return debug(`worknest:${namespace}`);
};
