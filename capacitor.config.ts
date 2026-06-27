import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://public-mhtracker.vercel.app/mobile'
const serverHost = new URL(serverUrl).hostname

const config: CapacitorConfig = {
  appId: 'com.lucaskerim.mentalhealthtracker',
  appName: 'Mental Health Tracker',
  webDir: 'public',
  backgroundColor: '#050505',
  android: {
    backgroundColor: '#050505',
    webContentsDebuggingEnabled: false,
  },
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: [serverHost],
  },
}

export default config
