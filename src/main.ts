import './ui/tokens.css';
import { startApp } from './app';
import { enableOffline } from './offline';

void startApp(document.getElementById('app')!);

if (import.meta.env.PROD) {
  const ready = new Promise<void>((resolve) =>
    addEventListener('load', () => setTimeout(() => void enableOffline().then(resolve), 300), { once: true }),
  );
  (window as unknown as { __offlineReady?: Promise<void> }).__offlineReady = ready;
}
