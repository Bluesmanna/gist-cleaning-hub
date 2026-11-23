import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.gistcleaning.hub',
  appName: 'GIST Cleaning Hub',
  webDir: 'dist',
  android: {
    // lets the app reach the optional AI bridge on your PC over plain http (LAN)
    allowMixedContent: true,
  },
  server: { androidScheme: 'https', cleartext: true },
}

export default config
