---
name: design-system
description: Design tokens, component standards, and UX quality bar for Syncrate UI
metadata:
  type: project
---

**Design philosophy:** Minimal UI, Maximum Information Density, Progressive Disclosure, Mobile-First, Accessibility First. Think Linear/Stripe Dashboard/Notion/Vercel quality.

**Color palette:**
- Primary: `#2563EB` (blue), Hover: `#1D4ED8`, Light: `#DBEAFE`
- Secondary: `#0F172A` (dark slate), Light: `#334155`
- Success: `#16A34A`, Warning: `#F59E0B`, Error: `#DC2626`, Info: `#0EA5E9`
- Neutral: Tailwind neutral palette (gray-50 → gray-900)

**Typography:**
- Font: Inter (fallback: System UI)
- H1: 36px, H2: 30px, H3: 24px, H4: 20px, H5: 18px, Body: 16px, Small: 14px, Caption: 12px

**Spacing:** 4px base unit. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px

**Border radius:** Small: 4px, Medium: 8px, Large: 12px, XL: 16px, Card: 20px

**Icons:** Lucide React, sizes 16/20/24/32/48px. Always include accessible labels.

**Layout:** Sidebar + Top Nav + Content Area + Right Drawer + Modal/Toast/Notification layers
Grid: 12 cols desktop, 8 tablet, 4 mobile

**Animations (Framer Motion):** 150–300ms duration only. Drawer Slide, Modal Fade, Toast Slide, Skeleton Loading, page transitions, card hover. Never over-animate.

**Theme:** Light + Dark + System. User preference stored per account.

**Accessibility:** WCAG 2.2 AA. Keyboard navigation, focus indicators, ARIA labels, screen reader support, semantic HTML, color contrast compliance.

**Tables must include:** Sort, filter, pagination, column resize/pin, export, search, bulk actions, row selection.

**Forms must include:** Validation, keyboard navigation, error messages, loading state, success state.

**Every page needs:** Empty states, loading skeletons, error states, smooth transitions.

**Component docs standard:** Documentation, usage examples, props, accessibility notes, design tokens, states, variants, testing guidelines.
