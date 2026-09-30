import assert from 'node:assert/strict';
import test from 'node:test';
import { getCookieUrlFromDomain } from '../../libraries/helpers/src/subdomain/subdomain.management.ts';

const cases = [
  ['https://caleonis-marketing-production.up.railway.app', '.caleonis-marketing-production.up.railway.app'],
  ['https://another-tenant.up.railway.app', '.another-tenant.up.railway.app'],
  ['https://marketing.caleonis.com', '.caleonis.com'],
  ['http://localhost:4200', 'localhost'],
  ['http://127.0.0.1:4200', '127.0.0.1'],
];

for (const [input, expected] of cases) {
  test(`cookie scope: ${input}`, () => {
    assert.equal(getCookieUrlFromDomain(input), expected);
  });
}

test('unrelated Railway tenants never share the computed cookie domain', () => {
  assert.notEqual(
    getCookieUrlFromDomain(cases[0][0]),
    getCookieUrlFromDomain(cases[1][0]),
  );
});
