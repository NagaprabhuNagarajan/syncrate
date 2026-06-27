---
name: feedback-eslint-pitfalls
description: ESLint rules that regularly trip up code generation — curly braces, no-non-null-assertion, consistent-type-imports
metadata:
  type: feedback
---

Two ESLint rules frequently cause lint failures in generated code.

**Rule 1: `curly` — all if/else bodies must use braces**

```typescript
// WRONG (lint error)
if (!id) return null;

// CORRECT
if (!id) { return null; }
```

**Why:** The `curly` rule is set to `"all"` in the project ESLint config. Single-statement `if` bodies without braces are a lint error, even for guard/early-return patterns. Auto-fixable via `pnpm exec next lint --fix`.

**How to apply:** Always wrap `if` bodies in braces, including one-liners. Check especially in: server actions (early returns on auth), page components (redirect guards), and repository methods (null checks).

---

**Rule 2: `@typescript-eslint/no-non-null-assertion` — ban `!` operator**

```typescript
// WRONG
const line = lines[index]!;

// CORRECT
const line = lines[index];
if (!line) { throw new Error("Assertion failed: line missing"); }
```

**Why:** Non-null assertions mask runtime errors. Project bans them entirely — use explicit guard with `throw` or early return. Applies to array indexing, `.find()` results, and any nullable access.

**How to apply:** Never write `!` to suppress TypeScript's null/undefined checks. Use explicit guards with descriptive error messages.

---

**Rule 3: `@typescript-eslint/consistent-type-imports` — always use `import type`**

```typescript
// WRONG
import { Quotation } from "@/features/sales/types/quotation.types";

// CORRECT
import type { Quotation } from "@/features/sales/types/quotation.types";
```

**Why:** Enforced project-wide for tree shaking and compile-time-only import clarity.

**How to apply:** All imports of types/interfaces/type aliases must use `import type`. Only runtime values (classes, functions, constants) use regular `import`.
