/**
 * DOCUMENTSERVICE.GS - Handles the active Google Doc.
 */
function getSelectedText() {
  const selection = DocumentApp.getActiveDocument().getSelection();
  const text = [];
  
  if (selection) {
    const elements = selection.getSelectedElements();
    for (let i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        const element = elements[i].getElement().asText();
        text.push(element.getText().substring(elements[i].getStartOffset(), elements[i].getEndOffsetInclusive() + 1));
      } else {
        const element = elements[i].getElement();
        if (element.editAsText) text.push(element.asText().getText());
      }
    }
  }
  return text.join(' ').trim();
}

/**
 * Top-level body paragraphs with enough text to treat as a checkable claim.
 * @param {number} minChars - Minimum trimmed length (default 25)
 * @param {number} maxParagraphs - Cap per run (Apps Script time limits)
 * @returns {{ paragraphs: Array<{seq:number, childIndex:number, text:string}>, totalParagraphs: number, truncated: boolean }}
 */
function getParagraphClaimsForFactCheck_(minChars, maxParagraphs) {
  const min = typeof minChars === "number" ? minChars : 25;
  const maxP = typeof maxParagraphs === "number" ? maxParagraphs : 35;
  const body = DocumentApp.getActiveDocument().getBody();
  const n = body.getNumChildren();
  const all = [];
  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    const t = child.asParagraph().getText().trim();
    if (t.length < min) continue;
    all.push({ seq: all.length, childIndex: i, text: t });
  }
  const truncated = all.length > maxP;
  return {
    paragraphs: all.slice(0, maxP),
    totalParagraphs: all.length,
    truncated: truncated
  };
}