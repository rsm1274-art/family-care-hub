declare module '../services/accessService' {
  export function generateOneTimeAccessLink(personId: string): string;
}