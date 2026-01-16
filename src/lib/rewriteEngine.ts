import type { Change, DocumentType, EnglishVariant, RewriteOptions, RewriteResult, StyleExample } from "./types";

type ProtectedChunk = { kind: "text"; value: string } | { kind: "protected"; value: string };

export class RewriteEngine {
  private vocabularyMap: Record<string, string> = {
    "lack of clarity": "unclear",
    "not consistently": "inconsistently",
    "at this stage": "based on current information",
    "in order to": "to",
    "due to the fact that": "because",
    "for the purpose of": "to",
    "with regards to": "regarding",
    "at the present time": "currently",
  };

  private fillerOpeners = [
    "We note that",
    "For awareness",
    "It should be noted",
    "It is important to note",
    "Please be advised",
    "For your information",
  ];

  private ukToUs: Record<string, string> = {
    unauthorised: "unauthorized",
    authorised: "authorized",
    authorisation: "authorization",
    authorisations: "authorizations",
    organisation: "organization",
    organisations: "organizations",
    organise: "organize",
    organised: "organized",
    organising: "organizing",
    prioritise: "prioritize",
    prioritised: "prioritized",
    prioritising: "prioritizing",
    standardise: "standardize",
    standardised: "standardized",
    standardising: "standardizing",
    emphasise: "emphasize",
    emphasised: "emphasized",
    emphasising: "emphasizing",
    analyse: "analyze",
    analysed: "analyzed",
    analysing: "analyzing",
    behaviour: "behavior",
    behaviours: "behaviors",
    labour: "labor",
    defence: "defense",
    catalogue: "catalog",
    catalogues: "catalogs",
    modelling: "modeling",
    modelled: "modeled",
    programme: "program",
    programmes: "programs",
  };

  private usToUk: Record<string, string> = Object.fromEntries(
    Object.entries(this.ukToUs).map(([uk, us]) => [us, uk])
  );

  rewrite(text: string, options: RewriteOptions, styleExamples: StyleExample[]): RewriteResult {
    const changeLog: Change[] = [];
    const suggestions: string[] = [];

    const mixed = this.detectMixedVariant(text);
    if (mixed) suggestions.push(mixed);

    const blocks = this.splitParagraphs(text);
    const rewrittenBlocks = blocks.map((block) =>
      this.rewriteBlock(block, options, styleExamples, changeLog, suggestions)
    );

    return {
      rewrittenText: rewrittenBlocks.join("\n\n").trim(),
      changeLog,
      suggestions: this.dedupe(suggestions).slice(0, 12),
    };
  }

  private rewriteBlock(
    block: string,
    options: RewriteOptions,
    styleExamples: StyleExample[],
    changeLog: Change[],
    suggestions: string[]
  ): string {
    const trimmed = block.trim();
    if (!trimmed) return block;

    let processed = this.normaliseSpacing(trimmed);
    const sentences = this.splitSentences(processed);
    const rewritten: string[] = [];

    for (let sentence of sentences) {
      if (options.concise) {
        const stripped = this.stripFillerOpener(sentence);
        if (stripped.changed) {
          sentence = stripped.value;
          changeLog.push({ type: "concision", description: `Removed filler opener: "${stripped.removed}"` });
        }
      }

      const vocab = this.replaceVocabulary(sentence);
      if (vocab.changed) {
        sentence = vocab.value;
        vocab.changes.forEach((c) => changeLog.push({ type: "clarity", description: c }));
      }

      if (options.standardiseSpelling) {
        const spelled = this.standardiseSpelling(sentence, options.englishVariant);
        if (spelled.changed) {
          sentence = spelled.value;
          spelled.changes.forEach((c) => changeLog.push({ type: "spelling", description: c }));
        }
      }

      this.findQualifierHints(sentence).forEach((h) => suggestions.push(h));

      if (options.activeVoice) {
        const active = this.convertPassiveToActiveSafe(
          sentence,
          options.owner,
          options.clearOwnership,
          options.auditSafeMode
        );
        if (active.converted) {
          sentence = active.sentence;
          changeLog.push({ type: "voice", description: "Converted passive to active voice (safe rule)" });
        } else if (active.suggestion) {
          suggestions.push(active.suggestion);
        }
      }

      if (options.sharperImpact) {
        const impact = this.impactSuggestionOnly(sentence, options.documentType);
        if (impact) suggestions.push(impact);
      }

      if (styleExamples.length > 0) {
        sentence = this.applyStyleHeuristics(sentence, styleExamples);
      }

      sentence = this.fixSentenceCasing(sentence);
      sentence = this.ensureTerminalPunctuation(sentence);
      sentence = this.normaliseSpacing(sentence);

      rewritten.push(sentence);
    }

    return rewritten.join(" ").trim();
  }

