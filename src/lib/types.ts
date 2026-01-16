export type DocumentType =
  | "audit-finding"
  | "executive-summary"
  | "status-update"
  | "email-senior"
  | "risk-description";

export type EnglishVariant = "en-US" | "en-GB";

export interface RewriteOptions {
  activeVoice: boolean;
  clearOwnership: boolean;
  sharperImpact: boolean;
  calmTone: boolean;
  concise: boolean;

  auditSafeMode: boolean;

  owner?: string;
  documentType: DocumentType;

  englishVariant: EnglishVariant;
  standardiseSpelling: boolean;
}

export interface Change {
  type: string;
  description: string;
}

export interface RewriteResult {
  rewrittenText: string;
  changeLog: Change[];
  suggestions: string[];
}

export interface StyleExample {
  id: string;
  title: string;
  text: string;
  tags: string[];
  isActive: boolean;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  defaultDocType: DocumentType;

  englishVariant: EnglishVariant;
  standardiseSpelling: boolean;
  auditSafeMode: boolean;

  defaultToggles: Omit<
    RewriteOptions,
    "owner" | "documentType" | "englishVariant" | "standardiseSpelling" | "auditSafeMode"
  >;
}
