/**
 * YOUTUBE SERVICE
 * Detects YT links, fetches metadata + transcripts.
 * Strategy:
 *   1. Official Captions API (owned videos only)
 *   2. Extract timedtext URLs directly from page HTML
 *   3. Search for getTranscriptEndpoint params and use innertube API
 */

function hydrateYouTubeContext(rawText) {
  if (!rawText) return "";

  var ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;

  var hydratedText = rawText;
  var match;
  var processedIds = {};

  while ((match = ytRegex.exec(rawText)) !== null) {
    var videoId = match[1];

    if (processedIds[videoId]) continue;
    processedIds[videoId] = true;

    try {
      var videoResponse = YouTubeAPIConnector.Videos.list('snippet', { id: videoId });
      if (!videoResponse.items || videoResponse.items.length === 0) continue;

      var snippet = videoResponse.items[0].snippet;
      var videoContext = "\n\n[📺 YOUTUBE VIDEO: " + snippet.title + "]\nDescription: " + snippet.description + "\n";

      var transcript = getVideoTranscript_(videoId);
      if (transcript) {
        videoContext += "Transcript:\n" + transcript + "\n";
        console.log("🎬 ✅ Got transcript (" + transcript.length + " chars)");
      } else {
        videoContext += "[No transcript available]\n";
      }

      hydratedText += videoContext;

    } catch (e) {
      console.warn("YouTube Failed for " + videoId + ": " + e.message);
    }
  }

  return hydratedText;
}

