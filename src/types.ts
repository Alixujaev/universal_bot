export interface SessionData {
  function?: string;
}


export type UserType = {
  chatId: number;
  name: string;
  language: { code: string, name: string, flag: string };
  is_premium: boolean;
}