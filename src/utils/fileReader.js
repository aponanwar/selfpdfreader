import * as FileSystem from 'expo-file-system/legacy';

/**
 * Universal Base64 file reader that bypasses Android sandboxing and content:// restrictions
 * Strategy 1: React Native fetch() + Blob + FileReader (bypasses Expo FilePermissionService)
 * Strategy 2: FileSystem.readAsStringAsync
 * Strategy 3: Copy to cacheDirectory then readAsStringAsync
 */
export async function readUriAsBase64(uri) {
  if (!uri) {
    throw new Error('No URI provided to read.');
  }

  // Strategy 1: React Native fetch() + Blob + FileReader
  // Highly reliable on Android because RN's NetworkingModule directly queries
  // Android's ContentResolver and FileInputStream without Expo's sandbox path checks.
  try {
    const base64 = await new Promise((resolve, reject) => {
      fetch(uri)
        .then((res) => {
          if (!res.ok && res.status !== 0) {
            throw new Error(`Fetch returned status ${res.status}`);
          }
          return res.blob();
        })
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            if (typeof dataUrl === 'string') {
              const commaIndex = dataUrl.indexOf(',');
              const rawBase64 = commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
              resolve(rawBase64);
            } else {
              reject(new Error('FileReader did not produce string output'));
            }
          };
          reader.onerror = (e) => reject(new Error('FileReader error: ' + (e?.message || 'unknown')));
          reader.readAsDataURL(blob);
        })
        .catch((err) => reject(err));
    });

    if (base64 && base64.length > 0) {
      return base64;
    }
  } catch (fetchErr) {
    console.warn('Fetch base64 strategy failed, attempting FileSystem fallback:', fetchErr);
  }

  // Strategy 2: Direct FileSystem read
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (b64 && b64.length > 0) {
      return b64;
    }
  } catch (fsErr) {
    console.warn('Direct FileSystem.readAsStringAsync failed, attempting cache copy:', fsErr);
  }

  // Strategy 3: Copy to cache then read
  try {
    const cacheUri = `${FileSystem.cacheDirectory}temp_${Date.now()}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: cacheUri });
    const b64 = await FileSystem.readAsStringAsync(cacheUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return b64;
  } catch (copyErr) {
    throw new Error(`Unable to read file content: ${copyErr.message}`);
  }
}
