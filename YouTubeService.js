/**
 * YOUTUBE SERVICE
 * Purpose: Middleware to detect YT links, break the OAuth perimeter (if owned), 
 * and hydrate the payload with video metadata/transcripts.
 */

function hydrateYouTubeContext(rawText) {
  if (!rawText) return "";

  // Regex to catch both standard (youtube.com/watch?v=) and short (youtu.be/) URLs
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
  
  let hydratedText = rawText;
  let match;
  const processedIds = new Set(); // Prevent infinite loops on duplicate links

  while ((match = ytRegex.exec(rawText)) !== null) {
    const videoId = match[1];
    
    if (processedIds.has(videoId)) continue;
    processedIds.add(videoId);

    try {
      // 1. Fetch Metadata (Always works for public/unlisted)
      const videoResponse = YouTubeAPIConnector.Videos.list('snippet', { id: videoId });
      if (!videoResponse.items || videoResponse.items.length === 0) continue;
      
      const snippet = videoResponse.items[0].snippet;
      let videoContext = `\n\n[📺 YOUTUBE VIDEO REFERENCED: ${snippet.title}]\nDescription: ${snippet.description}\n`;

      // 2. The Transcript Heist (Subject to OAuth Ownership)
      try {
        const captionList = YouTubeAPIConnector.Captions.list('snippet', { videoId: videoId });
        
        if (captionList.items && captionList.items.length > 0) {
          // Grab the ID of the first available caption track
          const captionId = captionList.items[0].id;
          
          // To download, we must bypass the wrapper and use UrlFetchApp with our active token
          const token = ScriptApp.getOAuthToken();
          const captionUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}`;
          const fetchOptions = { 
            headers: { Authorization: `Bearer ${token}` }, 
            muteHttpExceptions: true 
          };
          
          const captionData = UrlFetchApp.fetch(captionUrl, fetchOptions);
          
          if (captionData.getResponseCode() === 200) {
            videoContext += `Transcript: ${captionData.getContentText()}\n`;
          } else {
            videoContext += `[Transcript blocked by YouTube OAuth: Video not owned by active user]\n`;
          }
        } else {
          videoContext += `[No caption tracks exist for this video]\n`;
        }
      } catch (captionErr) {
        // Silently catch caption auth failures so we don't crash the metadata fetch
        videoContext += `[Transcript unavailable: API restricted]\n`;
      }

      // Inject the newly hydrated data back into the text stream
      hydratedText += videoContext;

    } catch (e) {
      console.warn(`YouTube API Failed for ID ${videoId}: ${e.message}`);
    }
  }

  return hydratedText;
}