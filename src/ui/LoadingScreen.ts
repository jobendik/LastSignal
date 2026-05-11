import { el } from "./dom";

const PHASES = [
  "Booting systems",
  "Loading sector data",
  "Preparing UI",
] as const;

export type LoadingPhase = (typeof PHASES)[number];

export class LoadingScreen {
  readonly el: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly percent: HTMLElement;
  private readonly phaseItems = new Map<LoadingPhase, HTMLElement>();
  private progress = 0;

  constructor(parent: HTMLElement) {
    this.el = el("div", {
      class: "ls-loading-screen",
      attrs: {
        role: "status",
        "aria-live": "polite",
        "aria-label": "Loading Last Signal",
      },
    });

    Object.assign(this.el.style, {
      position: "fixed",
      inset: "0",
      zIndex: "220",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "22px",
      padding: "24px",
      color: "#c5c6c7",
      background:
        "radial-gradient(circle at 50% 38%, rgba(102, 252, 241, 0.13), transparent 32%), #05070a",
      fontFamily: '"Courier New", Consolas, monospace',
      textAlign: "center",
      pointerEvents: "auto",
      transition: "opacity 240ms ease",
    });

    const logo = el("div", { text: "LAST SIGNAL" });
    Object.assign(logo.style, {
      color: "#66fcf1",
      fontSize: "clamp(34px, 7vw, 72px)",
      letterSpacing: "8px",
      textShadow: "0 0 20px rgba(102, 252, 241, 0.75)",
    });

    const subtitle = el("div", { text: "ESTABLISHING COMMAND LINK" });
    Object.assign(subtitle.style, {
      color: "#8a9099",
      fontSize: "12px",
      letterSpacing: "3px",
    });

    const meter = el("div");
    Object.assign(meter.style, {
      width: "min(520px, 82vw)",
      height: "12px",
      border: "1px solid rgba(102, 252, 241, 0.48)",
      background: "rgba(3, 8, 12, 0.92)",
      boxShadow: "0 0 18px rgba(102, 252, 241, 0.16) inset",
      overflow: "hidden",
    });

    this.bar = el("div");
    Object.assign(this.bar.style, {
      width: "0%",
      height: "100%",
      background: "linear-gradient(90deg, #45a29e, #66fcf1, #ffeb3b)",
      boxShadow: "0 0 18px rgba(102, 252, 241, 0.55)",
      transition: "width 320ms ease",
    });
    meter.append(this.bar);

    this.percent = el("div", { text: "0%" });
    Object.assign(this.percent.style, {
      color: "#66fcf1",
      fontSize: "13px",
      letterSpacing: "2px",
    });

    const phaseList = el("div");
    Object.assign(phaseList.style, {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "7px",
      width: "min(360px, 82vw)",
      textAlign: "left",
      fontSize: "12px",
      letterSpacing: "1px",
    });

    for (const phase of PHASES) {
      const item = el("div", { text: phase });
      Object.assign(item.style, {
        color: "#6f7884",
        borderLeft: "2px solid rgba(111, 120, 132, 0.45)",
        paddingLeft: "10px",
        transition: "color 180ms ease, border-color 180ms ease",
      });
      this.phaseItems.set(phase, item);
      phaseList.append(item);
    }

    this.el.append(logo, subtitle, meter, this.percent, phaseList);
    parent.append(this.el);
  }

  setPhase(phase: LoadingPhase): void {
    for (const [name, item] of this.phaseItems) {
      const active = name === phase;
      Object.assign(item.style, {
        color: active ? "#c5c6c7" : "#6f7884",
        borderLeftColor: active ? "#66fcf1" : "rgba(111, 120, 132, 0.45)",
      });
    }
  }

  setProgress(value: number): void {
    this.progress = Math.max(this.progress, Math.max(0, Math.min(100, value)));
    this.bar.style.width = `${this.progress}%`;
    this.percent.textContent = `${Math.round(this.progress)}%`;
  }

  complete(): void {
    this.setProgress(100);
    requestAnimationFrame(() => {
      this.el.style.opacity = "0";
      window.setTimeout(() => this.el.remove(), 260);
    });
  }
}
