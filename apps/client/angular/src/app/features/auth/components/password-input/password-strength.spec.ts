import { scorePassword } from './password-strength';

describe('scorePassword', () => {
  it('returns score 0 with "Too short" for an empty password', () => {
    expect(scorePassword('')).toEqual({ score: 0, label: 'Too short' });
  });

  it('returns score 0 for a very short password with no character variety', () => {
    expect(scorePassword('abc')).toEqual({ score: 0, label: 'Too short' });
  });

  it('returns score 1 "Weak" for an 8+ char single-class password', () => {
    expect(scorePassword('abcdefgh')).toEqual({ score: 1, label: 'Weak' });
  });

  it('returns score 2 "Fair" for an 8+ char mixed-case password', () => {
    expect(scorePassword('Abcdefgh')).toEqual({ score: 2, label: 'Fair' });
  });

  it('returns score 3 "Good" for mixed-case + digit at 8 chars', () => {
    expect(scorePassword('Abcdefg1')).toEqual({ score: 3, label: 'Good' });
  });

  it('returns score 4 "Strong" for mixed-case + digit + symbol at 8+ chars', () => {
    expect(scorePassword('Abcdefg1!')).toEqual({ score: 4, label: 'Strong' });
  });

  it('caps the score at 4 even when all bonuses apply', () => {
    const result = scorePassword('aB1!aaaaAAAAaaaa');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Strong');
  });

  it('rewards length 12 as a stronger bump than just length 8', () => {
    const short = scorePassword('Abcdefg1');
    const long = scorePassword('Abcdefg1xyzq');
    expect(long.score).toBeGreaterThan(short.score);
  });

  it('rewards symbols beyond just length', () => {
    const noSymbol = scorePassword('Abcdefgh');
    const withSymbol = scorePassword('Abcdefg!');
    expect(withSymbol.score).toBeGreaterThan(noSymbol.score);
  });
});