  private splitParagraphs(text: string): string[] {
    return text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  }

  private splitSentences(text: string): string[] {
    const matches = text.match(/[^.!?]+(?:[.!?]+|$)/g);
    return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
  }

  private normaliseSpacing(text: string): string {
    return text
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/([,.;:!?])([A-Za-z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
  }

  private stripFillerOpener(sentence: string): { changed: boolean; value: string; removed?: string } {
    for (const filler of this.fillerOpeners) {
      const regex = new RegExp(`^${this.escapeRegex(filler)}\\s+`, "i");
      if (regex.test(sentence)) {
        return { changed: true, value: sentence.replace(regex, ""), removed: filler };
      }
    }
    return { changed: false, value: sentence };
  }

  private replaceVocabulary(sentence: string): { changed: boolean; value: string; changes: string[] } {
    let out = sentence;
    const changes: string[] = [];

    for (const [from, to] of Object.entries(this.vocabularyMap)) {
      const regex = new RegExp(this.escapeRegex(from), "gi");
      if (regex.test(out)) {
        out = out.replace(regex, to);
        changes.push(`Replaced "${from}" with "${to}"`);
      }
    }

    return { changed: out !== sentence, value: out, changes };
  }

  private protectTokens(input: string): ProtectedChunk[] {
    const pattern =
      /(\bhttps?:\/\/\S+\b)|(\bwww\.\S+\b)|(\b[\w.+-]+@[\w-]+\.[\w.-]+\b)|(`[^`]*`)|(\b[A-Za-z]:\\[^\s]+\b)|(\b\/[^\s]+\b)/g;

    const chunks: ProtectedChunk[] = [];
    let last = 0;

    for (const match of input.matchAll(pattern)) {
      const idx = match.index ?? 0;
      if (idx > last) chunks.push({ kind: "text", value: input.slice(last, idx) });
      chunks.push({ kind: "protected", value: match[0] });
      last = idx + match[0].length;
    }

    if (last < input.length) chunks.push({ kind: "text", value: input.slice(last) });
    return chunks;
  }

  private standardiseSpelling(
    sentence: string,
    variant: EnglishVariant
  ): { changed: boolean; value: string; changes: string[] } {
    const map = variant === "en-US" ? this.ukToUs : this.usToUk;
    const chunks = this.protectTokens(sentence);

    let changed = false;
    const changes: string[] = [];

    const rewritten = chunks
      .map((c) => {
        if (c.kind === "protected") return c.value;

        let out = c.value;
        for (const [from, to] of Object.entries(map)) {
          const regex = new RegExp(`\\b${this.escapeRegex(from)}\\b`, "gi");
          if (regex.test(out)) {
            out = out.replace(regex, (m) => this.matchCase(m, to));
            changed = true;
            changes.push(`Standardised spelling: "${from}" → "${to}"`);
          }
        }
        return out;
      })
      .join("");

    return { changed, value: rewritten, changes: this.dedupe(changes) };
  }

  private detectMixedVariant(text: string): string | null {
    const lower = text.toLowerCase();
    const hasUk = Object.keys(this.ukToUs).some((w) => new RegExp(`\\b${this.escapeRegex(w)}\\b`).test(lower));
    const hasUs = Object.values(this.ukToUs).some((w) => new RegExp(`\\b${this.escapeRegex(w)}\\b`).test(lower));
    return hasUk && hasUs ? "Mixed UK/US spelling detected. Select one English variant for consistency." : null;
  }

  private findQualifierHints(sentence: string): string[] {
    const lower = sentence.toLowerCase();
    const qualifiers = ["may", "could", "might", "potentially", "appears to", "seems to", "generally", "possibly"];
    const found = qualifiers.filter((q) => lower.includes(q));
    if (found.length === 0) return [];
    return [
      `Qualification detected (${found.join(
        ", "
      )}). Audit-safe default is to keep it unless evidence supports a stronger statement.`,
    ];
  }

  private convertPassiveToActiveSafe(
    sentence: string,
    owner?: string,
    clearOwnership?: boolean,
    auditSafeMode?: boolean
  ): { converted: boolean; sentence: string; suggestion?: string } {
    if (!owner || !clearOwnership) return { converted: false, sentence };

    // Audit-safe: strict patterns only; never invent negation.
    const strict: Array<{ re: RegExp; build: (m: RegExpMatchArray) => string }> = [
      {
        re: /^(.+?)\s+(was|were)\s+not\s+(completed|implemented|performed|reviewed|approved|identified|documented)\b(.*)$/i,
        build: (m) => {
          const subject = m[1].trim();
          const pp = m[3].toLowerCase();
          const base = this.toBaseVerb(pp);
          const tail = (m[4] ?? "").trim().replace(/^\s*by\s+.+$/i, "").trim();
          return `${owner} did not ${base} ${subject}${tail ? " " + tail : ""}`;
        },
      },
      {
        re: /^(.+?)\s+(was|were)\s+(completed|implemented|performed|reviewed|approved|identified|documented)\b(.*)$/i,
        build: (m) => {
          const subject = m[1].trim();
          const pp = m[3].toLowerCase();
          const tail = (m[4] ?? "").trim().replace(/^\s*by\s+.+$/i, "").trim();
          return `${owner} ${pp} ${subject}${tail ? " " + tail : ""}`;
        },
      },
    ];

    for (const p of strict) {
      const match = sentence.match(p.re);
      if (match) return { converted: true, sentence: p.build(match) };
    }

    if (auditSafeMode) {
      return {
        converted: false,
        sentence,
        suggestion: "Active voice not applied (audit-safe): only strict, meaning-preserving patterns are converted.",
      };
    }

    return { converted: false, sentence };
  }

  private toBaseVerb(pastParticiple: string): string {
    const map: Record<string, string> = {
      completed: "complete",
      implemented: "implement",
      performed: "perform",
      reviewed: "review",
      approved: "approve",
      identified: "identify",
      documented: "document",
    };
    return map[pastParticiple] || pastParticiple.replace(/ed$/, "");
  }

  private impactSuggestionOnly(sentence: string, docType: DocumentType): string | null {
    if (docType !== "audit-finding") return null;

    const lower = sentence.toLowerCase();
    const hasImpactCue =
      lower.includes("risk") || lower.includes("impact") || lower.includes("result") || lower.includes("consequence");

    if (hasImpactCue) return null;

    return "Consider adding impact: state the credible consequence (who/what is affected and why it matters) without overstating certainty.";
  }

  private applyStyleHeuristics(sentence: string, examples: StyleExample[]): string {
    const activeExamples = examples.filter((e) => e.isActive).slice(0, 3);
    if (activeExamples.length === 0) return sentence;

    const avgLength =
      activeExamples.reduce((sum, ex) => {
        const sents = this.splitSentences(ex.text);
        const avg = sents.reduce((s, sent) => s + sent.split(/\s+/).length, 0) / Math.max(1, sents.length);
        return sum + avg;
      }, 0) / activeExamples.length;

    const words = sentence.split(/\s+/).length;
    if (avgLength > 0 && words > avgLength * 1.5 && words > 22) {
      return sentence.replace(/, and /i, ". ").replace(/, which /i, ". This ");
    }
    return sentence;
  }

  private fixSentenceCasing(sentence: string): string {
    const trimmed = sentence.trim();
    if (!trimmed) return trimmed;

    const idx = trimmed.search(/[A-Za-z]/);
    if (idx === -1) return trimmed;

    const before = trimmed.slice(0, idx);
    const first = trimmed.charAt(idx);
    const after = trimmed.slice(idx + 1);

    let out = `${before}${first.toUpperCase()}${after}`;
    out = out.replace(/\bi\b/g, "I");
    return out;
  }

  private ensureTerminalPunctuation(sentence: string): string {
    const trimmed = sentence.trim();
    if (!trimmed) return trimmed;
    if (/[.!?]$/.test(trimmed)) return trimmed;
    return `${trimmed}.`;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private matchCase(from: string, to: string): string {
    if (from.toUpperCase() === from) return to.toUpperCase();
    if (from[0]?.toUpperCase() === from[0]) return to[0].toUpperCase() + to.slice(1);
    return to;
  }

  private dedupe(items: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of items) {
      const k = s.trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }
}

export const rewriteEngine = new RewriteEngine();
