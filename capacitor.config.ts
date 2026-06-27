import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://public-mhtracker.vercel.app'
const serverHost = new URL(serverUrl).hostname

const config: CapacitorConfig = {
  appId: 'com.lucaskerim.mentalhealthtracker',
  appName: 'Mental Health Tracker',
  webDir: 'out',
  backgroundColor: '#0f0f0f',
  android: {
    backgroundColor: '#0f0f0f',
    webContentsDebuggingEnabled: false,
  },
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: [serverHost],
    appStartPath: '/mobile',
  },
}

export default config
