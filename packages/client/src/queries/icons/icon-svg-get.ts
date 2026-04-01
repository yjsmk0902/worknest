export type IconSvgGetQueryInput = {
  type: 'icon.svg.get';
  id: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'icon.svg.get': {
      input: IconSvgGetQueryInput;
      output: string | null;
    };
  }
}
