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