// Countries allowed for phone sign-in. Add an entry here to support another one.
export const PHONE_COUNTRIES = [
  { code: "IN", name: "India", dial: "+91", national: /^[6-9]\d{9}$/, placeholder: "98765 43210" },
  { code: "US", name: "United States", dial: "+1", national: /^[2-9]\d{2}[2-9]\d{6}$/, placeholder: "(201) 555-0123" },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["code"];

// Caribbean area codes share +1 but are billed as international, and are a
// common target for SMS fraud.
const BLOCKED_NANP = new Set([
  "242", "246", "264", "268", "284", "345", "441", "473", "649", "658", "664",
  "721", "758", "767", "784", "809", "829", "849", "868", "869", "876",
]);

// Phone users get a placeholder address on this reserved domain.
const PHONE_EMAIL_DOMAIN = "phone.invalid";

export function toE164(country: PhoneCountry, input: string): string | null {
  const c = PHONE_COUNTRIES.find((p) => p.code === country);
  if (!c) return null;
  let digits = input.replace(/\D/g, "");
  const dialDigits = c.dial.slice(1);
  if (digits.length > 10 && digits.startsWith(dialDigits)) digits = digits.slice(dialDigits.length);
  if (country === "IN" && digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  const e164 = `${c.dial}${digits}`;
  return isAllowedPhone(e164) ? e164 : null;
}

export function isAllowedPhone(e164: string) {
  return PHONE_COUNTRIES.some((c) => {
    if (!e164.startsWith(c.dial)) return false;
    const national = e164.slice(c.dial.length);
    return c.national.test(national) && !(c.dial === "+1" && BLOCKED_NANP.has(national.slice(0, 3)));
  });
}

export function formatPhone(e164: string) {
  if (e164.startsWith("+91") && e164.length === 13) return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  if (e164.startsWith("+1") && e164.length === 12) return `+1 (${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`;
  return e164;
}

export const phoneEmail = (e164: string) => `${e164.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`;
export const isPhoneEmail = (email: string) => email.endsWith(`@${PHONE_EMAIL_DOMAIN}`);

// What to show for an account: the email, or the phone number for phone sign-ups.
export function contactLabel(email: string) {
  return isPhoneEmail(email) ? formatPhone(`+${email.split("@")[0]}`) : email;
}
