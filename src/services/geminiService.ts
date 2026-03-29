import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface Story {
  id: string;
  text: string;
  authorId: string;
  createdAt?: any;
  keywords?: string[];
  isPremiumAuthor?: boolean;
}

export interface MatchOptions {
  tone?: string;
  themeKeywords?: string[];
  preferredLength?: 'short' | 'medium' | 'long';
  connectedUserIds?: string[];
  isPremiumUser?: boolean;
}

export async function findSimilarStory(
  newStory: string, 
  existingStories: Story[], 
  currentUserId: string,
  options?: MatchOptions
): Promise<Story | null> {
  // Filter out stories by the current user
  const otherStories = existingStories.filter(s => s.authorId !== currentUserId);
  
  if (otherStories.length === 0) return null;

  const toneContext = options?.tone ? `The desired tone is ${options.tone}.` : '';
  const themeContext = options?.themeKeywords?.length ? `Focus on themes like: ${options.themeKeywords.join(', ')}.` : '';
  
  const newStoryLength = newStory.length;
  const lengthContext = options?.preferredLength 
    ? `CRITICAL: The user has a STRONG preference for a match that is ${options.preferredLength} in length. 
       Prioritize stories of this length above all else. Only consider stories of other lengths if no reasonably similar story exists within the preferred length category.
       For context:
       - 'short' is roughly < 100 characters.
       - 'medium' is roughly 100-300 characters.
       - 'long' is roughly > 300 characters.
       The new story is ${newStoryLength} characters long.`
    : `The new story is ${newStoryLength} characters long.`;

  const connectionContext = options?.connectedUserIds?.length 
    ? `PRIORITY: The user is ALREADY connected to these author IDs: ${options.connectedUserIds.join(', ')}. 
       You MUST prioritize finding a match with an author NOT in this list. 
       Only pick an author from this list if NO other reasonably similar story exists from a new author.`
    : '';

  const premiumContext = options?.isPremiumUser 
    ? `PREMIUM USER PRIORITY: The current user is a PREMIUM member. 
       You MUST prioritize matching them with other PREMIUM authors or authors of the most RECENT/ACTIVE stories. 
       Look for the highest quality and most relevant match possible, favoring those with 'isPremiumAuthor: true' or very recent timestamps.`
    : '';

  const prompt = `
    You are a matching engine for a storytelling app called StorySpot.
    A user just posted a new story: "${newStory}"
    
    ${toneContext}
    ${themeContext}
    ${lengthContext}
    ${connectionContext}
    ${premiumContext}

    Here is a list of existing stories with their author IDs, character counts, relative age, keywords, and premium status:
    ${otherStories.map((s, i) => {
      const dateStr = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : 'Recently';
      const keywordsStr = s.keywords?.length ? `Keywords: ${s.keywords.join(', ')}` : 'No keywords';
      const premiumStr = s.isPremiumAuthor ? 'Premium Author: Yes' : 'Premium Author: No';
      return `${i} [Author: ${s.authorId}, Length: ${s.text.length} chars, Posted: ${dateStr}, ${keywordsStr}, ${premiumStr}]: ${s.text}`;
    }).join('\n')}
    
    Find the most similar story to the new one in terms of theme, emotion, or experience.
    
    IMPORTANT MATCHING RULES:
    1. NEW CONNECTIONS: Prioritize authors the user is NOT already connected to (see PRIORITY above).
    2. PREMIUM PRIORITY: If the current user is PREMIUM, favor other PREMIUM authors or very recent stories to ensure high-quality, active connections.
    3. LENGTH PREFERENCE: If a preferred length was specified, you MUST prioritize stories that match that length. 
    4. Only consider stories of other lengths if no reasonably similar story exists within the preferred length category.
    5. If multiple stories match the preferred length, pick the one that best matches the requested tone or themes.
    6. RECENCY FACTOR: If multiple stories are equally strong matches in terms of theme and length, ALWAYS prioritize the one that was posted more recently.
    
    Return ONLY the index of the most similar story as a single number.
    If no story is a strong match, pick the one that shares at least one minor emotional thread.
    If absolutely no connection can be made, return the index of a random story from the list to ensure a connection is still formed.
    
    Return ONLY the number.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const indexStr = response.text.trim();
    const index = parseInt(indexStr);

    if (!isNaN(index) && index >= 0 && index < otherStories.length) {
      return otherStories[index];
    }
  } catch (error) {
    console.error("Error matching stories:", error);
  }

  // Fallback to random if Gemini fails, returns invalid index, or explicitly says no match
  // This ensures a connection is ALWAYS made as requested.
  const randomIndex = Math.floor(Math.random() * otherStories.length);
  return otherStories[randomIndex];
}

export async function suggestKeywords(storyText: string): Promise<string[]> {
  if (!storyText.trim() || storyText.length < 10) return [];

  const prompt = `
    Analyze the following story fragment and suggest 3-5 relevant keywords or themes.
    The keywords should be single words or short phrases, evocative and atmospheric.
    
    Story: "${storyText}"
    
    Return ONLY a comma-separated list of keywords.
    Example: nostalgia, rain, lost love, childhood
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const keywordsStr = response.text.trim();
    return keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k !== '');
  } catch (error) {
    console.error("Error suggesting keywords:", error);
    return [];
  }
}

export async function getDeepPrompts(conversationContext: string): Promise<string[]> {
  const prompt = `
    You are a conversation facilitator for a deep, empathetic storytelling app.
    Based on the following conversation snippet, suggest 3 short, open-ended questions or prompts that would help the users connect on a deeper level.
    
    Conversation:
    ${conversationContext}
    
    Requirements:
    - Prompts should be empathetic and curious.
    - Prompts should be short (max 10 words).
    - Focus on emotions, underlying meanings, or shared human experiences.
    
    Examples:
    - "What made you feel this way?"
    - "What do you wish someone understood?"
    - "How did that moment change you?"
    
    Return ONLY a comma-separated list of 3 prompts.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const promptsStr = response.text.trim();
    return promptsStr.split(',').map(p => p.trim()).filter(p => p !== '');
  } catch (error) {
    console.error("Error fetching deep prompts:", error);
    return [
      "What made you feel this way?",
      "What do you wish someone understood?",
      "How did that moment change you?"
    ];
  }
}
