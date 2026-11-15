type AuthErrorLike = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

function asAuthError(error: unknown): AuthErrorLike {
  return error && typeof error === "object" ? error as AuthErrorLike : {};
}

/** Maps session verification failures to accurate, actionable client messages. */
export function getAuthStatusMessage(error: unknown): string {
  const authError = asAuthError(error);
  const status = authError.status;
  const code = authError.code?.toLowerCase() ?? "";
  const name = authError.name?.toLowerCase() ?? "";
  const message = authError.message?.toLowerCase() ?? "";

  if (name === "authsessionmissingerror" || code === "session_not_found") {
    return "No active sign-in session was found in this browser. Sign in again to use cloud data.";
  }
  if (status === 429) {
    return "Supabase Auth is temporarily rate-limiting requests. Wait a few minutes before trying again.";
  }
  if (status === 400 || status === 401 || ["refresh_token_not_found", "invalid_grant", "session_expired"].includes(code)) {
    return "Your sign-in session is expired or invalid. Sign in again to use cloud data.";
  }
  if (name === "authretryablefetcherror" || error instanceof TypeError || /network|fetch|connection/.test(message)) {
    return "Couldn’t reach Supabase Auth. Check your connection and try again.";
  }
  if (typeof status === "number" && status >= 500) {
    return "Supabase Auth is temporarily unavailable. Try again shortly.";
  }
  return "Couldn’t verify your sign-in session. Cloud data may be unavailable until you reconnect.";
}
