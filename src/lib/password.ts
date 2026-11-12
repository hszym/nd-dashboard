// Shared rules for choosing a password (used by the account and reset pages).

export const MIN_PASSWORD_LENGTH = 10;

/** Returns an error message, or null when the new password is acceptable. */
export function validateNewPassword(password: string, confirm: string, current?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return "The two passwords don't match.";
  if (current !== undefined && password === current) {
    return "Choose a password different from the current one.";
  }
  return null;
}
