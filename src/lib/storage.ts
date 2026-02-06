import type { Script, Character, Scene } from '../types';

const STORAGE_PREFIX = 'script-image-generator:';

// 범용 저장/로드 함수
export function saveData<T>(key: string, data: T): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
}

export function loadData<T>(key: string): T | null {
  const data = localStorage.getItem(STORAGE_PREFIX + key);
  return data ? JSON.parse(data) : null;
}

// API 키
export function saveApiKey(apiKey: string): void {
  saveData('apiKey', apiKey);
}

export function loadApiKey(): string | null {
  return loadData<string>('apiKey');
}

// Scripts
export function loadScripts(): Script[] {
  return loadData<Script[]>('scripts') || [];
}

export function saveScripts(scripts: Script[]): void {
  saveData('scripts', scripts);
}

export function getScript(id: string): Script | undefined {
  return loadScripts().find(s => s.id === id);
}

export function addScript(script: Script): void {
  const scripts = loadScripts();
  scripts.push(script);
  saveScripts(scripts);
}

export function updateScript(id: string, updates: Partial<Script>): void {
  const scripts = loadScripts();
  const index = scripts.findIndex(s => s.id === id);
  if (index !== -1) {
    scripts[index] = { ...scripts[index], ...updates, updatedAt: new Date().toISOString() };
    saveScripts(scripts);
  }
}

export function deleteScript(id: string): void {
  const scripts = loadScripts().filter(s => s.id !== id);
  saveScripts(scripts);
  // 관련 캐릭터, 장면도 삭제
  const characters = loadCharacters().filter(c => c.scriptId !== id);
  saveCharacters(characters);
  const scenes = loadScenes().filter(s => s.scriptId !== id);
  saveScenes(scenes);
}

// Characters
export function loadCharacters(): Character[] {
  return loadData<Character[]>('characters') || [];
}

export function saveCharacters(characters: Character[]): void {
  saveData('characters', characters);
}

export function getCharactersByScript(scriptId: string): Character[] {
  return loadCharacters().filter(c => c.scriptId === scriptId);
}

export function getCharacter(id: string): Character | undefined {
  return loadCharacters().find(c => c.id === id);
}

export function addCharacter(character: Character): void {
  const characters = loadCharacters();
  characters.push(character);
  saveCharacters(characters);
}

export function updateCharacter(id: string, updates: Partial<Character>): void {
  const characters = loadCharacters();
  const index = characters.findIndex(c => c.id === id);
  if (index !== -1) {
    characters[index] = { ...characters[index], ...updates, updatedAt: new Date().toISOString() };
    saveCharacters(characters);
  }
}

export function deleteCharacter(id: string): void {
  const characters = loadCharacters().filter(c => c.id !== id);
  saveCharacters(characters);
}

// Scenes
export function loadScenes(): Scene[] {
  return loadData<Scene[]>('scenes') || [];
}

export function saveScenes(scenes: Scene[]): void {
  saveData('scenes', scenes);
}

export function getScenesByScript(scriptId: string): Scene[] {
  return loadScenes()
    .filter(s => s.scriptId === scriptId)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);
}

export function getScene(id: string): Scene | undefined {
  return loadScenes().find(s => s.id === id);
}

export function addScene(scene: Scene): void {
  const scenes = loadScenes();
  scenes.push(scene);
  saveScenes(scenes);
}

export function updateScene(id: string, updates: Partial<Scene>): void {
  const scenes = loadScenes();
  const index = scenes.findIndex(s => s.id === id);
  if (index !== -1) {
    scenes[index] = { ...scenes[index], ...updates, updatedAt: new Date().toISOString() };
    saveScenes(scenes);
  }
}

export function deleteScene(id: string): void {
  const scenes = loadScenes().filter(s => s.id !== id);
  saveScenes(scenes);
}

// 대량 저장 (분석 결과용)
export function saveAnalysisResult(
  scriptId: string,
  characters: Character[],
  scenes: Scene[]
): void {
  // 기존 데이터 삭제
  const existingCharacters = loadCharacters().filter(c => c.scriptId !== scriptId);
  const existingScenes = loadScenes().filter(s => s.scriptId !== scriptId);

  // 새 데이터 추가
  saveCharacters([...existingCharacters, ...characters]);
  saveScenes([...existingScenes, ...scenes]);
}
