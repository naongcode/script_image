# Script Image Generator (대본 이미지 생성기)

## 프로젝트 개요
대본 텍스트를 입력하면 AI가 자동으로 장면을 분석하고, 캐릭터 일관성을 유지하며 이미지를 생성하는 웹 애플리케이션

**순수 프론트엔드 앱** - 백엔드 서버 없이 브라우저에서 모든 것을 처리

## 핵심 기능

### 1. 대본 입력 및 분석
- 일반 텍스트 형식의 대본 입력
- AI가 대본을 분석하여 자동으로:
  - 등장인물(캐릭터) 추출
  - 시각화할 장면 선정
  - 각 장면의 시각적 묘사 생성

### 2. 캐릭터 관리 (일관성 유지 핵심)
- 캐릭터별 외모 설정 (나이, 성별, 머리, 얼굴 등)
- 캐릭터별 기본 의상 설정
- **참조 이미지 업로드 (최대 8개)**
  - 이미지 생성 시 참조 이미지를 함께 전달하여 일관성 유지

### 3. 장면 이미지 생성
- 각 장면별 이미지 생성 프롬프트 자동 생성
- 나노바나나(Gemini)로 이미지 생성
- 캐릭터 참조 이미지를 함께 전달하여 일관된 캐릭터 표현
- 재생성 및 프롬프트 수정 기능

---

## 사용 기술

| 구분 | 기술 |
|------|------|
| 빌드 도구 | Vite |
| 프레임워크 | React 18 + TypeScript |
| 스타일링 | Tailwind CSS |
| 데이터 저장 | 브라우저 localStorage |
| 이미지 저장 | Base64 (localStorage) + 다운로드 |
| AI | Google Gemini API (브라우저에서 직접 호출) |

### AI 모델
- `gemini-2.0-flash-exp`: 대본 분석 (텍스트)
- `gemini-2.5-flash-image`: 이미지 생성 (나노바나나)

### API 키 관리
- 사용자가 설정 페이지에서 직접 API 키 입력
- localStorage에 저장 (개인 사용 목적)

---

## 워크플로우

```
[1] 설정: API 키 입력 (최초 1회)
    │
    ▼
[2] 대본 입력
    │
    ▼
[3] AI 분석 (자동)
    ├─ 캐릭터 추출
    ├─ 장면 분리
    └─ 시각적 묘사 생성
    │
    ▼
[4] 캐릭터 설정
    ├─ 외모/의상 수정
    └─ 참조 이미지 업로드 ★ (일관성 핵심)
    │
    ▼
[5] 장면 이미지 생성
    ├─ 프롬프트 확인/수정
    └─ 이미지 생성 (참조 이미지 전달)
    │
    ▼
[6] 결과 확인/다운로드
```

---

## 페이지 구조 (SPA - React Router)

### 홈 (`/`)
- 대본 목록 표시
- 새 대본 추가 버튼
- 설정 버튼 (API 키)

### 설정 (`/settings`)
- Google API 키 입력
- 저장 버튼

### 새 대본 (`/scripts/new`)
- 대본 제목 입력
- 대본 텍스트 입력 (textarea)
- 장르 선택 (선택사항)
- "분석 시작" 버튼

### 대본 상세 (`/scripts/:id`)
- 탭 네비게이션: 정보 | 캐릭터 | 장면 | 생성
- 대본 정보 표시/수정

### 캐릭터 탭 (`/scripts/:id/characters`)
- 캐릭터 카드 목록
- 각 캐릭터:
  - 이름, 외모 정보 편집
  - 참조 이미지 업로드/삭제 (드래그앤드롭)
  - AI 프롬프트 미리보기

### 장면 탭 (`/scripts/:id/scenes`)
- 장면 리스트
- 각 장면:
  - 원본 대본 텍스트
  - 등장 캐릭터
  - 생성 프롬프트 (수정 가능)
  - 이미지 생성 버튼
  - 생성된 이미지 갤러리

### 생성 탭 (`/scripts/:id/generate`)
- 전체 장면 일괄 생성
- 진행 상황 표시
- 생성된 이미지 미리보기
- 이미지 다운로드

---

## 데이터 구조 (localStorage에 저장)

### localStorage 키 구조
```
script-image-generator:apiKey     → API 키
script-image-generator:scripts    → Script[]
script-image-generator:characters → Character[]
script-image-generator:scenes     → Scene[]
```

### Script (대본)
```typescript
interface Script {
  id: string;
  title: string;           // 대본 제목
  rawContent: string;      // 원본 대본 텍스트
  genre?: string;          // 장르
  styleGuide?: string;     // AI 생성 스타일 가이드
  status: 'draft' | 'analyzing' | 'ready' | 'generating' | 'completed';
  createdAt: string;
  updatedAt: string;
}
```

### Character (캐릭터)
```typescript
interface Character {
  id: string;
  scriptId: string;
  name: string;            // 캐릭터 이름
  appearance: {            // 외모 설정
    age?: string;          // "20대 중반"
    gender?: string;       // "여성"
    height?: string;       // "165cm"
    hair?: string;         // "긴 검은 머리, 웨이브"
    face?: string;         // "동그란 얼굴, 큰 눈"
    skinTone?: string;     // "밝은 피부"
    features?: string[];   // ["왼쪽 볼에 점", "주근깨"]
  };
  defaultOutfit?: string;  // 기본 의상
  referenceImages: string[]; // Base64 이미지 데이터 (최대 8개)
  basePrompt?: string;     // AI 생성 기본 프롬프트
  createdAt: string;
  updatedAt: string;
}
```

