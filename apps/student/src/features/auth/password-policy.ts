export const DEFAULT_PASSWORD_POLICY = { minLength: 8, maxBytes: 72 };
export type PasswordPolicy = typeof DEFAULT_PASSWORD_POLICY;
export const passwordBytes = (password: string) => new TextEncoder().encode(password).length;
export function newPasswordValid(password: string, confirm: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY) {
 return password.length >= policy.minLength && passwordBytes(password) <= policy.maxBytes && password === confirm;
}
