This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## User API

Signup/login return a signed JWT access token valid for 48 hours. All protected endpoints require the `Authorization` header with a Bearer JWT; cookies alone are not accepted. Public signup always assigns the `CUSTOMER` role. The first administrator must be promoted manually in Neon by a trusted database administrator.

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/connexion`, `/inscription`, `/mot-de-passe-oublie` | French sign-in, customer registration, and password reset pages |
| `GET` | `/admin` | Administrator dashboard; checks the signed-in user's role |
| `POST` | `/api/auth/signup` or `/api/users` | Public customer registration |
| `POST` | `/api/auth/login` | Public login |
| `POST` | `/api/auth/change-password` | Signed-in user; requires JWT and current password |
| `POST` | `/api/auth/forgot-password` | Public; sends reset instructions without confirming whether an account exists |
| `POST` | `/api/auth/reset-password` | Public; consumes a single-use email verification code |
| `POST` | `/api/auth/logout` | Valid JWT required |
| `GET` | `/api/auth/me` | Signed-in user |
| `GET` | `/api/users?page=1` | Admin; lists up to 50 users |
| `GET` | `/api/users/{id}` | User themself or admin |
| `PATCH` | `/api/users/{id}` | User themself; admin can also change roles |
| `DELETE` | `/api/users/{id}` | User themself or admin |
| `GET` | `/api/employees`, `/api/employees/{id}` | Public read |
| `POST`, `PATCH`, `DELETE` | `/api/employees`, `/api/employees/{id}` | Admin JWT required |
| `GET` | `/api/services`, `/api/services/{id}` | Public read |
| `POST`, `PATCH`, `DELETE` | `/api/services`, `/api/services/{id}` | Admin JWT required |
| `GET` | `/api/website-content`, `/api/website-content/{id}` | Public read |
| `POST`, `PATCH`, `DELETE` | `/api/website-content`, `/api/website-content/{id}` | Admin JWT required |
| `GET`, `POST` | `/api/projects` | List owned projects or create a project |
| `GET`, `PATCH` | `/api/projects/{id}` | Project owner, matching guest token, or admin; only admins can change status |
| `GET`, `POST` | `/api/projects/{id}/conversations` | Project owner or guest project token |
| `GET`, `POST` | `/api/conversations/{id}/messages` | Conversation owner; POST calls the configured LLM |
| `POST` | `/api/conversations/{id}/finish` | Generate and save project analysis |
| `GET`, `POST` | `/api/projects/{id}/analysis` | Read or generate structured AI analysis |
| `GET`, `POST` | `/api/projects/{id}/documents` | List or export analysis as PDF/DOCX |
| `GET` | `/api/documents/{id}/download` | Project owner, guest project token, or admin |

Interactive Swagger documentation is available at `/api-docs` (for local development: `http://localhost:3000/api-docs`). After signup/login, copy `accessToken`, click **Authorize**, and paste the token without the `Bearer ` prefix. Each operation shows one combined response entry; the actual HTTP status and response body still reflect that individual request. An administrator account is required to test the user-list endpoint.

The French `/connexion` and `/inscription` pages submit to the same authentication APIs and keep the returned access token in session storage for the current browser tab. After login, administrators are sent to `/admin`, where the role is verified through `/api/auth/me`; other signed-in users return to the landing page and can start a chat. The landing-page menu displays the signed-in user's name and offers administrators a dashboard link. The `/mot-de-passe-oublie` page requests the emailed verification code and submits it with the new password to the reset API. Signup accepts `name`, `email`, `password` (at least 6 characters), and optional `phone`. Login accepts `email` and `password`. Signup and login also accept an optional `guestProjectToken`; when valid, the existing guest project is linked to the account without changing its ID. User deletion is rejected while that user owns projects, to avoid orphaning project ownership. The last administrator cannot be demoted or deleted.

The admin dashboard includes client account management, all available projects, team members, services, and website content. Selecting a customer filters the project list to their projects; selecting a project loads its full metadata, registered-customer or guest contact details, conversations and messages, saved AI analysis, and private document exports. From a project, an administrator can start a conversation, send a clearly attributed administrator message and receive an AI reply, finish one to generate the analysis, generate or refresh the analysis directly, create PDF or DOCX exports for either the analysis or a cahier des charges, and download each existing export through the authenticated endpoint. The dashboard refresh action reloads project details, conversations, messages, analysis, and document metadata from their respective APIs. Project title and description can be edited by the owner or an administrator, while status changes are restricted to administrators. The project-list API currently returns at most 100 projects.

The dashboard lets admins search, create, edit, and delete employee, service, and website-content records. Employee profiles and website sections support photo/image uploads on both create and edit, in addition to setting a URL or local path. Both `POST /api/employees` and `PATCH /api/employees/{id}`, as well as `POST /api/website-content` and `PATCH /api/website-content/{id}`, accept multipart image uploads (PNG, JPEG, WebP, GIF, or AVIF, up to 5 MB).

