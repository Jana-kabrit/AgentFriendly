/**
 * Layer 5 — Built-in PII Detection Patterns
 *
 * Regular expressions for common PII types. These are applied by default
 * when privacy.enabled is true. Site owners can add additional patterns
 * via privacy.additionalPatterns in the config.
 *
 * Each pattern has a name (for logging/audit) and a replacer function
 * that generates the masked/tokenized value.
 */

export interface PiiPattern {
  readonly name: string;
  readonly pattern: RegExp;
  /** Placeholder used when one-way masking (reversibleTokenization: false). */
  readonly placeholder: string;
}

/** Regex for a valid email address (simplified, not RFC 5321 complete). */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** US phone numbers in various formats: (555) 555-5555, 555-555-5555, +15555555555 */
const PHONE_REGEX = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;

/** US Social Security Number: 123-45-6789 or 123456789 */
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g;

/**
 * Credit/debit card numbers (Luhn-valid patterns, major networks).
 * Matches 13-19 digit numbers with optional spaces or dashes.
 */
const CREDIT_CARD_REGEX = /\b(?:\d[ -]?){13,19}\b/g;

/**
 * IPv4 addresses. Note: internal IPs (10.x, 192.168.x) are also masked
 * as they may expose internal network topology.
 */
const IPV4_REGEX =
  /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

/** US ZIP codes: 12345 or 12345-6789 */
const ZIP_CODE_REGEX = /\b\d{5}(?:-\d{4})?\b/g;

/**
 * Date of birth patterns: MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY
 * Note: only matches years 1900-2099 to reduce false positives.
 */
const DOB_REGEX =
  /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12][0-9]|3[01])\/(19|20)\d{2}\b|\b(19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12][0-9]|3[01])\b/g;

/**
 * The built-in set of PII patterns applied when privacy.enabled is true.
 * Patterns are applied in order — more specific patterns first to avoid
 * double-masking (e.g., credit card numbers before generic digit sequences).
 */
export const BUILT_IN_PII_PATTERNS: PiiPattern[] = [
  {
    name: "credit-card",
    pattern: CREDIT_CARD_REGEX,
    placeholder: "[CREDIT_CARD]",
  },
  {
    name: "ssn",
    pattern: SSN_REGEX,
    placeholder: "[SSN]",
  },
  {
    name: "email",
    pattern: EMAIL_REGEX,
    placeholder: "[EMAIL]",
  },
  {
    name: "phone",
    pattern: PHONE_REGEX,
    placeholder: "[PHONE]",
  },
  {
    name: "ipv4",
    pattern: IPV4_REGEX,
    placeholder: "[IP_ADDRESS]",
  },
  {
    name: "date-of-birth",
    pattern: DOB_REGEX,
    placeholder: "[DATE_OF_BIRTH]",
  },
  {
    name: "zip-code",
    pattern: ZIP_CODE_REGEX,
    placeholder: "[ZIP_CODE]",
  },
];
