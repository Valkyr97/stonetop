# Content attribution

Game text ingested into `content/packs/*.json` comes from *Stonetop* and *Stonetop: The Wider World and Other Wonders* by Jeremy Strandberg (Lampblack & Brimstone).

- **License:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- **Corpus used:** marker-line extracts from [Bryan-Legend/stonetop-wiki-generator](https://github.com/Bryan-Legend/stonetop-wiki-generator/tree/master/extracted) (same text as [stonetop-wiki.github.io](https://stonetop-wiki.github.io/))
- **Artwork:** not included (© Lucie Arnoux; excluded from reuse)

Re-run ingestion:

```bash
npm run content:ingest-rules
npm run content:copy
```

Policy: the script copies prose from the corpus only; it does not invent rule text. Unmatched entries keep `rule_text: null` and `rule_text_status: "unmatched"`.
