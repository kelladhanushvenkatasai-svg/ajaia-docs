
export type DocumentPermission = "owner" | "editor" | "viewer";

export function canEditDocument(permission: DocumentPermission): boolean {
  return permission === "owner" || permission === "editor";
}
