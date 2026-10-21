const { test } = require('node:test');
const assert = require('node:assert/strict');
const { X509Certificate, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const affected = new Set([
  '7DD78D5F4F13459A83DFF9ABBBA62EDBAF6F2D102BF257FD712F4D9F2746ED8D',
  'F2EDAAFF3D9B701FB4D14C9F285F8C0BAD90FC3BCC1FA07D47F4718EDABA34A5',
  'D7A7A0FB5D7E2731D771E9484EBCDEF71D5F0C3E0A2948782BC83EE0EA699EF4',
  '86A1ECBA089C4A8D3BBE2734C612BA341D813E043CF9E8A862CD5C57A36BBE6B',
]);
test('outbound CA layer has usable public anchors and excludes all affected roots', () => {
  const bundle = readFileSync(join(__dirname, '../tls-trust/ca-certificates.pem'), 'utf8');
  assert.equal(createHash('sha256').update(bundle).digest('hex'),
    '796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe',
    'bundle must match the documented public source');
  assert.doesNotMatch(bundle, /PRIVATE KEY/);
  const certificates = bundle.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  assert.ok(certificates.length > 100);
  for (const pem of certificates) {
    const certificate = new X509Certificate(pem);
    assert.ok(certificate.ca, 'bundle entries must be CA certificates');
    assert.equal(affected.has(certificate.fingerprint256.replaceAll(':', '')), false,
      'an affected root must not be trusted');
  }
  assert.ok(certificates.some(pem => new X509Certificate(pem).subject.includes('ISRG Root X1')),
    'retain a common unaffected trust anchor');
});
