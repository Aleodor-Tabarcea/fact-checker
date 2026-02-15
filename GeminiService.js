/**
 * GEMINISERVICE.GS - External API interactions.
 */
function callGeminiMultimodal(claim, evidenceList) {
  const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error("No API key configured. Open Settings in the sidebar to add your Gemini key.");

  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptParts = [{
    text: `You are a Fact Checker. USER CLAIM: "${claim}"
    Verify this claim using the provided evidence.
    OUTPUT: A raw JSON array. For each piece of evidence:
    {"doc_title": "String", "score": Integer (0-100), "snippet": "String", "location": "String"}
    If irrelevant, score 0.`
  }];

  evidenceList.forEach((item, index) => {
    promptParts.push({ text: `\n\n[EVIDENCE ${index + 1}] (Title: ${item.title})\nContent: ${item.content}` });
  });

  promptParts.push({ text: "\nOutput JSON only." });

  const payload = { contents: [{ parts: promptParts }] };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (json.error) throw new Error("Gemini Error: " + json.error.message);

  let raw = json.candidates[0].content.parts[0].text;
  raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(raw);
}