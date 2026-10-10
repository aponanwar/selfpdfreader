import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  RECENT_FILES: '@self_pdf_recent_files',
  BOOKMARKS: '@self_pdf_bookmarks',
  SETTINGS: '@self_pdf_settings',
  SAVED_LIBRARY: '@self_pdf_saved_library',
};

export const defaultSettings = {
  theme: 'light', // 'light' | 'dark' | 'sepia'
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  keepScreenAwake: true,
  defaultViewMode: 'vertical', // 'vertical' | 'horizontal'
};

export const StorageService = {
  // --- RECENT FILES ---
  async getRecentFiles() {
    try {
      const data = await AsyncStorage.getItem(KEYS.RECENT_FILES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting recent files:', error);
      return [];
    }
  },

  async addOrUpdateRecentFile(file) {
    try {
      const list = await this.getRecentFiles();
      // Remove any existing entry with the same uri or name
      const filtered = list.filter(item => item.uri !== file.uri && item.name !== file.name);
      
      const newEntry = {
        id: file.id || Date.now().toString(),
        name: file.name,
        uri: file.uri,
        size: file.size || 0,
        lastOpened: Date.now(),
        lastPage: file.lastPage || 1,
        totalPages: file.totalPages || 1,
        isFavorite: file.isFavorite || false,
      };

      const updated = [newEntry, ...filtered];
      // Keep max 50 recent files
      const trimmed = updated.slice(0, 50);
      await AsyncStorage.setItem(KEYS.RECENT_FILES, JSON.stringify(trimmed));
      return trimmed;
    } catch (error) {
      console.error('Error saving recent file:', error);
      return [];
    }
  },

  async updateReadingProgress(uri, currentPage, totalPages) {
    try {
      const list = await this.getRecentFiles();
      const updated = list.map(item => {
        if (item.uri === uri) {
          return {
            ...item,
            lastPage: currentPage,
            totalPages: totalPages || item.totalPages,
            lastOpened: Date.now(),
          };
        }
        return item;
      });
      await AsyncStorage.setItem(KEYS.RECENT_FILES, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error updating progress:', error);
      return [];
    }
  },

  async toggleFavorite(uri) {
    try {
      const list = await this.getRecentFiles();
      const updated = list.map(item => {
        if (item.uri === uri) {
          return { ...item, isFavorite: !item.isFavorite };
        }
        return item;
      });
      await AsyncStorage.setItem(KEYS.RECENT_FILES, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return [];
    }
  },

  async removeRecentFile(uri) {
    try {
      const list = await this.getRecentFiles();
      const updated = list.filter(item => item.uri !== uri);
      await AsyncStorage.setItem(KEYS.RECENT_FILES, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error removing recent file:', error);
      return [];
    }
  },

  async clearRecentFiles() {
    try {
      await AsyncStorage.removeItem(KEYS.RECENT_FILES);
      return [];
    } catch (error) {
      console.error('Error clearing recent files:', error);
      return [];
    }
  },

  // --- BOOKMARKS ---
  async getBookmarks(fileUri = null) {
    try {
      const data = await AsyncStorage.getItem(KEYS.BOOKMARKS);
      const list = data ? JSON.parse(data) : [];
      if (fileUri) {
        return list.filter(item => item.fileUri === fileUri);
      }
      return list;
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return [];
    }
  },

  async addBookmark({ fileUri, fileName, page, note = '' }) {
    try {
      const list = await this.getBookmarks();
      // Check if bookmark already exists on same page
      const exists = list.some(item => item.fileUri === fileUri && item.page === page);
      if (exists) {
        return list;
      }
      const newBookmark = {
        id: Date.now().toString(),
        fileUri,
        fileName,
        page,
        note,
        createdAt: Date.now(),
      };
      const updated = [newBookmark, ...list];
      await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      return [];
    }
  },

  async removeBookmark(id) {
    try {
      const list = await this.getBookmarks();
      const updated = list.filter(item => item.id !== id);
      await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      return [];
    }
  },

  async isPageBookmarked(fileUri, page) {
    try {
      const list = await this.getBookmarks(fileUri);
      return list.some(item => item.page === page);
    } catch (error) {
      return false;
    }
  },

  // --- SETTINGS ---
  async getSettings() {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return defaultSettings;
    }
  },

  async updateSettings(newSettings) {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...newSettings };
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Error saving settings:', error);
      return defaultSettings;
    }
  },
};
