# CollabSpace

A lightweight collaborative document editor built for the Ajaia product-engineering assignment. Users can create and manage documents, edit rich text, import TXT/Markdown files, and share documents with viewer or editor permissions.

## Features

- Email/password sign-up and login with Supabase Auth
- Create, rename, open, and delete documents
- Rich-text editing with headings, bold, italic, underline, and lists
- Import `.txt` and `.md` files (maximum file size: 2 MB)
- Autosave document content to Supabase
- Share documents with existing CollabSpace users as viewers or editors
- Separate **My Documents** and **Shared with Me** lists
- Read-only experience for viewers
- Row Level Security (RLS) policies protect document and sharing data

## Tech stack

- Next.js 16, App Router
- React and TypeScript
- Tailwind CSS
- Supabase Auth and PostgreSQL
- Tiptap editor
- Lucide React icons
- Vercel deployment

## Run locally

### 1. Requirements

- Node.js 22 or a compatible supported Node.js release
- npm
- A Supabase project

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Use the Supabase project URL (not the `/rest/v1/` endpoint) and the publishable key. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or commit it to source control.

### 4. Configure Supabase

Run the database schema and Row Level Security setup from the project’s Supabase SQL setup in the Supabase SQL Editor. The application expects the `documents` and `document_shares` tables and the associated access-control functions and policies.

For local assignment testing, configure Supabase email authentication to match the signup flow you intend to demonstrate. If email confirmation is enabled, users must complete the confirmation step before signing in.

Document sharing is by the recipient's account email. The recipient must already have an account in the application.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Check the production build

```bash
npm run build
```

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Sign up and sign in |
| `/dashboard` | Owned documents and documents shared with the user |
| `/documents/[id]` | Document editor |

## Project structure

```text
app/
  page.tsx
  dashboard/
    page.tsx
  documents/
    [id]/
      page.tsx
      document-editor.tsx
  layout.tsx
  globals.css
lib/
  supabase/
    client.ts
```

## Notes and limitations

- Sharing is supported for users who have already registered with the email address being invited.
- The editor uses autosave; allow a moment for the save operation to complete before closing the page.
- Imported Markdown supports common headings, emphasis, inline code, and ordered/unordered lists. It is not intended to be a complete Markdown parser.
- Real-time simultaneous editing, comments, and document version history are outside the scope of this lightweight assignment implementation.

## Production verification

The production build completed successfully with `npm run build` on November 11, 2026. TypeScript validation and Next.js page generation completed without errors.
