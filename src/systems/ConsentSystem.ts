import type { EventBus } from "../core/EventBus";

export interface ConsentFlags {
  consentRequested: boolean;
  adsAllowed: boolean;
  cloudSaveAllowed: boolean;
}

const CONSENT_KEY = "last_signal:consent";

const DEFAULT_CONSENT: ConsentFlags = {
  consentRequested: false,
  adsAllowed: false,
  cloudSaveAllowed: false,
};

export class ConsentSystem {
  private static flags: ConsentFlags = ConsentSystem.load();
  private static bus: EventBus | null = null;
  private static waiters: Array<(flags: ConsentFlags) => void> = [];

  static bindBus(bus: EventBus): void {
    this.bus = bus;
  }

  static get consentRequested(): boolean {
    return this.flags.consentRequested;
  }

  static get adsAllowed(): boolean {
    return this.flags.adsAllowed;
  }

  static get cloudSaveAllowed(): boolean {
    return this.flags.cloudSaveAllowed;
  }

  static getFlags(): ConsentFlags {
    return { ...this.flags };
  }

  static getConsentRequested(): boolean {
    return this.flags.consentRequested;
  }

  static getAdsAllowed(): boolean {
    return this.flags.adsAllowed;
  }

  static getCloudSaveAllowed(): boolean {
    return this.flags.cloudSaveAllowed;
  }

  static setConsentRequested(value: boolean): void {
    this.update({ consentRequested: value });
  }

  static setAdsAllowed(value: boolean): void {
    this.update({ adsAllowed: value });
  }

  static setCloudSaveAllowed(value: boolean): void {
    this.update({ cloudSaveAllowed: value });
  }

  static setFlags(flags: ConsentFlags): void {
    this.update(flags);
  }

  static acceptAll(): void {
    this.setFlags({
      consentRequested: true,
      adsAllowed: true,
      cloudSaveAllowed: true,
    });
  }

  static essentialOnly(): void {
    this.setFlags({
      consentRequested: true,
      adsAllowed: false,
      cloudSaveAllowed: false,
    });
  }

  static async ensure(): Promise<ConsentFlags> {
    if (this.flags.consentRequested) return this.getFlags();
    return new Promise<ConsentFlags>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private static update(patch: Partial<ConsentFlags>): void {
    const next = { ...this.flags, ...patch };
    if (
      next.consentRequested === this.flags.consentRequested &&
      next.adsAllowed === this.flags.adsAllowed &&
      next.cloudSaveAllowed === this.flags.cloudSaveAllowed
    ) {
      return;
    }

    this.flags = next;
    this.save(next);
    this.bus?.emit("consent:changed", this.getFlags());

    if (next.consentRequested && this.waiters.length > 0) {
      const resolved = this.waiters.splice(0);
      const snapshot = this.getFlags();
      for (const resolve of resolved) resolve(snapshot);
    }
  }

  private static load(): ConsentFlags {
    try {
      if (typeof window === "undefined") return { ...DEFAULT_CONSENT };
      const raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return { ...DEFAULT_CONSENT };
      const parsed = JSON.parse(raw) as Partial<ConsentFlags>;
      return {
        consentRequested: parsed.consentRequested === true,
        adsAllowed: parsed.adsAllowed === true,
        cloudSaveAllowed: parsed.cloudSaveAllowed === true,
      };
    } catch {
      return { ...DEFAULT_CONSENT };
    }
  }

  private static save(flags: ConsentFlags): void {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(flags));
    } catch {
      /* ignore private mode / storage quota failures */
    }
  }
}
