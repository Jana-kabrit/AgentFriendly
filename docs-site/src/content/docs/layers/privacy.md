---
title: "Layer 5: Privacy & PII Masking"
description: Automatically redact PII from agent responses.
---

# Layer 5: Privacy & PII Masking

Layer 5 prevents sensitive information from leaking to AI agents. It masks PII in text content and JSON responses automatically.

## Built-in PII Patterns

| Pattern                 | Placeholder       | Example               |
| ----------------------- | ----------------- | --------------------- |
| Email addresses         | `[EMAIL]`         | `user@example.com`    |
| US phone numbers        | `[PHONE]`         | `555-123-4567`        |
| Social Security Numbers | `[SSN]`           | `123-45-6789`         |
| Credit card numbers     | `[CREDIT_CARD]`   | `4111 1111 1111 1111` |
| IPv4 addresses          | `[IP_ADDRESS]`    | `192.168.1.100`       |
| Dates of birth          | `[DATE_OF_BIRTH]` | `01/15/1990`          |
| US ZIP codes            | `[ZIP_CODE]`      | `94105`               |

## Configuration

```typescript
createAgentFriendlyMiddleware({
  privacy: {
    enabled: true,

    // Add custom regex patterns
    additionalPatterns: [
      /ACC-\d{8}/g, // Internal account numbers
      /KEY-[A-Z0-9]{16}/g, // API key pattern
    ],

    // Routes to apply masking to
    applyToRoutes: ["**"], // All routes (default)
    excludeRoutes: ["/admin/**"], // Exclude admin routes

    // Enable Named Entity Recognition (when NLP library is available)
    nerEnabled: false,
  },
});
```

## Text Content Masking

For markdown/text responses, masking is applied to the full body:

```typescript
import { maskTextContent } from "@agentfriendly/core";

const response = `
Contact support at helpdesk@example.com or call 555-123-4567.
Your SSN on file: 123-45-6789.
`;

const masked = maskTextContent(response, config.privacy);
// → "Contact support at [EMAIL] or call [PHONE].
//    Your SSN on file: [SSN]."
```

## JSON Field Masking

For API routes, mask specific fields before returning to agents:

```typescript
import { maskJsonFields, getAgentContext } from "@agentfriendly/core";

export async function GET() {
  const ctx = getAgentContext();
  const user = await db.users.findById(/* ... */);

  // Mask PII fields (respects reveal: scopes from delegation tokens)
  const safeUser = maskJsonFields(
    user,
    ["email", "phone", "ssn", "address.street"], // dot notation for nested
    ctx!,
  );

  return Response.json(safeUser);
}
```

## Scope-Based Unmasking

When using [multi-tenancy](/layers/multi-tenancy), agents with explicit `reveal:` scopes can access unmasked fields:

```typescript
// Issue delegation token with reveal scope
await issueDelegationToken(
  userId,
  tenantId,
  [
    "read:profile",
    "reveal:email", // This agent is allowed to see the email
  ],
  config.multiTenancy,
);

// In your route handler:
const safeUser = maskJsonFields(user, ["email", "phone"], ctx!);
// email → unmasked (agent has reveal:email scope)
// phone → "[REDACTED]" (no reveal:phone scope)
```

## Reversible Tokenization

For round-trip workflows where the agent needs to reference a PII value it cannot read, use reversible tokenization:

```typescript
createAgentFriendlyMiddleware({
  privacy: {
    enabled: true,
    reversibleTokenization: true,
    tokenizationSecret: process.env.TOKENIZATION_SECRET,
  },
});
```

PII is replaced with deterministic tokens that only your server can decode — the agent can use the token to reference the field without seeing the original value.
