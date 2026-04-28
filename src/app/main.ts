import '../styles/base.css';
import '../styles/ui.css';
import '../styles/menus.css';
import '../styles/notebook.css';
import '../styles/documents.css';
import '../styles/deck.css';
import '../styles/debug.css';
import { GameApp } from './GameApp';

async function start(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app element not found in index.html');
  const game = new GameApp(host);
  await game.boot();

  if ((import.meta as unknown as { hot?: { dispose(cb: () => void): void } }).hot) {
    (import.meta as unknown as { hot: { dispose(cb: () => void): void } }).hot.dispose(() => game.dispose());
  }
}

start().catch((err) => {
  console.error('[SignalRoom] fatal boot error', err);
  const host = document.getElementById('app');
  if (host) {
    host.innerHTML = `
      <div style="color:#e4dcc1; font-family:monospace; padding:40px; max-width:640px;">
        <h1 style="color:#f2a24a;">Signal Room — failed to start</h1>
        <p style="margin-top:12px;">${String((err as Error)?.message ?? err)}</p>
        <p style="margin-top:12px; opacity:0.6; font-size:12px;">Check the browser console for details.</p>
      </div>
    `;
  }
});
