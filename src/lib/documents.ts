import { supabase } from "@/lib/supabase";

/** Records that the signed-in person reviewed this document (once per person; the database refuses anyone else's name). */
export async function markReviewed(documentId: string, userId: string): Promise<string | null> {
  const { error } = await supabase
    .from("document_reviews")
    .insert({ document_id: documentId, user_id: userId });
  // Already reviewed by this person: nothing to do.
  return error && error.code !== "23505" ? error.message : null;
}

/** Withdraws the signed-in person's own review. */
export async function unmarkReviewed(documentId: string, userId: string): Promise<string | null> {
  const { error } = await supabase
    .from("document_reviews")
    .delete()
    .eq("document_id", documentId)
    .eq("user_id", userId);
  return error?.message ?? null;
}
