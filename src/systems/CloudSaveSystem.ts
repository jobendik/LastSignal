import type { PersistedProfile } from "../core/Types";
import { ConsentSystem } from "./ConsentSystem";
import { hydrateProfile } from "./PersistenceSystem";

export type Profile = PersistedProfile;
export type CloudSyncStatus = "synced" | "offline";

const REMOTE_PROFILE_KEY = "last_signal:profile";
const SAVE_DEBOUNCE_MS = 5000;

interface CrazyGamesSdk {
  data?: {
    getItem?: (key: string) => string | null | Promise<string | null>;
    setItem?: (key: string, value: string) => unknown | Promise<unknown>;
  };
  user?: {
    getUser?: () => unknown | Promise<unknown>;
  };
}

export class CloudSaveSystem {
  private initialized = false;
  private ready = false;
  private corruptPayloadLogged = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPayload: string | null = null;
  private pendingResolvers: Array<() => void> = [];
  private syncStatus: CloudSyncStatus = "offline";

  get status(): CloudSyncStatus {
    return this.syncStatus;
  }

  async init(): Promise<void> {
    this.initialized = true;
    this.ready = false;
    this.syncStatus = "offline";

    if (!ConsentSystem.cloudSaveAllowed) return;

    const sdk = this.getSdk();
    if (!this.hasDataApi(sdk)) return;

    try {
      const getUser = sdk.user?.getUser;
      if (typeof getUser !== "function") return;
      const user = await getUser.call(sdk.user);
      if (!user) return;
      this.ready = true;
      this.syncStatus = "synced";
    } catch {
      this.markOffline();
    }
  }

  async loadRemote(): Promise<Profile | null> {
    const sdk = await this.getReadySdk();
    if (!sdk) return null;

    try {
      const raw = await sdk.data!.getItem!.call(sdk.data, REMOTE_PROFILE_KEY);
      if (raw == null || raw === "") {
        this.syncStatus = "synced";
        return null;
      }

      try {
        const parsed = JSON.parse(raw);
        this.syncStatus = "synced";
        return hydrateProfile(parsed);
      } catch {
        this.logCorruptPayloadOnce();
        return null;
      }
    } catch {
      this.markOffline();
      return null;
    }
  }

  async saveRemote(profile: Profile): Promise<void> {
    if (!ConsentSystem.cloudSaveAllowed) return;

    let payload: string;
    try {
      const outbound = profile.lastPlayedAt > 0
        ? profile
        : { ...profile, lastPlayedAt: Date.now() };
      payload = JSON.stringify(outbound);
    } catch {
      return;
    }

    this.pendingPayload = payload;
    if (this.saveTimer) clearTimeout(this.saveTimer);

    return new Promise<void>((resolve) => {
      this.pendingResolvers.push(resolve);
      this.saveTimer = setTimeout(() => {
        void this.flushRemoteSave();
      }, SAVE_DEBOUNCE_MS);
    });
  }

  merge(local: Profile, remote: Profile | null): Profile {
    if (!remote) return local;
    return remote.lastPlayedAt > local.lastPlayedAt ? remote : local;
  }

  private async flushRemoteSave(): Promise<void> {
    const payload = this.pendingPayload;
    const resolvers = this.pendingResolvers.splice(0);
    this.pendingPayload = null;
    this.saveTimer = null;

    try {
      if (!payload) return;
      const sdk = await this.getReadySdk();
      if (!sdk) return;
      await sdk.data!.setItem!.call(sdk.data, REMOTE_PROFILE_KEY, payload);
      this.syncStatus = "synced";
    } catch {
      this.markOffline();
    } finally {
      for (const resolve of resolvers) resolve();
    }
  }

  private async getReadySdk(): Promise<CrazyGamesSdk | null> {
    if (!ConsentSystem.cloudSaveAllowed) return null;
    if (!this.initialized || !this.ready) await this.init();
    if (!this.ready) return null;

    const sdk = this.getSdk();
    if (!this.hasDataApi(sdk)) {
      this.markOffline();
      return null;
    }
    return sdk;
  }

  private getSdk(): CrazyGamesSdk | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { CrazyGames?: { SDK?: unknown } };
    return (w.CrazyGames?.SDK as CrazyGamesSdk | undefined) ?? null;
  }

  private hasDataApi(sdk: CrazyGamesSdk | null): sdk is CrazyGamesSdk {
    return Boolean(
      sdk &&
      typeof sdk.data?.getItem === "function" &&
      typeof sdk.data?.setItem === "function"
    );
  }

  private markOffline(): void {
    this.ready = false;
    this.syncStatus = "offline";
  }

  private logCorruptPayloadOnce(): void {
    if (this.corruptPayloadLogged) return;
    this.corruptPayloadLogged = true;
    console.warn("[LastSignal] Ignoring corrupt CrazyGames cloud profile payload.");
  }
}
