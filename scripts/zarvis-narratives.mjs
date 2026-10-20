/** Compile only the public narrative fields; do not import application code or historical source records. */
export function narrativeDocuments(pitches, narratives) {
  const documents = [];
  const locales = ["en", "pt-BR", "es"];
  for (const locale of locales) {
    for (const pitch of pitches) {
      const family = narratives.find(n => n.id === pitch.theme);
      if (!family) throw new Error(`Missing narrative for ${pitch.id}`);
      for (const length of ["sentence", "30s", "60s"]) {
        const text = [pitch.context[locale], pitch.approach[locale], pitch.translations[locale][length], family.limit[locale]];
        if (text.some(part => typeof part !== "string" || !part.trim())) throw new Error(`Incomplete pitch ${pitch.id}/${locale}/${length}`);
        documents.push({
          id: `narratives:pitch:${pitch.id}:${locale}:${length}`, locale, pitchLength: length,
          title: `Zcash Pitches & Narratives · ${pitch.title[locale]} · ${length}`,
          url: `https://openzcash.org/narratives?lang=${locale}&length=${length}&view=pitches#pitch-${pitch.id}`,
          text: `Audience: ${pitch.audiences.join(", ")}.\n${text.join("\n")}`,
        });
      }
    }
    for (const narrative of narratives) {
      const text = ["idea", "context", "fact", "limit"].map(key => narrative[key][locale]);
      if (text.some(part => typeof part !== "string" || !part.trim())) throw new Error(`Incomplete narrative ${narrative.id}/${locale}`);
      documents.push({
        id: `narratives:theme:${narrative.id}:${locale}`, locale,
        title: `Zcash Pitches & Narratives · ${narrative.title[locale]}`,
        url: `https://openzcash.org/narratives?lang=${locale}&view=narratives#narrative-${narrative.id}`,
        text: text.join("\n"),
      });
    }
  }
  return documents;
}
