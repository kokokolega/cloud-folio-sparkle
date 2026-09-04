import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.p829f6c02476144e09f03fdd601c4d308',
  appName: 'cloud-folio-sparkle',
  webDir: 'dist',
  server: {
    url: 'https://829f6c02-4761-44e0-9f03-fdd601c4d308.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#007AFF',
      sound: 'beep.wav',
    },
  },
};

export default config;
