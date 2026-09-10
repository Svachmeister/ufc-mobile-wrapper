// Always logs the raw error to Metro before it gets mapped to a friendly
// message — the friendly message is all the user ever sees, but the real
// name/message/status must never be silently swallowed in development.
export function logAuthError(context: string, error: unknown): void {
  if (error && typeof error === 'object') {
    const { name, message, status } = error as { name?: unknown; message?: unknown; status?: unknown };
    console.error(`[auth:${context}]`, name, message, status, error);
  } else {
    console.error(`[auth:${context}]`, error);
  }
}

export function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }
  if (normalized.includes('already registered')) {
    return 'Could not create your account with these details.';
  }
  if (normalized.includes('password should be at least') || normalized.includes('password is too short')) {
    return 'Password must be at least 6 characters.';
  }
  if (normalized.includes('unable to validate email address') || normalized.includes('invalid email')) {
    return 'Enter a valid email address.';
  }
  if (normalized.includes('rate limit')) {
    return 'Too many attempts. Try again in a few minutes.';
  }
  if (normalized.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }

  return 'Something went wrong. Please try again.';
}
