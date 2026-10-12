/**
 * Optional capture-adapter lane (RNF-01 lane 3 — ≤ 14 KB gz, loaded on demand).
 *
 * **Build/size shell only.** D-08 closed DOM serialization (`html-to-image`,
 * SVG `foreignObject`) as the *primary* capture path — it silently fails on
 * cross-origin images, `<video>`, WebGL and host closed shadow roots — and kept
 * it as an optional `CaptureSource` adapter behind R-02's seam. This lane is
 * that adapter's home; the primary path stays `getDisplayMedia` + canvas.
 */

/** Lane identity for the size gate. */
export const DOM_SERIALIZE_LANE = 'optional-adapter' as const;