To change a password while signed in, send the JWT from signup/login as a Bearer token to `POST /api/auth/change-password` with `currentPassword` and `newPassword`. A successful change invalidates existing JWTs; sign in again afterward. Changing your own password through `PATCH /api/users/{id}` is rejected so the current password cannot be bypassed; administrators can still change another user's password.

Employee, service, and website-content records are publicly readable and can only be created, changed, or deleted with an administrator Bearer JWT. Successful writes record the administrator who most recently managed each record. Employee `linkedinUrl` must be an HTTP(S) URL; employee `photo` accepts an HTTP(S) URL or local path. `POST /api/employees` accepts JSON or `multipart/form-data`, so an admin can submit the employee fields and choose a photo file in the same request. `POST /api/website-content` accepts JSON or `multipart/form-data`, so an admin can submit the section fields and choose an image file in the same request. Swagger provides file pickers for both POST endpoints. Website-content `imageUrl` accepts an HTTP(S) URL or a local path inside `public/images`. Supported formats are PNG, JPEG, WebP, GIF, and AVIF, up to 5 MB. Uploaded files are stored in `public/images` and served at `/images/<filename>`. `createdAt` and `updatedAt` are managed automatically by Prisma.

Set `SESSION_SECRET` and `GUEST_PROJECT_TOKEN_SECRET` in the deployment environment. Local development secrets are kept in the ignored `.env.local` file. Access tokens expire after 48 hours. Logout requires a valid JWT but cannot revoke it early; clients must discard tokens, and any copied token remains valid until expiry.

Project creation accepts `title`, optional `description`, and either an authenticated user JWT or guest contact fields (`guestName`, `guestEmail`, optional `guestPhone`). Guest creation returns a signed `guestProjectToken`; send it as a Bearer token for that project until it is claimed during signup/login. Project owners, admins, and the matching guest token can create conversations and send user messages. Administrators can set `sender: "ADMIN"` when sending a message; other callers are rejected, and the admin author is shown distinctly in conversation history. Messages are saved before the AI call, so a provider outage preserves the message for review or retry. `POST /api/projects/{id}/analysis` generates/refreshes the structured analysis and sets project status to `ANALYSIS_READY`; `POST /api/conversations/{id}/finish` also saves the analysis and marks the project `COMPLETED`.

Every AI reply includes all earlier user and AI messages from that conversation, in chronological order. The assistant responds in the language of the user's latest message, and generated analysis follows the language used by the user. There is no application-side message-count or character cutoff; the LLM provider itself can still have a context-window limit.

Configure an OpenAI-compatible Responses API provider in the ignored `.env.local` file and in deployment:

```env
OPENAI_API_KEY="<provider API key>"
OPENAI_MODEL="<model name>"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

The base URL defaults to the OpenAI API URL; chat and analysis requests are sent to its `/responses` endpoint with response storage disabled. The key and model are server-only; they are never sent to clients. An absent key/model returns HTTP 503 for AI actions. Provider errors include a sanitized provider message to help diagnose invalid keys, unavailable models, or request problems. Export requests to `POST /api/projects/{id}/documents` use `{"type":"PDF"}` or `{"type":"DOCX"}` for the standard analysis, or add `"documentKind":"CAHIER_DES_CHARGES"` to generate a French cahier des charges from the saved analysis, for example `{"type":"PDF","documentKind":"CAHIER_DES_CHARGES"}`. PDF and DOCX exports use document-native styling, including a designed cover, consistent section hierarchy, branded headers, and page numbering. Files are saved outside `public/` under `storage/generated-documents/`; download access is checked against the owning project. This local filesystem storage is not durable across many serverless deployments, so use persistent mounted storage or object storage before deploying to an ephemeral serverless host. Generated files are ignored by Git.

Password reset uses the `support@aetherit.tn` mailbox over SMTP with SSL/TLS. Configure these variables in the ignored `.env.local` file and in the deployment environment:

```env
SMTP_HOST="mail.aetherit.tn"
SMTP_PORT="465"
SMTP_USER="support@aetherit.tn"
SMTP_PASSWORD="<mailbox password>"
```

Never commit or share `SMTP_PASSWORD`. `POST /api/auth/forgot-password` always returns the same message for known and unknown email addresses, issues at most one email per account per minute, and sends a six-digit verification code that expires after 60 minutes. Submit the account email, six-digit code, and new password to `POST /api/auth/reset-password`. Codes are stored as keyed hashes, allow at most five attempts, and prior codes are invalidated when a new one is issued. Successful password resets invalidate all existing JWTs for the account.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