function getVideoTranscript_(videoId) {
  // Fetch the watch page (shared by both transcript extraction methods)
  var pageHtml = null;
  try {
    console.log("🎬 Fetching watch page...");
    var pageResp = UrlFetchApp.fetch("https://www.youtube.com/watch?v=" + videoId, {
      muteHttpExceptions: true,
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+299"
      }
    });
    if (pageResp.getResponseCode() === 200) {
      pageHtml = pageResp.getContentText();
      console.log("🎬 Page: " + pageHtml.length + " bytes");
    }
  } catch (e) {
    console.log("🎬 Page fetch failed: " + e.message);
  }

  if (!pageHtml) return null;

  // Method 2: Extract timedtext URLs directly from the raw HTML
  // Caption track URLs look like: https://www.youtube.com/api/timedtext?v=...&lang=...
  try {
    // Find all timedtext URLs in the page
    var timedtextMatches = pageHtml.match(/https?:\\\/\\\/www\.youtube\.com\\\/api\\\/timedtext\?[^"\\]*/g);

    if (!timedtextMatches || timedtextMatches.length === 0) {
      // Try unescaped version
      timedtextMatches = pageHtml.match(/https?:\/\/www\.youtube\.com\/api\/timedtext\?[^"']*/g);
    }

    if (timedtextMatches && timedtextMatches.length > 0) {
      console.log("🎬 [M2] Found " + timedtextMatches.length + " timedtext URLs in page HTML");

      // Unescape the URL (YouTube JSON has escaped slashes)
      var captionUrl = timedtextMatches[0].replace(/\\\//g, "/");
      console.log("🎬 [M2] First URL: " + captionUrl.substring(0, 120) + "...");

      // Try to find an English one first
      for (var i = 0; i < timedtextMatches.length; i++) {
        var unescaped = timedtextMatches[i].replace(/\\\//g, "/");
        if (unescaped.indexOf("lang=en") > -1) {
          captionUrl = unescaped;
          console.log("🎬 [M2] Found English track");
          break;
        }
      }

      // Download the caption track
      console.log("🎬 [M2] Downloading captions...");
      var captionResp = UrlFetchApp.fetch(captionUrl, { muteHttpExceptions: true });
      console.log("🎬 [M2] Caption response: HTTP " + captionResp.getResponseCode() + ", " + captionResp.getContentText().length + " bytes");

      if (captionResp.getResponseCode() === 200) {
        var content = captionResp.getContentText();

        // Try XML format first
        var result = parseCaptionXml_(content);
        if (result) {
          console.log("🎬 [M2] ✅ Parsed XML transcript: " + result.length + " chars");
          return result;
        }

        // Try JSON3 format
        result = parseTimedTextJson_(content);
        if (result) {
          console.log("🎬 [M2] ✅ Parsed JSON transcript: " + result.length + " chars");
          return result;
        }

        console.log("🎬 [M2] Could not parse caption response (first 200): " + content.substring(0, 200));
      }
    } else {
      console.log("🎬 [M2] No timedtext URLs found in page HTML");

      // Debug: search for any caption-related strings
      var hasTimedtext = pageHtml.indexOf("timedtext") > -1;
      var hasCaptionTracks = pageHtml.indexOf("captionTracks") > -1;
      var hasPlayerCaptions = pageHtml.indexOf("playerCaptionsTracklistRenderer") > -1;
      console.log("🎬 [M2] Debug - timedtext:" + hasTimedtext + " captionTracks:" + hasCaptionTracks + " playerCaptions:" + hasPlayerCaptions);
    }
  } catch (e) {
    console.log("🎬 [M2] Error: " + e.message);
  }

  // Method 3: Innertube get_transcript with params from page
  try {
    var keyMatch = pageHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    var apiKey = keyMatch ? keyMatch[1] : "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

    // Look for getTranscriptEndpoint params
    var paramMatch = pageHtml.match(/"getTranscriptEndpoint"\s*:\s*\{[^}]*"params"\s*:\s*"([^"]+)"/);
    var params = null;

    if (paramMatch) {
      params = paramMatch[1];
      console.log("🎬 [M3] Found transcript params in page");
    } else {
      // Try broader search
      var altMatch = pageHtml.match(/"serializedShareEntity"\s*:\s*"([^"]+)"[^}]*"getTranscriptEndpoint"/);
      if (!altMatch) {
        // Construct params manually
        var paramsBytes = [0x0a, 0x0d, 0x0a, 0x0b];
        for (var j = 0; j < videoId.length; j++) {
          paramsBytes.push(videoId.charCodeAt(j));
        }
        params = Utilities.base64Encode(paramsBytes);
        console.log("🎬 [M3] Using constructed params");
      }
    }

    if (params) {
      var url = "https://www.youtube.com/youtubei/v1/get_transcript?key=" + apiKey;
      var payload = {
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20250101.00.00",
            hl: "en",
            gl: "US"
          }
        },
        params: params
      };

      console.log("🎬 [M3] Calling get_transcript...");
      var itResp = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (itResp.getResponseCode() === 200) {
        var itData = JSON.parse(itResp.getContentText());
        var itResult = parseInnertubeTranscript_(itData);
        if (itResult) {
          console.log("🎬 [M3] ✅ Got transcript: " + itResult.length + " chars");
          return itResult;
        }
        console.log("🎬 [M3] Parsed OK but no segments. Keys: " + Object.keys(itData).join(", "));
      } else {
        console.log("🎬 [M3] HTTP " + itResp.getResponseCode());
      }
    }
  } catch (e) {
    console.log("🎬 [M3] Failed: " + e.message);
  }

  return null;
}

function parseInnertubeTranscript_(data) {
  try {
    if (!data.actions) return null;
    for (var a = 0; a < data.actions.length; a++) {
      var panel = data.actions[a].updateEngagementPanelAction;
      if (!panel || !panel.content || !panel.content.transcriptRenderer) continue;
      var body = panel.content.transcriptRenderer.body;
      if (!body || !body.transcriptBodyRenderer) continue;
      var cueGroups = body.transcriptBodyRenderer.cueGroups;
      if (!cueGroups) continue;
      var lines = [];
      for (var g = 0; g < cueGroups.length; g++) {
        var renderer = cueGroups[g].transcriptCueGroupRenderer;
        if (!renderer || !renderer.cues) continue;
        for (var c = 0; c < renderer.cues.length; c++) {
          var cue = renderer.cues[c].transcriptCueRenderer;
          if (cue && cue.cue && cue.cue.simpleText) {
            lines.push(cue.cue.simpleText);
          }
        }
      }
      if (lines.length > 0) return lines.join(" ");
    }
  } catch (e) { }
  return null;
}

function parseCaptionXml_(xml) {
  var textMatches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
  if (!textMatches || textMatches.length === 0) return null;
  var lines = [];
  for (var i = 0; i < textMatches.length; i++) {
    var line = textMatches[i]
      .replace(/<text[^>]*>/, "").replace(/<\/text>/, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, " ").trim();
    if (line.length > 0) lines.push(line);
  }
  return lines.length > 0 ? lines.join(" ") : null;
}

function parseTimedTextJson_(jsonText) {
  try {
    var data = JSON.parse(jsonText);
    if (!data.events) return null;
    var lines = [];
    for (var i = 0; i < data.events.length; i++) {
      if (data.events[i].segs) {
        var text = "";
        for (var s = 0; s < data.events[i].segs.length; s++) {
          text += data.events[i].segs[s].utf8 || "";
        }
        if (text.trim()) lines.push(text.trim());
      }
    }
    return lines.length > 0 ? lines.join(" ") : null;
  } catch (e) { return null; }
}