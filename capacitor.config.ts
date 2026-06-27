import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://public-mhtracker.vercel.app'
const serverHost = new URL(serverUrl).hostname

const config: CapacitorConfig = {
  appId: 'com.lucaskerim.mentalhealthtracker',
  appName: 'Mental Health Tracker',
  webDir: 'public',
  backgroundColor: '#050505',
  appendUserAgent: ' MentalHealthTrackerApp',
  android: {
    backgroundColor: '#050505',
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
