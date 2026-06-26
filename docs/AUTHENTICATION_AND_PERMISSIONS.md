# 06_AUTHENTICATION_AND_PERMISSIONS.md

# Syncrate Authentication & Authorization Specification

**Version:** 1.0

---

# 1. Overview

This document defines the authentication, authorization, identity management, session management, and security model for the Syncrate platform.

The objective is to ensure that every business, employee, customer, supplier, and administrator can securely access only the data and features they are authorized to use.

The platform follows the principles of **Zero Trust**, **Least Privilege Access**, **Role-Based Access Control (RBAC)**, and **Multi-Tenant Security**.

---

# 2. Objectives

The authentication and authorization system shall:

* Secure user identities.
* Protect organization data.
* Prevent unauthorized access.
* Support multiple authentication methods.
* Enable fine-grained permissions.
* Maintain complete audit trails.
* Support enterprise security requirements.

---

# 3. Authentication Architecture

Authentication Flow

```text
User

↓

Login Request

↓

Authentication Provider

↓

Credential Validation

↓

Multi-Factor Authentication (Optional)

↓

JWT Access Token

↓

Refresh Token

↓

Role & Permission Loading

↓

Dashboard
```

Authentication is handled using **Supabase Auth** with JWT-based session management.

---

# 4. Supported Authentication Methods

Current Release

* Email & Password
* Magic Link
* Invitation-based Registration

Future Releases

* Google Sign-In
* Microsoft Entra ID
* GitHub Login
* Apple Sign-In
* SAML SSO
* OAuth 2.0
* LDAP
* Active Directory

---

# 5. User Types

The platform supports multiple user categories.

### Platform Users

* Super Administrator
* Platform Support

### Organization Users

* Owner
* Administrator
* Manager
* Accountant
* Sales Executive
* Warehouse Manager
* Cashier
* Employee

### External Users

* Connected Supplier
* Connected Customer (Future)
* Auditor (Read Only)

---

# 6. Organization Membership

A single user may belong to multiple organizations.

Example

```
John Smith

↓

ABC Hardware

↓

XYZ Distributors

↓

Metro Steels
```

Each organization maintains independent:

* Roles
* Permissions
* Settings
* Audit Logs
* Business Data

---

# 7. Multi-Tenant Security

Every request must contain:

* User ID
* Organization ID
* Branch ID (Optional)

Every database query is filtered by:

```
organization_id
```

Cross-organization access is prohibited.

---

# 8. Role-Based Access Control (RBAC)

Permissions are assigned to roles rather than users.

### Default Roles

* Super Admin
* Owner
* Admin
* Branch Manager
* Accountant
* Sales Executive
* Warehouse Manager
* Cashier
* Employee
* Viewer

Organizations may create custom roles.

---

# 9. Permission Structure

Permission Format

```
module.action
```

Examples

```
customer.create
customer.view
customer.update
customer.delete

invoice.create
invoice.post
invoice.cancel

inventory.adjust
inventory.transfer

report.export

ai.generate

settings.manage
```

---

# 10. Permission Matrix

### Customer

* Create
* View
* Update
* Archive
* Export

### Supplier

* Create
* View
* Update
* Archive

### Product

* Create
* View
* Update
* Delete
* Import
* Export

### Inventory

* View
* Adjust
* Transfer
* Audit

### Purchase

* Create
* Approve
* Cancel

### Sales

* Create
* Approve
* Cancel

### Invoice

* Create
* Edit Draft
* Post
* Print
* Share
* Cancel

### Payments

* Receive
* Refund
* Reverse

### Reports

* View
* Export
* Schedule

### AI

* View
* Generate
* Configure

### Administration

* User Management
* Role Management
* Organization Settings
* Billing
* Audit Logs

---

# 11. Session Management

The platform shall support:

* Secure JWT Access Tokens
* Refresh Tokens
* Automatic Token Renewal
* Session Timeout
* Forced Logout
* Device-based Sessions

Default Session Timeout

8 Hours

