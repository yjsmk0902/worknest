export type EmojiSvgGetQueryInput = {
  type: 'emoji.svg.get';
  id: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'emoji.svg.get': {
      input: EmojiSvgGetQueryInput;
      output: string | null;
    };
  }
}
