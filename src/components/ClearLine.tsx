import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";

import "../styles/clearline.css";
import type { AppSettings, DocumentType, RewriteOptions, StyleExample } from "../lib/types";
import { storage } from "../lib/storage";
import { rewriteEngine } from "../lib/rewriteEngine";

const sampleInputs: Record<DocumentType, string> = {
  "audit-finding":
    "Access reviews for privileged accounts were not consistently completed on a quarterly basis. This may potentially result in unauthorised access remaining undetected.",
  "executive-summary":
    "It should be noted that the controls around the vendor onboarding process lack clarity and appear to be generally inconsistent across business units.",
  "status-update":
    "For awareness, the remediation activities are progressing, however there could be delays due to resource constraints at this stage.",
  "email-senior":
    "We note that the data classification project was not completed as planned and this seems to have impacted downstream initiatives.",
  "risk-description":
    "The lack of formal change management procedures may lead to unauthorised modifications which could potentially compromise system integrity.",
};

export default function ClearLine() {
  const [activeTab, setActiveTab] = useState<"rewrite" | "library" | "settings">("rewrite");

  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [changeLog, setChangeLog] = useState<{ type: string; description: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showChanges, setShowChanges] = useState(false);
  const [copied, setCopied] = useState(false);

  const [documentType, setDocumentType] = useState<DocumentType>("audit-finding");
  const [owner, setOwner] = useState("");

  const [options, setOptions] = useState<
    Omit<RewriteOptions, "owner" | "documentType" | "englishVariant" | "standardiseSpelling" | "auditSafeMode">
  >({
    activeVoice: true,
    clearOwnership: true,
    sharperImpact: true,
    calmTone: true,
    concise: true,
  });

  const [styleExamples, setStyleExamples] = useState<StyleExample[]>([]);
  const [newExampleTitle, setNewExampleTitle] = useState("");
  const [newExampleText, setNewExampleText] = useState("");
  const [newExampleTags, setNewExampleTags] = useState("");
  const [filterTag, setFilterTag] = useState("");

  const [settings, setSettings] = useState<AppSettings>({
    theme: "system",
    defaultDocType: "audit-finding",
    englishVariant: "en-GB",
    standardiseSpelling: true,
    auditSafeMode: true,
    defaultToggles: {
      activeVoice: true,
      clearOwnership: true,
      sharperImpact: true,
      calmTone: true,
      concise: true,
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storage.init().then(async () => {
      setStyleExamples(await storage.getStyleExamples());

      const saved = await storage.getSettings();
      if (saved) {
        setSettings(saved);
        setDocumentType(saved.defaultDocType);
        setOptions(saved.defaultToggles);
      }
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.englishVariant;

    if (settings.theme === "dark") root.classList.add("dark");
    else if (settings.theme === "light") root.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, [settings.theme, settings.englishVariant]);

  const filteredExamples = filterTag ? styleExamples.filter((e) => e.tags.includes(filterTag)) : styleExamples;
  const allTags = useMemo(() => Array.from(new Set(styleExamples.flatMap((e) => e.tags))), [styleExamples]);

  const handleRewrite = () => {
    if (!inputText.trim()) return;

    const result = rewriteEngine.rewrite(
      inputText,
      {
        ...options,
        owner: owner.trim() || undefined,
        documentType,
        englishVariant: settings.englishVariant,
        standardiseSpelling: settings.standardiseSpelling,
        auditSafeMode: settings.auditSafeMode,
      },
      styleExamples
    );

    setOutputText(result.rewrittenText);
    setChangeLog(result.changeLog);
    setSuggestions(result.suggestions);
    setShowChanges(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed. Your browser may block clipboard access in this context.");
    }
  };

  const handleLoadSample = (type: DocumentType) => {
    setInputText(sampleInputs[type]);
    setDocumentType(type);
  };

  const handleAddExample = async () => {
    if (!newExampleTitle.trim() || !newExampleText.trim()) return;

    const example: StyleExample = {
      id: Date.now().toString(),
      title: newExampleTitle.trim(),
      text: newExampleText.trim(),
      tags: newExampleTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isActive: false,
    };

    await storage.saveStyleExample(example);
    setStyleExamples(await storage.getStyleExamples());

    setNewExampleTitle("");
    setNewExampleText("");
    setNewExampleTags("");
  };

  const handleToggleActive = async (id: string) => {
    const current = styleExamples.find((e) => e.id === id);
    if (!current) return;

    const activeCount = styleExamples.filter((e) => e.isActive).length;
    if (!current.isActive && activeCount >= 3) {
      alert("Maximum 3 active style anchors allowed");
      return;
    }

    const updatedExamples = styleExamples.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e));
    setStyleExamples(updatedExamples);

    const updated = updatedExamples.find((e) => e.id === id)!;
    await storage.saveStyleExample(updated);
  };

  const handleDeleteExample = async (id: string) => {
    if (!confirm("Delete this style example?")) return;
    await storage.deleteStyleExample(id);
    setStyleExamples(await storage.getStyleExamples());
  };

  const handleExport = async () => {
    const data = await storage.exportAll();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clearline-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      await storage.importAll(text);
      setStyleExamples(await storage.getStyleExamples());

      const saved = await storage.getSettings();
      if (saved) {
        setSettings(saved);
        setDocumentType(saved.defaultDocType);
        setOptions(saved.defaultToggles);
      }

      alert("Data imported successfully");
    } catch {
      alert("Import failed: invalid file format");
    } finally {
      e.target.value = "";
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Delete ALL data? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? All style examples and settings will be permanently deleted.")) return;

    await storage.clearAll();
    setStyleExamples([]);
    setSettings({
      theme: "system",
      defaultDocType: "audit-finding",
      englishVariant: "en-GB",
      standardiseSpelling: true,
      auditSafeMode: true,
      defaultToggles: {
        activeVoice: true,
        clearOwnership: true,
        sharperImpact: true,
        calmTone: true,
        concise: true,
      },
    });
  };

  const handleSaveSettings = async () => {
    await storage.saveSettings(settings);
    alert("Settings saved");
  };

  return (
    <div className="app">
      <header className="header">
        <h1>ClearLine</h1>
        <p className="tagline">Audit text rewriter · Local-first · Private</p>
      </header>

      <nav className="nav">
        <button className={`nav-btn ${activeTab === "rewrite" ? "active" : ""}`} onClick={() => setActiveTab("rewrite")}>
          <FileText size={20} />
          <span>Rewrite</span>
        </button>
        <button className={`nav-btn ${activeTab === "library" ? "active" : ""}`} onClick={() => setActiveTab("library")}>
          <BookOpen size={20} />
          <span>Style Library</span>
        </button>
        <button className={`nav-btn ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>

      <main className="main">
        {activeTab === "rewrite" && (
          <div className="rewrite-tab">
            <div className="card">
              <div className="card-header">
                <h2>Input</h2>
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)} className="select">
                  <option value="audit-finding">Audit finding</option>
                  <option value="executive-summary">Executive summary</option>
                  <option value="status-update">Status update</option>
                  <option value="email-senior">Email to senior management</option>
                  <option value="risk-description">Risk description</option>
                </select>
              </div>

              <textarea
                id="input-text"
                className="textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter text to rewrite..."
                rows={6}
                spellCheck={true}
                lang={settings.englishVariant}
              />

              <div className="meta">
                <span>{inputText.length} characters</span>
                <select className="select-small" onChange={(e) => e.target.value && handleLoadSample(e.target.value as DocumentType)} value="">
                  <option value="">Load sample...</option>
                  <option value="audit-finding">Audit finding</option>
                  <option value="executive-summary">Executive summary</option>
                  <option value="status-update">Status update</option>
                  <option value="email-senior">Email to senior</option>
                  <option value="risk-description">Risk description</option>
                </select>
              </div>

              <div className="field">
                <label>Owner / Function (optional)</label>
                <input
                  type="text"
                  className="input"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g., Operations, Access Management Team"
                  spellCheck={true}
                  lang={settings.englishVariant}
                />
              </div>

              <div className="toggles">
                <label className="toggle">
                  <input type="checkbox" checked={options.activeVoice} onChange={(e) => setOptions({ ...options, activeVoice: e.target.checked })} />
                  <span>Active voice</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={options.clearOwnership} onChange={(e) => setOptions({ ...options, clearOwnership: e.target.checked })} />
                  <span>Clear ownership</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={options.sharperImpact} onChange={(e) => setOptions({ ...options, sharperImpact: e.target.checked })} />
                  <span>Sharper impact (suggestions)</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={options.calmTone} onChange={(e) => setOptions({ ...options, calmTone: e.target.checked })} />
                  <span>Calm / non-alarmist</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={options.concise} onChange={(e) => setOptions({ ...options, concise: e.target.checked })} />
                  <span>Concise</span>
                </label>
              </div>

              <button className="btn-primary" onClick={handleRewrite}>
                <RefreshCw size={18} />
                Rewrite
              </button>
            </div>

            {outputText && (
              <div className="card">
                <div className="card-header">
                  <h2>Output</h2>
                  <div className="actions">
                    <button className="btn-secondary" onClick={() => setShowChanges(!showChanges)}>
                      {showChanges ? "Hide" : "Show"} changes
                    </button>
                    <button className="btn-secondary" onClick={() => handleCopy(outputText)}>
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <textarea className="textarea" value={outputText} readOnly rows={6} spellCheck={true} lang={settings.englishVariant} />

                {showChanges && changeLog.length > 0 && (
                  <div className="changes">
                    <h3>Changes made:</h3>
                    <ul>
                      {changeLog.map((change, i) => (
                        <li key={i}>
                          <strong>{change.type}:</strong> {change.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="suggestions">
                    <h3>Suggestions:</h3>
                    <ul>
                      {suggestions.map((sug, i) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="actions">
                  <button className="btn-secondary" onClick={() => setInputText(outputText)}>
                    Replace input with output
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setInputText("");
                      setOutputText("");
                      setChangeLog([]);
                      setSuggestions([]);
                    }}
                  >
                    Clear input + output
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "library" && (
          <div className="library-tab">
            <div className="card">
              <h2>Add Style Example</h2>

              <div className="field">
                <label>Title</label>
                <input
                  type="text"
                  className="input"
                  value={newExampleTitle}
                  onChange={(e) => setNewExampleTitle(e.target.value)}
                  placeholder="e.g., Clear audit finding"
                  spellCheck={true}
                  lang={settings.englishVariant}
                />
              </div>

              <div className="field">
                <label>Text</label>
                <textarea
                  className="textarea"
                  value={newExampleText}
                  onChange={(e) => setNewExampleText(e.target.value)}
                  placeholder="Paste an example of your preferred writing style"
                  rows={4}
                  spellCheck={true}
                  lang={settings.englishVariant}
                />
              </div>

              <div className="field">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  className="input"
                  value={newExampleTags}
                  onChange={(e) => setNewExampleTags(e.target.value)}
                  placeholder="e.g., firm, calm, exec, short"
                />
              </div>

              <button className="btn-primary" onClick={handleAddExample}>
                Add Example
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Style Examples</h2>
                <select className="select-small" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
                  <option value="">All tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              {filteredExamples.length === 0 ? (
                <p className="empty">No style examples yet. Add your first example above.</p>
              ) : (
                <div className="examples-list">
                  {filteredExamples.map((example) => (
                    <div key={example.id} className={`example-item ${example.isActive ? "active" : ""}`}>
                      <div className="example-header">
                        <h3>{example.title}</h3>
                        <div className="example-actions">
                          <button
                            className="btn-icon"
                            onClick={() => handleToggleActive(example.id)}
                            title={example.isActive ? "Deactivate" : "Activate as style anchor"}
                            aria-label={example.isActive ? "Deactivate style anchor" : "Activate style anchor"}
                          >
                            {example.isActive ? "★" : "☆"}
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleDeleteExample(example.id)}
                            title="Delete"
                            aria-label="Delete style example"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <p className="example-text">{example.text}</p>

                      {example.tags.length > 0 && (
                        <div className="tags">
                          {example.tags.map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="info-box">
                <strong>Active Style Anchors:</strong> {styleExamples.filter((e) => e.isActive).length} / 3
                <br />
                <small>Active examples influence sentence splitting and length heuristics.</small>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-tab">
            <div className="card">
              <h2>Guidance Safety</h2>
              <div className="field">
                <label>Audit-safe mode</label>
                <label className="toggle">
                  <input type="checkbox" checked={settings.auditSafeMode} onChange={(e) => setSettings({ ...settings, auditSafeMode: e.target.checked })} />
                  <span>Meaning-preserving (qualifiers kept; conservative voice conversion)</span>
                </label>
              </div>
            </div>

            <div className="card">
              <h2>Appearance</h2>
              <div className="field">
                <label>Theme</label>
                <div className="theme-buttons">
                  <button className={`btn-icon-text ${settings.theme === "light" ? "active" : ""}`} onClick={() => setSettings({ ...settings, theme: "light" })}>
                    <Sun size={18} /> Light
                  </button>
                  <button className={`btn-icon-text ${settings.theme === "dark" ? "active" : ""}`} onClick={() => setSettings({ ...settings, theme: "dark" })}>
                    <Moon size={18} /> Dark
                  </button>
                  <button className={`btn-icon-text ${settings.theme === "system" ? "active" : ""}`} onClick={() => setSettings({ ...settings, theme: "system" })}>
                    <Monitor size={18} /> System
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Language</h2>
              <div className="field">
                <label>English Variant</label>
                <select className="select" value={settings.englishVariant} onChange={(e) => setSettings({ ...settings, englishVariant: e.target.value as any })}>
                  <option value="en-GB">English (UK)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>

              <div className="field">
                <label>Spelling Standardisation</label>
                <label className="toggle">
                  <input type="checkbox" checked={settings.standardiseSpelling} onChange={(e) => setSettings({ ...settings, standardiseSpelling: e.target.checked })} />
                  <span>Standardise common UK/US spellings (curated list)</span>
                </label>
              </div>
            </div>

            <div className="card">
              <h2>Defaults</h2>

              <div className="field">
                <label>Default Document Type</label>
                <select className="select" value={settings.defaultDocType} onChange={(e) => setSettings({ ...settings, defaultDocType: e.target.value as DocumentType })}>
                  <option value="audit-finding">Audit finding</option>
                  <option value="executive-summary">Executive summary</option>
                  <option value="status-update">Status update</option>
                  <option value="email-senior">Email to senior management</option>
                  <option value="risk-description">Risk description</option>
                </select>
              </div>

              <div className="field">
                <label>Default Toggles</label>
                <div className="toggles">
                  {(["activeVoice", "clearOwnership", "sharperImpact", "calmTone", "concise"] as const).map((k) => (
                    <label className="toggle" key={k}>
                      <input
                        type="checkbox"
                        checked={settings.defaultToggles[k]}
                        onChange={(e) => setSettings({ ...settings, defaultToggles: { ...settings.defaultToggles, [k]: e.target.checked } })}
                      />
                      <span>
                        {k === "activeVoice" && "Active voice"}
                        {k === "clearOwnership" && "Clear ownership"}
                        {k === "sharperImpact" && "Sharper impact"}
                        {k === "calmTone" && "Calm / non-alarmist"}
                        {k === "concise" && "Concise"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button className="btn-primary" onClick={handleSaveSettings}>
                Save Settings
              </button>
            </div>

            <div className="card">
              <h2>Data Management</h2>
              <div className="data-actions">
                <button className="btn-secondary" onClick={handleExport}>
                  <Download size={18} /> Export All Data
                </button>
                <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={18} /> Import Data
                </button>
                <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleFileChange} />
                <button className="btn-danger" onClick={handleClearAll}>
                  <Trash2 size={18} /> Delete All Data
                </button>
              </div>
            </div>

            <div className="card privacy-card">
              <h2>Privacy Statement</h2>
              <p>
                <strong>ClearLine works on your device.</strong> This tool does not send text anywhere as part of the rewrite process.
              </p>
              <p className="technical-note">
                <strong>Note:</strong> Spellcheck and grammar underlines are provided by your browser and OS dictionaries.
              </p>
              <p>You can export, import, or delete saved data at any time.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
