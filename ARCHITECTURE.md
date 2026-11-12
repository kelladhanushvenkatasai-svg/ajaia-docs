# Architecture

## Overview

CollabSpace is a small Next.js application. The browser renders the authentication screens, dashboard, and Tiptap editor. Supabase provides identity, PostgreSQL persistence, and database-level access control.

```text
Browser
  |
  | Next.js App Router
  |-- Sign up / sign in
  |-- Dashboard
  |-- Tiptap document editor
  |
  | Supabase client (@supabase/ssr)
  v
Supabase
  |-- Auth users
  |-- PostgreSQL: documents
  |-- PostgreSQL: document_shares
  |-- Row Level Security policies
```

## Application layers

### Frontend

- Next.js App Router organizes the authentication, dashboard, and document routes.
- React client components handle interactive actions such as creating documents, renaming, deleting, sharing, and editing.
- Tiptap provides the rich-text editing experience.
- The editor tracks the user's permission and switches to read-only mode for viewers.
- Imported TXT/Markdown content is converted to HTML and loaded into the editor.

### Authentication and data access

- Supabase Auth manages user registration and login.
- The Supabase browser client is initialized in `lib/supabase/client.ts`.
- The browser uses the project URL and publishable key. Database access is restricted by RLS; the publishable key is not a substitute for authorization.

### Database model

#### `documents`

| Column | Purpose |
| --- | --- |
| `id` | UUID primary key |
| `title` | Document title |
| `content` | Tiptap document JSON stored as JSONB |
| `owner_id` | Owner's Supabase Auth user ID |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

#### `document_shares`

| Column | Purpose |
| --- | --- |
| `id` | UUID primary key |
| `document_id` | Shared document |
| `shared_with` | Recipient's Supabase Auth user ID |
| `permission` | `viewer` or `editor` |
| `created_at` | Share creation timestamp |

A unique constraint prevents duplicate share records for the same document and recipient.

## Authorization

Row Level Security is enabled on both tables.

- A document owner can read, update, and delete their document.
- A user with a share record can read the document.
- A user with `editor` permission can update the document.
- A user with `viewer` permission can read but cannot update the document.
- Only the document owner can manage sharing records.
- The sharing database function verifies that the caller owns the document, validates the permission, resolves the recipient by email, and prevents sharing with oneself.

The database policies are the security boundary. Frontend permission checks improve the user experience but are not relied on as the only authorization mechanism.

## Persistence flow

1. The user signs in through Supabase Auth.
2. The dashboard queries documents owned by the current user and documents shared with them.
3. Creating a document inserts a row into `documents` with the current user as `owner_id`.
4. Opening a document loads its content and determines whether the user is the owner, editor, or viewer.
5. Editor changes are saved to the document's JSONB `content` field after a short autosave delay.
6. Sharing creates or updates a row in `document_shares`; the recipient sees the document in **Shared with Me**.

## Deliberate scope

This implementation focuses on the assignment's core workflows. It does not implement real-time collaborative cursors, conflict resolution, comments, or version history.
