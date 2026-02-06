// IndexedDB를 사용한 이미지 저장소
const DB_NAME = 'script-image-generator-images';
const DB_VERSION = 2;
const STORE_NAME = 'images';
const CHAR_STORE_NAME = 'character-images';

let db: IDBDatabase | null = null;

// DB 초기화
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CHAR_STORE_NAME)) {
        database.createObjectStore(CHAR_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// 이미지 저장
export async function saveImage(sceneId: string, imageIndex: number, imageData: string): Promise<string> {
  const database = await initDB();
  const imageId = `${sceneId}_${imageIndex}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({
      id: imageId,
      sceneId,
      imageIndex,
      data: imageData,
      createdAt: new Date().toISOString(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(imageId);
  });
}

// 이미지 가져오기
export async function getImage(imageId: string): Promise<string | null> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(imageId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
  });
}

// 장면의 모든 이미지 가져오기
export async function getImagesByScene(sceneId: string): Promise<{ id: string; data: string }[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allImages = request.result || [];
      const sceneImages = allImages
        .filter((img: any) => img.sceneId === sceneId)
        .map((img: any) => ({ id: img.id, data: img.data }));
      resolve(sceneImages);
    };
  });
}

// 이미지 삭제
export async function deleteImage(imageId: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(imageId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// 장면의 모든 이미지 삭제
export async function deleteImagesByScene(sceneId: string): Promise<void> {
  const images = await getImagesByScene(sceneId);
  for (const img of images) {
    await deleteImage(img.id);
  }
}

// ===== 캐릭터 이미지 관련 함수 =====

// 캐릭터 이미지 저장
export async function saveCharacterImage(characterId: string, imageIndex: number, imageData: string): Promise<string> {
  const database = await initDB();
  const imageId = `char_${characterId}_${imageIndex}_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAR_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CHAR_STORE_NAME);

    const request = store.put({
      id: imageId,
      characterId,
      imageIndex,
      data: imageData,
      createdAt: new Date().toISOString(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(imageId);
  });
}

// 캐릭터 이미지 가져오기
export async function getCharacterImage(imageId: string): Promise<string | null> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAR_STORE_NAME], 'readonly');
    const store = transaction.objectStore(CHAR_STORE_NAME);
    const request = store.get(imageId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
  });
}

// 캐릭터의 모든 이미지 가져오기
export async function getImagesByCharacter(characterId: string): Promise<{ id: string; data: string }[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAR_STORE_NAME], 'readonly');
    const store = transaction.objectStore(CHAR_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allImages = request.result || [];
      const charImages = allImages
        .filter((img: any) => img.characterId === characterId)
        .map((img: any) => ({ id: img.id, data: img.data }));
      resolve(charImages);
    };
  });
}

// 캐릭터 이미지 삭제
export async function deleteCharacterImage(imageId: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAR_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CHAR_STORE_NAME);
    const request = store.delete(imageId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
