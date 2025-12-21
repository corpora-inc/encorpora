plugins {
    id("com.android.asset-pack")
}

assetPack {
    packName = "endless_runner"
    dynamicDelivery {
        deliveryType = "on-demand"
    }
}
