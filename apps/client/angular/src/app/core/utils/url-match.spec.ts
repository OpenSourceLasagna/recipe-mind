import { getApiOrigin, isSameOriginAsApi } from './url-match';

describe('getApiOrigin', () => {
  it('returns origin for a valid http URL', () => {
    expect(getApiOrigin('http://localhost:8000')).toBe('http://localhost:8000');
  });

  it('returns origin for a valid https URL', () => {
    expect(getApiOrigin('https://api.example.com')).toBe('https://api.example.com');
  });

  it('strips path, query, and fragment', () => {
    expect(getApiOrigin('https://api.example.com/v1/users?x=1#frag')).toBe(
      'https://api.example.com',
    );
  });

  it('returns null for an invalid URL', () => {
    expect(getApiOrigin('not a url')).toBeNull();
  });
});

describe('isSameOriginAsApi', () => {
  const apiOrigin = 'http://localhost:8000';

  it('returns true for same-origin URL', () => {
    expect(isSameOriginAsApi('http://localhost:8000/v1/users', apiOrigin)).toBe(true);
  });

  it('returns true for same-origin with path and query', () => {
    expect(isSameOriginAsApi('http://localhost:8000/v1/users?limit=10', apiOrigin)).toBe(true);
  });

  it('rejects subdomain that looks like prefix match', () => {
    expect(isSameOriginAsApi('http://localhost:8000.attacker.com/path', apiOrigin)).toBe(false);
  });

  it('rejects different port', () => {
    expect(isSameOriginAsApi('http://localhost:9000/path', apiOrigin)).toBe(false);
  });

  it('rejects different scheme', () => {
    expect(isSameOriginAsApi('https://localhost:8000/path', apiOrigin)).toBe(false);
  });

  it('rejects completely different origin', () => {
    expect(isSameOriginAsApi('https://evil.com/path', apiOrigin)).toBe(false);
  });

  it('rejects when apiOrigin is null', () => {
    expect(isSameOriginAsApi('http://localhost:8000/v1/users', null)).toBe(false);
  });

  it('rejects malformed request URL', () => {
    expect(isSameOriginAsApi('not a url', apiOrigin)).toBe(false);
  });
});
