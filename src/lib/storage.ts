import type { AppSettings, StyleExample } from "./types";

export class Storage {
  private dbName = "ClearLineDB";
  private version = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("styleExamples")) {
          db.createObjectStore("styleExamples", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
    });
  }

  async getStyleExamples(): Promise<StyleExample[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(["styleExamples"], "readonly");
      const store = tx.objectStore("styleExamples");
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StyleExample[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveStyleExample(example: StyleExample): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(["styleExamples"], "readwrite");
      const store = tx.objectStore("styleExamples");
      const req = store.put(example);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteStyleExample(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(["styleExamples"], "readwrite");
      const store = tx.objectStore("styleExamples");
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSettings(): Promise<AppSettings | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(["settings"], "readonly");
      const store = tx.objectStore("settings");
      const req = store.get("appSettings");
      req.onsuccess = () => resolve((req.result?.value as AppSettings) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(["settings"], "readwrite");
      const store = tx.objectStore("settings");
      const req = store.put({ key: "appSettings", value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async exportAll(): Promise<string> {
    const examples = await this.getStyleExamples();
    const settings = await this.getSettings();
    return JSON.stringify({ examples, settings }, null, 2);
  }

  async importAll(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData);

    if (data.examples && Array.isArray(data.examples)) {
      for (const raw of data.examples) {
        const ex: StyleExample = {
          id: String(raw.id ?? Date.now()),
          title: String(raw.title ?? "").slice(0, 120),
          text: String(raw.text ?? ""),
          tags: Array.isArray(raw.tags)
            ? raw.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
            : [],
          isActive: Boolean(raw.isActive),
        };
        await this.saveStyleExample(ex);
      }
    }

    if (data.settings) {
      const s = data.settings as Partial<AppSettings>;
      const merged: AppSettings = {
        theme: s.theme === "dark" || s.theme === "light" || s.theme === "system" ? s.theme : "system",
        defaultDocType:
          s.defaultDocType &&
          ["audit-finding", "executive-summary", "status-update", "email-senior", "risk-description"].includes(
            s.defaultDocType
          )
            ? s.defaultDocType
            : "audit-finding",
        englishVariant: s.englishVariant === "en-GB" ? "en-GB" : "en-US",
        standardiseSpelling: Boolean(s.standardiseSpelling ?? true),
        auditSafeMode: Boolean(s.auditSafeMode ?? true),
        defaultToggles: {
          activeVoice: Boolean(s.defaultToggles?.activeVoice ?? true),
          clearOwnership: Boolean(s.defaultToggles?.clearOwnership ?? true),
          sharperImpact: Boolean(s.defaultToggles?.sharperImpact ?? true),
          calmTone: Boolean(s.defaultToggles?.calmTone ?? true),
          concise: Boolean(s.defaultToggles?.concise ?? true),
        },
      };

      await this.saveSettings(merged);
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(["styleExamples", "settings"], "readwrite");
      tx.objectStore("styleExamples").clear();
      tx.objectStore("settings").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const storage = new Storage();
