plugins {
    id("com.android.asset-pack")
}

assetPack {
    packName = "endless_learner"
    dynamicDelivery {
        deliveryType = "on-demand"
    }
}
