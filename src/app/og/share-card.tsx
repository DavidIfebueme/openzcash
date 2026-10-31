import type { CardText } from "@/lib/seo/card-params";
import { CARD_FONTS } from "@/lib/seo/card-assets";
import {
  BAND_HEIGHT,
  ACCENT,
  BODY,
  BODY_BOTTOM,
  BODY_TOP,
  FOOTER_HEIGHT,
  GUTTER,
  TITLE_LEADING,
  TITLE_MAX_LINES,
  titleBlock,
  clampedBlock,
  titleSize,
  typeset,
} from "./card-type";

/** One category, one headline and a quiet footer, legible at chat-preview size. */
const INK = "#1c1917";
const MUTED = "#57534e";
const GOLD_INK = "#92600f";
const CANVAS = "#faf8f4";
const LINE = "#e3dccb";
const MARK = 44;

const SITE_CARD: CardText = {
  title: "Zcash funding, in the open",
  kicker: "Explore grants, treasuries and governance.",
};

function Mark({ src }: { src: string }) {
  // The bundled PNG includes transparent padding around the coin.
  return <div style={{ display: "flex", width: MARK, height: MARK, overflow: "hidden" }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
    <img src={src} width={MARK * 2} height={MARK * 2} alt="" style={{ margin: -MARK / 2 }} />
  </div>;
}

export function ShareCard({ card, mark }: { card: CardText | null; mark: string | null }) {
  const text = card ?? SITE_CARD;
  const title = typeset(text.title);
  const [kicker, stat, section] = [text.kicker, text.stat, text.section].map(
    (value) => value ? typeset(value) : undefined,
  );
  const size = titleSize({ title, kicker, stat, section }, card === null);

  return <div style={{ display: "flex", position: "relative", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: CANVAS, color: INK, fontFamily: CARD_FONTS.text }}>
    <div style={{ position: "absolute", top: -440, right: -170, width: 780, height: 780, borderRadius: "50%", background: "#f3ecd9", opacity: 0.7 }} />
    <div style={{ position: "absolute", top: -414, right: -196, width: 780, height: 780, borderRadius: "50%", border: `1px solid ${LINE}` }} />

    <div style={{ display: "flex", position: "relative", flexShrink: 0, height: BAND_HEIGHT, padding: `0 ${GUTTER}px`, alignItems: "center", justifyContent: "space-between", gap: 32 }}>
      <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 14 }}>
        {mark ? <Mark src={mark} /> : null}
        <span style={{ fontFamily: CARD_FONTS.wordmark, fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>OpenZcash</span>
      </div>
      {section ? <div style={{ ...clampedBlock(1), maxWidth: 650, textAlign: "right", fontSize: 24, fontWeight: 500, color: GOLD_INK }}>{section}</div> : null}
    </div>

    <div style={{ display: "flex", position: "relative", flexGrow: 1, flexDirection: "column", justifyContent: "center", alignItems: "flex-start", textAlign: "left", overflow: "hidden", padding: `${BODY_TOP}px ${GUTTER}px ${BODY_BOTTOM}px` }}>
      <div style={{ width: 48, height: ACCENT.height, marginBottom: ACCENT.gap, background: GOLD_INK, borderRadius: 2 }} />
      <div style={{ ...titleBlock(size, TITLE_LEADING, TITLE_MAX_LINES), width: card === null ? 800 : "100%", fontSize: size, fontWeight: 500, lineHeight: TITLE_LEADING, letterSpacing: "-0.035em" }}>{title}</div>
      {kicker ? <div style={{ ...clampedBlock(BODY.kicker.lines), width: "100%", marginTop: BODY.kicker.gap, fontSize: BODY.kicker.fontSize, lineHeight: BODY.kicker.leading, color: MUTED }}>{kicker}</div> : null}
    </div>

    <div style={{ display: "flex", position: "relative", flexShrink: 0, margin: `0 ${GUTTER}px`, height: FOOTER_HEIGHT, borderTop: `1px solid ${LINE}`, alignItems: "center", justifyContent: "space-between", gap: 32 }}>
      <span style={{ fontSize: 24, color: MUTED }}>openzcash.org</span>
      {stat ? <div style={{ ...clampedBlock(1), maxWidth: 720, textAlign: "right", fontSize: BODY.stat.fontSize, lineHeight: BODY.stat.leading, fontWeight: 500, color: GOLD_INK }}>{stat}</div> : null}
    </div>
  </div>;
}
