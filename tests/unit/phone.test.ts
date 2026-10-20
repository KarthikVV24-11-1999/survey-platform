import { describe, expect, it } from "vitest";
import { contactLabel, formatPhone, isAllowedPhone, phoneEmail, toE164 } from "@/lib/phone";

describe("toE164", () => {
  it("accepts Indian mobile numbers in common formats", () => {
    expect(toE164("IN", "98765 43210")).toBe("+919876543210");
    expect(toE164("IN", "+91 98765-43210")).toBe("+919876543210");
    expect(toE164("IN", "098765 43210")).toBe("+919876543210");
  });

  it("accepts US numbers in common formats", () => {
    expect(toE164("US", "(201) 555-0123")).toBe("+12015550123");
    expect(toE164("US", "1 201 555 0123")).toBe("+12015550123");
  });

  it("rejects numbers that don't fit the country", () => {
    expect(toE164("IN", "12345 67890")).toBeNull();
    expect(toE164("IN", "98765")).toBeNull();
    expect(toE164("US", "(101) 555-0123")).toBeNull();
    expect(toE164("US", "555-0123")).toBeNull();
  });

  it("rejects Caribbean numbers that share +1", () => {
    expect(toE164("US", "(876) 555-0123")).toBeNull();
    expect(isAllowedPhone("+18095550123")).toBe(false);
  });
});

describe("isAllowedPhone", () => {
  it("only allows India and the US", () => {
    expect(isAllowedPhone("+919876543210")).toBe(true);
    expect(isAllowedPhone("+12015550123")).toBe(true);
    expect(isAllowedPhone("+447911123456")).toBe(false);
    expect(isAllowedPhone("919876543210")).toBe(false);
  });
});

describe("display", () => {
  it("formats numbers for people to read", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+12015550123")).toBe("+1 (201) 555-0123");
  });

  it("shows the phone number instead of the placeholder email", () => {
    expect(contactLabel(phoneEmail("+919876543210"))).toBe("+91 98765 43210");
    expect(contactLabel("someone@example.com")).toBe("someone@example.com");
  });
});
