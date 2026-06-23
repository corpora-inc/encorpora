#!/bin/bash

# Script to generate Android keystore for Homeschool Offline
# Run this once to create the keystore file

set -e

echo "🔐 Generating Android Keystore for Homeschool Offline"
echo "=================================================="
echo ""
echo "⚠️  IMPORTANT: Save the passwords you enter securely!"
echo "    You'll need them for every release build."
echo ""
echo "Recommended: Store in 1Password or similar password manager"
echo ""

# Prompt for store password
read -s -p "Enter keystore password (min 6 characters): " STORE_PASS
echo ""
read -s -p "Confirm keystore password: " STORE_PASS_CONFIRM
echo ""

if [ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]; then
    echo "❌ Passwords don't match. Exiting."
    exit 1
fi

# Generate the keystore
keytool -genkey -v -keystore upload-keystore.jks \
    -alias homeschool-offline \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$STORE_PASS" \
    -keypass "$STORE_PASS" \
    -dname "CN=Homeschool Offline, OU=Mobile, O=Corpora Inc, L=San Francisco, ST=California, C=US"

echo ""
echo "✅ Keystore created successfully: upload-keystore.jks"
echo ""
echo "📝 Save these details securely:"
echo "   - Keystore file: upload-keystore.jks"
echo "   - Key alias: homeschool-offline"
echo "   - Keystore password: (the one you just entered)"
echo "   - Key password: (same as keystore password)"
echo ""
echo "⚠️  This keystore file is NOT committed to git (it's in .gitignore)"
echo "    Make sure to back it up securely!"
echo ""
echo "📋 Next steps:"
echo "   1. Save the passwords in your password manager"
echo "   2. Back up upload-keystore.jks to secure storage"
echo "   3. For builds, set environment variables:"
echo "      export ANDROID_KEYSTORE_PASSWORD='your_password'"
echo "      export ANDROID_KEY_PASSWORD='your_password'"
echo "      export ANDROID_KEY_ALIAS='homeschool-offline'"
echo ""
