/** Sessiya kodu qaydaları. Başqa sessiya üçün URL-dəki kodu dəyişmək kifayətdir. */
export const DEFAULT_SESSION_CODE = "m545a2";

const SESSION_CODE_PATTERN = /^[a-z0-9-]{3,32}$/;

export function isValidSessionCode(code: string): boolean {
  return SESSION_CODE_PATTERN.test(code);
}
