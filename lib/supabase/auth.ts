import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

function bearerTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return null;
  }

  const token = headerValue.slice(7).trim();
  return token || null;
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
  const token = bearerTokenFromHeader(request.headers.get("authorization"));
  if (!token) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id || !data.user.email) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

