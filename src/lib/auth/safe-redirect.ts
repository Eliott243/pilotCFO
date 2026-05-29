/** Allow only same-origin relative paths (blocks open redirects). */
export function safeRedirectPath(next: string | null, fallback = "/onboarding"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(next)) {
    return fallback;
  }
  return next;
}
