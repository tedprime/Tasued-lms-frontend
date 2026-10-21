const messages: Record<string, string> = {
  STAFF_NOT_PROVISIONED: "This Microsoft account does not have active staff access to TASFUED LMS. Ask your LMS administrator to add or activate your staff account, or sign in with the correct Microsoft account.",
  not_staff: "This account doesn't have a staff role in the LMS. Ask your LMS administrator for access.",
  INVALID_OIDC_STATE: "Your sign-in attempt expired or could not be verified. Please start again using the button below.",
  MICROSOFT_CANCELLED: "Microsoft sign-in was cancelled. Select Sign in with Microsoft when you're ready to try again.",
  MICROSOFT_NOT_CONFIGURED: "Microsoft sign-in is currently unavailable. Please contact your LMS administrator.",
  RATE_LIMITED: "There have been too many sign-in attempts. Please wait a minute and try again.",
};
export function signInErrorMessage(code: string) {
  return Object.hasOwn(messages, code) ? messages[code] : "We couldn't complete Microsoft sign-in. Please try again. If this continues, contact your LMS administrator.";
}
