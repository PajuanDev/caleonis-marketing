import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  // Hosting suffixes such as up.railway.app separate unrelated tenants.
  // Ignoring the private PSL section would incorrectly return .railway.app.
  const url = parse(domain, { allowPrivateDomains: true });
  return url.domain! ? '.' + url.domain! : url.hostname!;
}
