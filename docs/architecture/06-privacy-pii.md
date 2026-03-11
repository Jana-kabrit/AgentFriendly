# Layer 5: Privacy & PII Masking

The privacy layer ensures that sensitive user data is never exposed to AI agents unless the requesting agent has been explicitly granted permission via a scoped delegation token.

## Problem Statement

AI agents accessing SaaS platforms often need to read user data (account details, transaction history, profile information) as part of their task. However:

- The agent may be operating on behalf of a *different* user than the data owner.
- The operator may not have a legitimate need to see raw PII.
- Regulatory requirements (GDPR, CCPA, HIPAA) may prohibit sharing identifiable data with third-party systems.

The privacy layer solves this by **masking PII in all agent responses by default**, and allowing specific fields to be revealed only when the agent presents a valid scoped delegation token.

---

## Built-in PII Patterns

The SDK ships with regex patterns for common PII types:

| Pattern key | What it matches | Replacement |
|-------------|----------------|-------------|
| `email` | Email addresses | `[EMAIL]` |
| `phone` | US/international phone numbers | `[PHONE]` |
| `ssn` | US Social Security Numbers | `[SSN]` |
| `creditCard` | Credit card numbers (with Luhn check) | `[CARD]` |
| `ipv4` | IPv4 addresses | `[IP]` |
| `ipv6` | IPv6 addresses | `[IP]` |
| `dateOfBirth` | Common DOB formats | `[DOB]` |
| `passport` | US passport numbers | `[PASSPORT]` |

Custom patterns can be added:
```typescript
privacy: {
  customPatterns: [
    { key: "employee_id", pattern: /EMP-\d{6}/g, replacement: "[EMPLOYEE_ID]" },
  ],
}
```

---

## Text Masking

Applied to any string response body (including Markdown):

```
Input:  "User john.doe@example.com called from +1-555-123-4567"
Output: "User [EMAIL] called from [PHONE]"
```

---

## JSON Field Masking

More surgical than regex-on-text. Specific JSON field names are always masked regardless of value format:

```typescript
privacy: {
  maskedFields: ["email", "phone", "ssn", "creditCardNumber", "dateOfBirth"],
}
```

```json
// Input (what the route handler returns)
{
  "userId": "u_123",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-999-8888",
  "subscription": "pro"
}

// Output (what the agent receives)
{
  "userId": "u_123",
  "name": "Jane Smith",
  "email": "[EMAIL]",
  "phone": "[PHONE]",
  "subscription": "pro"
}
```

The `userId` is not masked because it is not in `maskedFields` — agents need stable identifiers to complete tasks.

---

## Reversible Tokenization

For round-trip workflows (e.g., an agent reads masked data, then submits a form), masking can use reversible tokens instead of placeholders:

```typescript
privacy: {
  reversibleTokenization: true,
}
```

```
email: "jane@example.com"
→ masked: "tok_e3f7a2b1"   (deterministic per session)
→ agent submits: { email: "tok_e3f7a2b1" }
→ SDK backend unmasks: "jane@example.com"
```

Tokens are deterministic per `(value, sessionId)` pair, scoped to the current session, and expire with the session.

---

## Scope-Based Unmasking

The multi-tenancy layer (Layer 8) issues delegation tokens that may carry `reveal:` scopes. When a valid delegation token is present, masking is selectively bypassed.

```
Delegation token scopes: ["read:profile", "reveal:email", "reveal:phone"]

→ email field: NOT masked  (reveal:email scope present)
→ phone field: NOT masked  (reveal:phone scope present)
→ ssn field: MASKED       (no reveal:ssn scope)
```

This is the only mechanism to reveal masked fields. Agents without a delegation token always receive fully masked responses.

---

## Masking Scope

Masking is applied at the **framework adapter level**, not in the middleware pipeline. This means masking happens after the route handler has executed and produced a response body — giving route handlers access to full, unmasked data internally.

```
Route handler → full user data (internal, server-side)
      │
      ▼ (framework adapter post-processing)
Privacy masker → apply text masking + field masking
      │
      ▼
Agent receives masked response
```

This design means the privacy layer has no impact on server-side logic (database queries, business rules) — only on what leaves the server.

---

## Disabling Masking

If your site does not handle PII, you can disable the layer entirely:

```typescript
privacy: {
  enabled: false,
}
```
