export interface PushSupportState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerReady: boolean;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getPushSupportState(): Promise<PushSupportState> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return {
      supported: false,
      permission: 'unsupported',
      serviceWorkerReady: false,
    };
  }

  let swReady = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    swReady = Boolean(reg);
  } catch {
    swReady = false;
  }

  return {
    supported: 'PushManager' in window,
    permission: Notification.permission,
    serviceWorkerReady: swReady,
  };
}

export async function subscribeBrowserToPush(
  vapidPublicKey: string
): Promise<PushSubscriptionJSON> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('This browser does not support Web Push notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      'Notification permission was not granted. Please allow notifications in your browser settings.'
    );
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing.toJSON();
  }

  const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes.buffer as ArrayBuffer,
  });

  return subscription.toJSON();
}

export async function showLocalPreviewNotification(input: {
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission is required to show a preview.');
  }

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(input.title, {
        body: input.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url: input.url ?? '/' },
      });
      return;
    }
  }

  new Notification(input.title, {
    body: input.body,
    icon: '/pwa-192x192.png',
  });
}
