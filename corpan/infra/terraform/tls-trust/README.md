# Lambda outbound TLS trust

The Lambda layer supplies the public Mozilla CA bundle extracted by curl on
October 20, 2026. The purchase-verification and analytics functions use this
bundle through `NODE_OPTIONS=--use-openssl-ca` and `SSL_CERT_FILE`.
`SSL_CERT_DIR` points to the layer's empty directory so a managed system CA
path cannot reintroduce distrusted roots. These settings apply before Node
initializes TLS, including AWS SDK, Google API and global fetch clients.

Source: https://curl.se/ca/cacert-2026-10-20.pem

SHA-256: `796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe`

The bundle contains public certificates; it contains no private keys.
To refresh it, download an authenticated curl CA extract, check its provenance
and affected-root fingerprints, and verify all twelve chains from
https://emudhra.we-have-a-problem.com/chains.zip fail with issuer/distrust errors.
Valid HTTPS controls must succeed. Commit the replacement bundle and checksum,
then deploy the new layer version and function configuration through Terraform.
A source change does not update a running Lambda function.

An issuer error establishes rejection for that trust path. Expiry, hostname,
DNS and timeout errors do not establish that the affected CA was distrusted.
Existing warm execution environments need replacement; updating the function
configuration creates environments with the selected layer and trust settings.
