import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Server-only client with the service role key — used by Server Actions to upload files. */
export function supabaseAdmin() {
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    // Node < 22 has no native WebSocket global that realtime-js requires at
    // construction time, even though this app never uses realtime features.
    realtime: { transport: WebSocket as unknown as never },
  });
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "exam-prep-uploads";

export async function uploadFile(path: string, file: File): Promise<string> {
  const client = supabaseAdmin();
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
