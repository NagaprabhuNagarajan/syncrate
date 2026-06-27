This becomes mandatory for every contributor.

Not "suggestions".

Rules.

CODING_STANDARDS.md

1. Engineering Principles
2. Clean Code
3. SOLID
4. DRY
5. KISS
6. YAGNI
7. Folder Structure
8. Naming Conventions
9. TypeScript Rules
10. React Rules
11. Next.js Rules
12. State Management
13. API Layer
14. Hooks
15. Forms
16. Validation
17. Error Handling
18. Logging
19. Testing
20. Accessibility
21. Performance
22. Security
23. Git Standards
24. Pull Request Rules
25. Code Review Checklist
26. Documentation
27. Comments
28. Refactoring
29. Anti-patterns
30. Definition of Done
    React Rules
    ✅ Functional Components

✅ Hooks

✅ Composition

❌ Class Components

❌ Props Drilling

❌ Inline Business Logic

❌ Anonymous Functions in JSX
TypeScript Rules
Always

strict: true

Never

any

Prefer

unknown

Always

Readonly Types

Use

type

for unions

interface

for object contracts
Naming Rules
Component

InvoiceCard.tsx

Hook

useInvoice.ts

Utility

calculateTax.ts

Service

invoice.service.ts

Repository

invoice.repository.ts

Constant

MAX_RETRY_COUNT

Enum

InvoiceStatus

Interface

Invoice

Type

InvoiceFilter

Zod Schema

invoiceSchema
Folder Structure
src/

app/

components/

features/

shared/

hooks/

services/

repositories/

stores/

schemas/

utils/

types/

constants/

styles/

tests/
Git Rules
main

↓

develop

↓

feature/invoice

↓

Pull Request

↓

Review

↓

Merge
Commit Convention
feat:

fix:

refactor:

docs:

test:

perf:

build:

ci:

style:

chore:

Example

feat(invoice): add GST calculation

fix(auth): refresh token expiry

refactor(customer): optimize search
