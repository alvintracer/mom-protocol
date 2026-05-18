/**
 * Password validation utilities for momment. auth.
 *
 * Rules:
 *  - 8+ characters
 *  - At least 1 letter (a-z or A-Z)
 *  - At least 1 number (0-9)
 *  - At least 1 special character (!@#$%^&*…)
 */

export type PasswordCheck = {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
};

export function checkPassword(pw: string): PasswordCheck {
  return {
    minLength: pw.length >= 8,
    hasLetter: /[a-zA-Z]/.test(pw),
    hasNumber: /\d/.test(pw),
    hasSpecial: /[^a-zA-Z0-9]/.test(pw),
  };
}

export function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.minLength && c.hasLetter && c.hasNumber && c.hasSpecial;
}
