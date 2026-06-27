This shouldn't be a simple "use HTTPS" document. It should become the Security Bible for Syncrate.

Recommended structure:

SECURITY_GUIDELINES.md

1. Security Philosophy
2. Secure Development Lifecycle (SSDLC)
3. Threat Model
4. Zero Trust Architecture
5. OWASP Top 10 Mitigation
6. Authentication Security
7. Authorization Security
8. Multi-Tenant Isolation
9. Row Level Security (Supabase)
10. Database Security
11. API Security
12. Frontend Security
13. Backend Security
14. AI Security
15. Connected Business Security
16. Encryption Standards
17. Secret Management
18. Environment Variables
19. Logging & Audit
20. Rate Limiting
21. DDoS Protection
22. Bot Protection
23. Session Management
24. Password Policy
25. File Upload Security
26. Email Security
27. Webhook Security
28. Payment Security
29. Backup Security
30. Dependency Security
31. Docker Security
32. CI/CD Security
33. Incident Response
34. Vulnerability Management
35. Penetration Testing
36. Compliance Checklist
37. Secure Coding Checklist
38. Security Review Checklist
39. Release Security Checklist
40. Production Security Checklist
    It should define rules like

Example:

Never expose Supabase Service Role Key
Never trust client validation
Every API validates organization_id
Never expose internal errors
Always sanitize user input
Use parameterized queries
Never store secrets in Git
JWT must expire
Refresh tokens must rotate
Every file upload is virus scanned
Every financial action is audited
Every permission is validated server-side
