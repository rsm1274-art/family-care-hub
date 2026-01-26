export const generateOneTimeAccessLink = (personId: string): string => {
  const baseUrl = 'https://familycarehub.com/access';
  const token = btoa(`${personId}:${Date.now()}`);
  return `${baseUrl}?token=${token}`;
};