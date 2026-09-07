export function temporaryPasswordError(password: string): string | null {
  if (!password) return "password_required";
  if (password.length > 128) return "password_too_long";
  return null;
}
