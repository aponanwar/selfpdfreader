import * as FileSystem from 'expo-file-system/legacy';

/**
 * Convert ArrayBuffer to Base64 in chunks to prevent Call Stack Overflow
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * High-performance, clean Base64 file reader
 * Strategy 1: Direct native FileSystem read (instant, zero overhead)
 * Strategy 2: React Native fetch() + res.arrayBuffer() (completely avoids res.blob() warning)
 * Strategy 3: Cache copy fallback
 */
export async function readUriAsBase64(uri) {
  if (!uri) {
    throw new Error('No URI provided to read.');
  }

  // Strategy 1: Native FileSystem read
  // Files from DocumentPicker (copyToCacheDirectory: true) or local storage
  // read directly in native C++/Java with maximum performance and zero overhead.
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (b64 && b64.length > 0) {
      return b64;
    }
  } catch (fsErr) {
    // Strategy 1 failed, quietly fall back to Strategy 2
  }

  // Strategy 2: fetch() with res.arrayBuffer()
  // Uses arrayBuffer() instead of blob(), eliminating the React Native BlobManager
  // performance overhead warning completely.
  try {
    const res = await fetch(uri);
    if (res.ok || res.status === 0) {
      const buffer = await res.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        return arrayBufferToBase64(buffer);
      }
    }
  } catch (fetchErr) {
    // Strategy 2 failed, quietly fall back to Strategy 3
  }

  // Strategy 3: Cache copy fallback
  try {
    const cacheUri = `${FileSystem.cacheDirectory}temp_${Date.now()}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: cacheUri });
    const b64 = await FileSystem.readAsStringAsync(cacheUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return b64;
  } catch (copyErr) {
    throw new Error('Unable to read document file.');
  }
}