### Scene (장면)
```typescript
interface Scene {
  id: string;
  scriptId: string;
  sceneNumber: number;     // 장면 번호
  title?: string;          // 장면 제목
  location?: string;       // 장소
  timeOfDay?: string;      // 시간대 (낮/밤/새벽)
  originalText: string;    // 원본 대본 텍스트
  visualDescription?: string; // AI 생성 시각적 묘사
  generatedPrompt?: string;   // 이미지 생성 프롬프트
  userEditedPrompt?: string;  // 사용자 수정 프롬프트
  characterIds: string[];     // 등장 캐릭터 ID
  generatedImages: string[];  // Base64 이미지 데이터
  selectedImage?: string;     // 선택된 최종 이미지 (Base64)
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}
```

---

## 핵심 함수 (프론트엔드)

### Gemini API 호출 (브라우저에서 직접)
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

// API 클라이언트 생성
const genAI = new GoogleGenerativeAI(apiKey);

// 대본 분석
async function analyzeScript(content: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// 이미지 생성 (참조 이미지 포함)
async function generateImage(prompt: string, referenceImages: string[]) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

  const parts = [
    // 참조 이미지들 (Base64)
    ...referenceImages.map(img => ({
      inlineData: { mimeType: 'image/png', data: img }
    })),
    // 프롬프트
    { text: prompt }
  ];

  const result = await model.generateContent(parts);
  // 생성된 이미지 Base64 반환
}
```

### localStorage 유틸리티
```typescript
const STORAGE_PREFIX = 'script-image-generator:';

function saveData<T>(key: string, data: T) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
}

function loadData<T>(key: string): T | null {
  const data = localStorage.getItem(STORAGE_PREFIX + key);
  return data ? JSON.parse(data) : null;
}
```

---

## 캐릭터 일관성 유지 방법

### 핵심: 참조 이미지 전달
이미지 생성 시 캐릭터의 참조 이미지를 Gemini API에 함께 전달

```
[요청 구조]
parts = [
  { inlineData: 캐릭터1_참조이미지1 (Base64) },
  { inlineData: 캐릭터1_참조이미지2 (Base64) },
  { inlineData: 캐릭터2_참조이미지1 (Base64) },
  ...
  { text: 프롬프트 }
]
```

### 프롬프트 구조
```
🎬 SCENE IMAGE GENERATION

You are provided with character reference images.
Create an image that matches this scene while maintaining character consistency.

📍 SCENE:
- Location: [장소]
- Time: [시간]
- Atmosphere: [분위기]

👥 CHARACTERS (use reference images for consistency):
- [캐릭터1 이름]: [외모 설명], [의상], [표정/포즈]
- [캐릭터2 이름]: [외모 설명], [의상], [표정/포즈]

📝 SCENE DESCRIPTION:
[시각적 묘사]

⚠️ CRITICAL:
- Characters MUST match the provided reference images
- Maintain consistent facial features and body proportions
```

---

## 폴더 구조

```
make_image/
├── src/
│   ├── components/           # React 컴포넌트
│   │   ├── Layout.tsx
│   │   ├── ScriptList.tsx
│   │   ├── ScriptForm.tsx
│   │   ├── CharacterCard.tsx
│   │   ├── SceneCard.tsx
│   │   └── ImageGallery.tsx
│   ├── pages/                # 페이지 컴포넌트
│   │   ├── Home.tsx
│   │   ├── Settings.tsx
│   │   ├── ScriptNew.tsx
│   │   ├── ScriptDetail.tsx
│   │   ├── Characters.tsx
│   │   ├── Scenes.tsx
│   │   └── Generate.tsx
│   ├── hooks/                # 커스텀 훅
│   │   ├── useLocalStorage.ts
│   │   └── useGemini.ts
│   ├── lib/                  # 유틸리티
│   │   ├── gemini.ts         # Gemini API 클라이언트
│   │   ├── storage.ts        # localStorage 유틸리티
│   │   └── prompts.ts        # 프롬프트 템플릿
│   ├── types/                # TypeScript 타입
│   │   └── index.ts
│   ├── App.tsx               # 앱 진입점 (라우팅)
│   ├── main.tsx              # React 렌더링
│   └── index.css             # 글로벌 스타일
├── public/
│   └── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 접속
http://localhost:5173

# 빌드 (정적 파일 생성)
npm run build
```

---

## 배포

정적 파일로 빌드되므로 어디서든 호스팅 가능:
- GitHub Pages
- Vercel
- Netlify
- 로컬 파일로 직접 실행

---

## 향후 확장 가능

- [ ] 대본 형식 자동 인식 (Final Draft, Fountain 등)
- [ ] 스토리보드 PDF 내보내기
- [ ] 캐릭터 AI 자동 생성 (참조 이미지 없이)
- [ ] 장면 간 연속성 체크
- [ ] 다국어 지원
