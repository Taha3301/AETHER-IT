# API tests

Run the complete suite with:

```sh
npm test
```

Use watch mode while editing:

```sh
npm run test:watch
```

`unit/` tests exercise request validation, the OpenAI-compatible Responses API client, and real PDF/DOCX generation in isolated temporary test runs. `integration/` tests invoke every exported Next.js API route handler directly and mock Prisma, SMTP, LLM requests, file storage, and JWT verification at their external boundaries.

Coverage includes signup/login/logout/current user/password changes and reset flows; user CRUD and account-protection rules; employee, service, and website-content CRUD and multipart image forms; project creation and ownership/guest-token access; conversations, full-history AI messaging, structured analysis generation, private exports, and authorized downloads.

The integration suite does not connect to or modify Neon, send email, or call an external AI provider. No production or development database credentials are needed to run it.
