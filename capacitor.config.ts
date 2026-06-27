import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL
const serverHost = serverUrl ? new URL(serverUrl).hostname : undefined

const config: CapacitorConfig = {
  appId: 'com.lucaskerim.mentalhealthtracker',
  appName: 'Mental Health Tracker',
  webDir: 'out',
  backgroundColor: '#0f0f0f',
  android: {
    backgroundColor: '#0f0f0f',
    webContentsDebuggingEnabled: false,
  },
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
        allowNavigation: serverHost ? [serverHost] : [],
        appStartPath: '/mobile',
      }
    : undefined,
}

export default config
