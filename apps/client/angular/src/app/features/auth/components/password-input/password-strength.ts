export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export type PasswordStrength = {
  score: PasswordStrengthScore;
  label: string;
};

const LABELS: Record<PasswordStrengthScore, string> = {
  0: 'Too short',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};

export function scorePassword(password: string): PasswordStrength {
  if (password.length === 0) {
    return { score: 0, label: LABELS[0] };
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const capped = Math.min(4, score) as PasswordStrengthScore;
  return { score: capped, label: LABELS[capped] };
}
