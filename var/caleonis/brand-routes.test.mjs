import test from 'node:test';
import assert from 'node:assert/strict';
import { brandRoute } from './brand-routes.mjs';

test('brands single-line and multi-line route display names', () => {
  assert.equal(brandRoute("isGeneralServerSide() ? 'Postiz' : 'Gitroom'"), "'Caléonis Marketing'");
  assert.equal(brandRoute("isGeneralServerSide() ? 'Postiz'\n : 'Gitroom'"), "'Caléonis Marketing'");
});
test('is idempotent', () => {
  const once = brandRoute("`${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Login`");
  assert.equal(brandRoute(once), once);
});
test('preserves technical identifiers, upstream URLs and attribution', () => {
  const source = "import x from '@postiz/wallets';\nprocess.env.POSTIZ_GENERIC_OAUTH;\n// Based on Postiz https://postiz.com AGPL-3.0";
  assert.equal(brandRoute(source), source);
});