Configurable by organization.

---

# 12. Password Policy

Requirements

* Minimum 8 Characters
* Uppercase Letter
* Lowercase Letter
* Number
* Special Character

Password History

Last 5 passwords cannot be reused.

Password Expiry

Configurable.

---

# 13. Multi-Factor Authentication (Future)

Supported Methods

* Email OTP
* SMS OTP
* Authenticator App
* Security Keys (FIDO2)

Organizations may enforce MFA for selected roles.

---

# 14. Login Security

Security Features

* Rate Limiting
* Account Lockout
* Brute Force Protection
* CAPTCHA (Future)
* Suspicious Login Detection
* New Device Detection

---

# 15. API Authorization

Every API request validates:

* Authentication Token
* User Status
* Organization Membership
* Permissions
* Tenant Context

Unauthorized requests return appropriate HTTP status codes.

---

# 16. Row-Level Security (RLS)

Every business table uses Row-Level Security.

Example Policy

```
organization_id = current_user.organization_id
```

Users cannot access records belonging to other organizations.

---

# 17. Branch-Level Permissions

Organizations may restrict users to specific branches.

Example

Sales Executive

↓

Chennai Branch Only

Cannot access

Coimbatore Branch

---

# 18. Approval Permissions

Certain actions require elevated permissions.

Examples

* High-value Invoice Approval
* Purchase Approval
* Inventory Adjustment
* Payment Reversal
* Credit Limit Override

Approval workflows are configurable.

---

# 19. Connected Business Permissions

Organizations decide what connected businesses may access.

Permissions include:

* Receive Purchase Orders
* Receive Invoices
* View Product Catalog
* Share Delivery Updates
* View Pricing
* Exchange Documents

Private business data is never shared.

---

# 20. Audit Logging

Every authentication event is recorded.

Examples

* Login
* Logout
* Password Change
* MFA Enabled
* Role Changed
* Permission Updated
* Failed Login
* Session Expired

Audit Log Fields

* User
* Organization
* Timestamp
* IP Address
* Device
* Browser
* Action

Audit records are immutable.

---

# 21. Error Handling

Authentication Errors

* Invalid Credentials
* Account Disabled
* Session Expired
* Invalid Token

Authorization Errors

* Permission Denied
* Organization Access Denied
* Branch Access Denied

Security Errors

* Suspicious Login
* Brute Force Attempt
* Invalid Session

---

# 22. Performance Requirements

Login

< 2 Seconds

Permission Validation

< 100 ms

JWT Verification

< 50 ms

Session Refresh

< 500 ms

Availability

99.9%

---

# 23. Security Best Practices

* HTTPS Only
* Secure Cookies
* CSRF Protection
* XSS Prevention
* SQL Injection Prevention
* Content Security Policy (CSP)
* Secure Headers
* Encryption at Rest
* Encryption in Transit

---

# 24. Future Enhancements

* Single Sign-On (SSO)
* Enterprise Identity Providers
* Passwordless Login
* Biometric Authentication
* Device Trust
* Adaptive Authentication
* Risk-Based Authentication
* Just-In-Time User Provisioning

---

# 25. Acceptance Criteria

Authentication

* Users authenticate securely.
* Sessions are managed correctly.
* Token refresh works seamlessly.

Authorization

* Permissions are enforced consistently.
* Unauthorized access is blocked.
* Role changes take effect immediately.

Security

* Multi-tenant isolation is guaranteed.
* Audit logs capture all security events.
* Sensitive information is protected.

Performance

* Authentication meets defined SLAs.
* Permission checks are optimized.
* High availability is maintained.

---

# Summary

The Authentication & Permissions architecture provides the security foundation for Syncrate. By combining secure authentication, role-based authorization, multi-tenant isolation, row-level security, audit logging, and enterprise security practices, the platform ensures that every user can securely access only the resources they are authorized to use while maintaining compliance, scalability, and operational integrity.

---

# End of 06_AUTHENTICATION_AND_PERMISSIONS.md
