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
