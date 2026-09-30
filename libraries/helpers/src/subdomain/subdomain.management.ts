import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  const url = parse(domain, { allowPrivateDomains: true });

  // The pinned upstream tldts data does not yet include up.railway.app.
  // Scope Railway session cookies to this exact instance, never .railway.app.
  if (url.hostname?.endsWith('.up.railway.app')) {
    return '.' + url.hostname;
  }

  return url.domain! ? '.' + url.domain! : url.hostname!;
}
