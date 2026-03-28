#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications.
 * Run: node bin/generate-vapid-keys.js
 * Then add the output to your .env file.
 */

import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('Add these to your .env file:\n')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
