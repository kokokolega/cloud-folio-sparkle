import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.p829f6c02476144e09f03fdd601c4d308',
  appName: 'Oltrid',
  webDir: 'dist',
  server: {
    // Live-reload against the Lovable sandbox; opens the full workspace.
    url: 'https://829f6c02-4761-44e0-9f03-fdd601c4d308.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    // Full-bleed layout under the notch; the web layer handles safe areas.
    contentInset: 'never',
    backgroundColor: '#ffffff',
    limitsNavigationsToAppBoundDomains: false,
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#007AFF',
      // iOS plays this from the app bundle; Android from res/raw.
      sound: 'beep.wav',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
