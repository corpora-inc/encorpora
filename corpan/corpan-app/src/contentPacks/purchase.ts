export type PurchasePlatform = "ios" | "android" | "desktop"

export type PurchaseRequest = {
  packId: string
  platform: PurchasePlatform
  productId: string
  transactionId?: string
  receipt?: string
}

export type PurchaseVerificationResponse = {
  status: "verified" | "failed"
  transactionId?: string
  manifestUrl?: string
  version?: string
  manifestHash?: string
  error?: string
}

const getVerifyUrl = () => {
  const envUrl = import.meta.env.VITE_GAME_VERIFY_URL
  if (typeof envUrl === "string" && envUrl.length > 0) {
    return envUrl
  }
  return null
}

export const verifyPurchase = async (
  request: PurchaseRequest
): Promise<PurchaseVerificationResponse> => {
  const urlValue = getVerifyUrl()
  if (!urlValue) {
    return { status: "failed", error: "Verification endpoint not configured" }
  }
  try {
    const url = new URL(urlValue, window.location.href).toString()
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!res.ok) {
      return {
        status: "failed",
        error: `Verification failed (${res.status})`,
      }
    }
    const data = (await res.json()) as PurchaseVerificationResponse
    if (data.status !== "verified") {
      return {
        status: "failed",
        error: data.error ?? "Verification failed",
      }
    }
    return data
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Verification failed",
    }
  }
}
