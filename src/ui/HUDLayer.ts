import { el } from './dom';
import { Events } from '../core/Events';
import { Config } from '../app/config';
import { OBJECTIVES } from '../data/objectives';
import type { ObjectiveId } from '../core/Types';

/**
 * HUDLayer — reticle, hover label, objective strip and key-bindings footer.
 * Kept deliberately minimal; almost all other UI is diegetic.
 */
export class HUDLayer {
  private root: HTMLDivElement;
  private reticle: HTMLDivElement;
  private hoverLabel: HTMLDivElement;
  private objectiveText: HTMLSpanElement;
  private backHint: HTMLDivElement;
  private readonly offs: (() => void)[] = [];

  constructor(mount: HTMLElement) {
    this.reticle = el('div', { class: 'reticle' });
    this.hoverLabel = el('div', { class: 'hover-label' });
    this.objectiveText = el('span', { class: '' }, [OBJECTIVES.start]);
    this.backHint = el('div', { class: 'back-hint' }, [
      el('kbd', {}, ['ESC']), ' Back',
    ]);

    this.root = el('div', { class: 'ui-layer' }, [
      this.reticle,
      this.hoverLabel,
      this.backHint,
      el('div', { class: 'hud-bottom' }, [
        el('div', { class: 'objective' }, [this.objectiveText]),
        el('div', { class: 'binds' }, [
          el('kbd', {}, ['LMB']), ' interact   ',
          el('kbd', {}, ['TAB']), ' notebook   ',
          el('kbd', {}, ['ESC']), ' menu   ',
          el('kbd', {}, ['F1']), ' debug',
        ]),
      ]),
    ]);

    mount.appendChild(this.root);

    // Initial objective matches starting save value
    this.offs.push(Events.on('hover:changed', ({ id, label, hint }) => {
      if (id && label) {
        this.hoverLabel.innerHTML = '';
        this.hoverLabel.appendChild(document.createTextNode(label));
        if (hint) {
          const h = el('span', { class: 'hint' }, [hint]);
          this.hoverLabel.appendChild(h);
        }
        this.hoverLabel.classList.add('visible');
        this.reticle.classList.add('active');
      } else {
        this.hoverLabel.classList.remove('visible');
        this.reticle.classList.remove('active');
      }
    }));

    this.offs.push(Events.on('objective:changed', ({ text }) => {
      this.objectiveText.textContent = text;
    }));

    // Back hint visible when focused on a device
    this.offs.push(Events.on('focus:entered', () => this.backHint.classList.add('visible')));
    this.offs.push(Events.on('focus:exited',  () => this.backHint.classList.remove('visible')));
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
    this.root.remove();
  }

  setObjective(id: ObjectiveId): void {
    this.objectiveText.textContent = OBJECTIVES[id];
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  /** Clue toast notification */
  showClueToast(title: string, description: string): void {
    const toast = el('div', { class: 'clue-toast' }, [
      el('span', { class: 'tag' }, ['Clue discovered']),
      el('div', { class: 'title' }, [title]),
      el('div', { class: 'desc' }, [description]),
    ]);
    this.root.appendChild(toast);
    window.setTimeout(() => toast.remove(), 5200);
  }

  /** Appears briefly when the game boots */
  showWelcome(): void {
    const hint = el('div', {
      class: 'clue-toast',
      style: 'top:48%; left:50%; right:auto; transform:translate(-50%,0); min-width:280px;',
    }, [
      el('span', { class: 'tag' }, [Config.app.title]),
      el('div', { class: 'title' }, ['Click anywhere to begin.']),
      el('div', { class: 'desc' }, ['Headphones recommended.']),
    ]);
    this.root.appendChild(hint);
    window.setTimeout(() => hint.remove(), 3200);
  }
}
