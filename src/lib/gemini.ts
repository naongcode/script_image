import { GoogleGenAI } from '@google/genai';
import type { AnalysisResult } from '../types';
import { loadApiKey } from './storage';

// API 클라이언트 캐시
let cachedAI: GoogleGenAI | null = null;
let cachedKey: string | null = null;

// API 키 가져오기 (환경변수 → localStorage 순서)
function getApiKey(): string | null {
  const envKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (envKey) return envKey;
  return loadApiKey();
}

// API 클라이언트 가져오기
export function getAI(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않았습니다. 설정 페이지에서 Gemini API 키를 입력해주세요.');
  }
  // 키가 변경되면 클라이언트 재생성
  if (!cachedAI || cachedKey !== apiKey) {
    cachedAI = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedAI;
}

// 화풍 스타일 옵션
export type ImageStyle = 'realistic' | 'anime' | 'watercolor' | 'cinematic' | 'comic';

export const IMAGE_STYLES: { id: ImageStyle; name: string; description: string }[] = [
  { id: 'realistic', name: '실사', description: 'Photorealistic, like a professional photograph' },
  { id: 'anime', name: '애니메이션', description: 'Japanese anime style with vibrant colors' },
  { id: 'cinematic', name: '시네마틱', description: 'Cinematic movie still with dramatic lighting' },
  { id: 'watercolor', name: '수채화', description: 'Soft watercolor painting style' },
  { id: 'comic', name: '만화', description: 'Comic book / graphic novel style' },
];

// 대본 분석 (텍스트 모델 사용)
export async function analyzeScript(content: string): Promise<AnalysisResult> {
  const prompt = `Analyze the following script and respond in JSON format.

Script:
---
${content}
---

Respond with this exact JSON format (JSON only, no other text):
{
  "characters": [
    {
      "name": "Character name (keep original language)",
      "appearance": {
        "age": "Age range (e.g., mid-20s)",
        "gender": "Gender",
        "height": "Height estimate",
        "hair": "Hair style and color in English",
        "face": "Facial features in English",
        "skinTone": "Skin tone in English",
        "features": ["feature1 in English", "feature2 in English"]
      },
      "defaultOutfit": "Default outfit description in English"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title (keep original language)",
      "location": "Location in English",
      "timeOfDay": "Time of day in English (morning/afternoon/evening/night)",
      "originalText": "Original script text for this scene",
      "visualDescription": "MUST BE IN ENGLISH: Detailed visual description for image generation. Include character positions, actions, expressions, lighting, atmosphere, and background details.",
      "characterNames": ["Character names appearing in this scene"]
    }
  ],
  "styleGuide": "Overall visual style guide in English (color palette, mood, atmosphere)"
}

IMPORTANT RULES:
1. Only select visually interesting scenes (exclude dialogue-only scenes)
2. visualDescription MUST be written in ENGLISH for better image generation
3. Make visualDescription detailed and specific for AI image generation
4. If character appearance is not mentioned in script, infer reasonably
5. Keep character names in their original language`;

  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    const startIndex = responseText.indexOf('{');
    const endIndex = responseText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      jsonStr = responseText.slice(startIndex, endIndex + 1);
    }
  }

  return JSON.parse(jsonStr) as AnalysisResult;
}

// 이미지 생성 (Nano Banana - gemini-2.5-flash-image)
export async function generateSceneImage(
  prompt: string,
  referenceImages: string[] = []
): Promise<string> {
  const contents: any[] = [];

  for (const img of referenceImages.slice(0, 8)) {
    const base64Data = img.includes(',') ? img.split(',')[1] : img;
    contents.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Data,
      },
    });
  }

  contents.push({ text: prompt });

  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: contents,
  });

  const candidates = response.candidates;

  if (!candidates || candidates.length === 0) {
    throw new Error('이미지 생성 실패: 응답이 없습니다.');
  }

  const parts = candidates[0].content?.parts || [];

  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }

  const textPart = parts.find((p: any) => p.text);
  if (textPart?.text) {
    throw new Error(`이미지 생성 실패: ${textPart.text}`);
  }

  throw new Error('이미지 생성 실패: 이미지 데이터를 찾을 수 없습니다.');
}

// 스타일별 프롬프트 수식어
function getStyleModifier(style: ImageStyle): string {
  switch (style) {
    case 'realistic':
      return 'Photorealistic, high-resolution photograph, natural lighting, realistic skin texture, shot on professional camera, 8K quality';
    case 'anime':
      return 'Japanese anime style, vibrant colors, clean line art, expressive eyes, detailed background, Studio Ghibli quality';
    case 'cinematic':
      return 'Cinematic movie still, dramatic lighting, shallow depth of field, anamorphic lens flare, film grain, Hollywood production quality';
    case 'watercolor':
      return 'Soft watercolor painting, delicate brush strokes, gentle color blending, artistic and dreamy atmosphere';
    case 'comic':
      return 'Comic book style, bold outlines, dynamic composition, graphic novel aesthetic, cel shading';
    default:
      return 'High quality illustration';
  }
}

// 장면 프롬프트 생성
export function buildScenePrompt(
  scene: {
    location?: string;
    timeOfDay?: string;
    visualDescription?: string;
    userEditedPrompt?: string;
  },
  characters: {
    name: string;
    appearance: any;
    defaultOutfit?: string;
  }[],
  style: ImageStyle = 'realistic'
): string {
  if (scene.userEditedPrompt) {
    return scene.userEditedPrompt;
  }

  const styleModifier = getStyleModifier(style);

  const characterDescriptions = characters.map(char => {
    const app = char.appearance;
    const features = [
      app.age,
      app.gender,
      app.height,
      app.hair,
      app.face,
      app.skinTone,
      ...(app.features || []),
    ].filter(Boolean).join(', ');

    return `- ${char.name}: ${features}. Outfit: ${char.defaultOutfit || 'casual'}`;
  }).join('\n');

  return `${styleModifier}

SCENE:
- Location: ${scene.location || 'unspecified'}
- Time: ${scene.timeOfDay || 'day'}

CHARACTERS (match the reference images exactly):
${characterDescriptions}

SCENE DESCRIPTION:
${scene.visualDescription || 'No description'}

CRITICAL REQUIREMENTS:
- Characters MUST match the provided reference images exactly
- Maintain consistent facial features, hair style, and body proportions
- Follow the specified art style strictly
- High quality, professional composition`;
}
