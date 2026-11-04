export const registrationPath = "/upload/";
export const registrationLoginPath = "/login/?intent=register-ui";
export const registrationSignupPath = "/signup/?intent=register-ui";

export function isRegistrationIntent(search: string) {
  return new URLSearchParams(search).get("intent") === "register-ui";
}
