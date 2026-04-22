# Document Invariants
1. A table must have valid predefined coordinates and label.
2. A customer must have a valid phone number, name, and party size.
3. Access to tables and customers is granted to any authenticated user with a verified email (the restaurant staff).

# Dirty Dozen Payloads
1. Create table without label.
2. Update table state to invalid enum value.
3. Massive string injection on table customerName.
4. Update list query without `request.auth.token.email_verified`.
5. Remove `updatedAt` from table on update.
6. Bypass `updatedAt == request.time` constraint.
7. Spoofed email address without verification.
8. Update customer status with invalid enum.
9. Array explosion (none used here, but schema restricts to known maps).
10. Massive string for customer name.
11. PII exposure bypass (only staff should see phones).
12. Shadow update (adding ghost fields like `isAdmin`).

# Test Runner Implementation
Will be in `firestore.rules.test.ts`.
