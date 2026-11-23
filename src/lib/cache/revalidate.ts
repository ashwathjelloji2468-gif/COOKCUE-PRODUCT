import { revalidatePath } from "next/cache";

export function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Gracefully ignore when invoked outside Next.js request context (e.g. Vitest tests, scripts)
  }
}
