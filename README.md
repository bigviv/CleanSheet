# ClearLine

Local-first audit text rewriter. Works offline after first load. Stored data remains in your browser (IndexedDB).

## Key Modes

### Audit-safe mode (default)
Meaning-preserving guidance:
- Keeps qualifiers (may/could/appears)
- Applies only strict passive→active patterns (no invented negation)
- Provides impact prompts as suggestions (does not insert claims)

### English variant
- English (UK) or English (US)
- Optional spelling standardisation using a curated, whole-word whitelist
- Protected tokens are not modified (emails/URLs/paths/backticks)

## Run
```bash
npm install
npm run dev
