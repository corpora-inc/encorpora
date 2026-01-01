const json = (statusCode, payload) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
})

const getHeader = (event, key) => {
  const headers = event.headers || {}
  const match = Object.keys(headers).find(
    (name) => name.toLowerCase() === key.toLowerCase()
  )
  return match ? headers[match] : undefined
}

exports.handler = async (event) => {
  let body = {}
  try {
    body = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, { status: "failed", error: "Invalid JSON body" })
  }

  const platform = body.platform
  const productId = body.productId
  const receipt = body.receipt
  const purchaseToken = body.purchaseToken

  if (!platform || !productId || (!receipt && !purchaseToken)) {
    return json(400, {
      status: "failed",
      error: "Missing platform, productId, or receipt/purchaseToken",
    })
  }

  const bypassToken = process.env.DEV_BYPASS_TOKEN
  const headerToken = getHeader(event, "x-dev-bypass")
  if (bypassToken && headerToken === bypassToken) {
    const manifestUrl = process.env.PACK_MANIFEST_URL
    const manifestHash = process.env.PACK_MANIFEST_HASH
    const version = process.env.PACK_VERSION
    if (!manifestUrl || !manifestHash || !version) {
      return json(500, {
        status: "failed",
        error: "Missing PACK_MANIFEST_URL/PACK_MANIFEST_HASH/PACK_VERSION",
      })
    }
    return json(200, {
      status: "verified",
      transactionId: "dev-bypass",
      manifestUrl,
      manifestHash,
      version,
    })
  }

  return json(501, {
    status: "failed",
    error: "verify-purchase not implemented",
  })
}
