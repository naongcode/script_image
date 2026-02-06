// 대본
export interface Script {
  id: string;
  title: string;
  rawContent: string;
  genre?: string;
  styleGuide?: string;
  status: 'draft' | 'analyzing' | 'ready' | 'generating' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// 캐릭터 외모
export interface Appearance {
  age?: string;
  gender?: string;
  height?: string;
  hair?: string;
  face?: string;
  skinTone?: string;
  features?: string[];
}

// 캐릭터
export interface Character {
  id: string;
  scriptId: string;
  name: string;
  appearance: Appearance;
  defaultOutfit?: string;
  referenceImages: string[]; // 이미지 ID 목록 (최대 8개)
  selectedImage?: string; // 선택된 대표 이미지 ID
  basePrompt?: string;
  createdAt: string;
  updatedAt: string;
}

// 장면
export interface Scene {
  id: string;
  scriptId: string;
  sceneNumber: number;
  title?: string;
  location?: string;
  timeOfDay?: string;
  originalText: string;
  visualDescription?: string;
  generatedPrompt?: string;
  userEditedPrompt?: string;
  characterIds: string[];
  generatedImages: string[]; // Base64 이미지 데이터
  selectedImage?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

// AI 분석 결과
export interface AnalysisResult {
  characters: {
    name: string;
    appearance: Appearance;
    defaultOutfit?: string;
  }[];
  scenes: {
    sceneNumber: number;
    title?: string;
    location?: string;
    timeOfDay?: string;
    originalText: string;
    visualDescription: string;
    characterNames: string[];
  }[];
  styleGuide?: string;
}
