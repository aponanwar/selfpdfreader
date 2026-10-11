import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { StorageService } from '../services/storage';
import { generatePDFViewerHTML } from '../components/pdfTemplate';
import { readUriAsBase64 } from '../utils/fileReader';
import JumpToPageModal from '../components/JumpToPageModal';
import BookmarksModal from '../components/BookmarksModal';
import TTSPlayer from '../components/TTSPlayer';

export default function ReaderScreen({ file, onBack, initialTheme = 'light' }) {
  // Keep screen awake while reading
  useKeepAwake();

  const [base64Data, setBase64Data] = useState(null);
  const [loadingFile, setLoadingFile] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const [currentPage, setCurrentPage] = useState(file.lastPage || 1);
  const [totalPages, setTotalPages] = useState(file.totalPages || 1);
  const [theme, setTheme] = useState(initialTheme);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Modals and Tools
  const [jumpModalVisible, setJumpModalVisible] = useState(false);
  const [bookmarksModalVisible, setBookmarksModalVisible] = useState(false);
  const [bookmarksList, setBookmarksList] = useState([]);

  // Search
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState(null);

  // Text-To-Speech
  const [isTTSVisible, setIsTTSVisible] = useState(false);
  const [pageText, setPageText] = useState('');

  const webViewRef = useRef(null);
  const themeColors = colors[theme] || colors.light;

  // Handle hardware back button on Android
  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onBack]);

  // Read the PDF file into base64
  useEffect(() => {
    let isMounted = true;

    async function loadPdfFile() {
      try {
        setLoadingFile(true);
        setErrorMessage(null);

        const b64 = await readUriAsBase64(file.uri);

        if (isMounted) {
          setBase64Data(b64);
          setLoadingFile(false);
        }
      } catch (err) {
        console.error('Error loading PDF file:', err);
        if (isMounted) {
          setErrorMessage('Could not open document: ' + (err.message || 'Unknown error'));
          setLoadingFile(false);
        }
      }
    }

    loadPdfFile();

    return () => {
      isMounted = false;
    };
  }, [file.uri]);

  // Check bookmark status on page change
  useEffect(() => {
    async function checkBookmark() {
      const bookmarked = await StorageService.isPageBookmarked(file.uri, currentPage);
      setIsBookmarked(bookmarked);
    }
    checkBookmark();
  }, [currentPage, file.uri]);

  // Load bookmarks list
  const loadBookmarks = async () => {
    const list = await StorageService.getBookmarks(file.uri);
    setBookmarksList(list);
  };

  // Send message to WebView
  const sendWebViewMessage = (action, payload = {}) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ action, ...payload }));
    }
  };

  // Handle message from WebView
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'pageChanged':
          setCurrentPage(data.currentPage);
          setTotalPages(data.totalPages);
          // Save reading progress
          await StorageService.updateReadingProgress(file.uri, data.currentPage, data.totalPages);
          break;
        case 'docLoaded':
          setTotalPages(data.totalPages);
          setCurrentPage(data.currentPage);
          await StorageService.updateReadingProgress(file.uri, data.currentPage, data.totalPages);
          break;
        case 'extractedText':
          setPageText(data.text || '');
          break;
        case 'searchResults':
          setSearchMatches(data.count);
          if (data.pages && data.pages.length > 0) {
            // Jump to first match
            sendWebViewMessage('goToPage', { page: data.pages[0] });
          }
          break;
        case 'error':
          Alert.alert('PDF Viewer Error', data.message || 'Failed to render document.');
          break;
      }
    } catch (e) {
      console.error('WebView message parse error:', e);
    }
  };

  // Bookmark Toggle
  const handleToggleBookmark = async () => {
    if (isBookmarked) {
      const bookmarks = await StorageService.getBookmarks(file.uri);
      const target = bookmarks.find((b) => b.page === currentPage);
      if (target) {
        await StorageService.removeBookmark(target.id);
        setIsBookmarked(false);
      }
    } else {
      await StorageService.addBookmark({
        fileUri: file.uri,
        fileName: file.name,
        page: currentPage,
        note: `Page ${currentPage}`,
      });
      setIsBookmarked(true);
    }
  };

  // Cycle Theme: Light -> Dark (Night) -> Sepia
  const cycleTheme = () => {
    const themes = ['light', 'dark', 'sepia'];
    const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    setTheme(nextTheme);
    sendWebViewMessage('setTheme', { theme: nextTheme });
  };

  // Request Text-To-Speech for current page
  const handleToggleTTS = () => {
    if (!isTTSVisible) {
      setIsTTSVisible(true);
      sendWebViewMessage('extractText');
    } else {
      setIsTTSVisible(false);
    }
  };

  // Search in PDF
  const handleSearch = () => {
    if (searchQuery.trim().length > 0) {
      sendWebViewMessage('search', { query: searchQuery });
    }
  };

  if (loadingFile) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.text }]}>Opening PDF...</Text>
        <Text style={[styles.loadingSubtext, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {file.name}
        </Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Ionicons name="alert-circle-outline" size={56} color={themeColors.danger} />
        <Text style={[styles.errorTitle, { color: themeColors.text }]}>Unable to open file</Text>
        <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>{errorMessage}</Text>
        <TouchableOpacity
          style={[styles.backBtnLarge, { backgroundColor: themeColors.primary }]}
          onPress={onBack}
        >
          <Text style={styles.backBtnLargeText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const htmlContent = generatePDFViewerHTML(base64Data, currentPage, theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.card}
      />

      {/* TOP HEADER CONTROLS */}
      {controlsVisible && (
        <View style={[styles.topBar, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.topIconBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>

          <View style={styles.topActions}>
            {/* Search Button */}
            <TouchableOpacity
              onPress={() => setIsSearchVisible(!isSearchVisible)}
              style={styles.topIconBtn}
            >
              <Ionicons
                name="search"
                size={22}
                color={isSearchVisible ? themeColors.primary : themeColors.text}
              />
            </TouchableOpacity>

            {/* TTS Audio Read Button */}
            <TouchableOpacity onPress={handleToggleTTS} style={styles.topIconBtn}>
              <Ionicons
                name={isTTSVisible ? 'volume-high' : 'volume-medium-outline'}
                size={22}
                color={isTTSVisible ? themeColors.primary : themeColors.text}
              />
            </TouchableOpacity>

            {/* Bookmark Button */}
            <TouchableOpacity onPress={handleToggleBookmark} style={styles.topIconBtn}>
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={isBookmarked ? '#F59E0B' : themeColors.text}
              />
            </TouchableOpacity>

            {/* Theme Toggle (Light / Dark / Sepia) */}
            <TouchableOpacity onPress={cycleTheme} style={styles.topIconBtn}>
              <Ionicons
                name={theme === 'dark' ? 'moon' : theme === 'sepia' ? 'color-wand' : 'sunny'}
                size={22}
                color={theme === 'dark' ? '#FBBF24' : theme === 'sepia' ? '#8A5A2B' : '#2563EB'}
              />
            </TouchableOpacity>

            {/* Bookmarks List Modal Trigger */}
            <TouchableOpacity
              onPress={() => {
                loadBookmarks();
                setBookmarksModalVisible(true);
              }}
              style={styles.topIconBtn}
            >
              <Ionicons name="list" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SEARCH BAR OVERLAY */}
      {isSearchVisible && (
        <View style={[styles.searchBar, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: themeColors.text, backgroundColor: themeColors.background }]}
            placeholder="Search text in document..."
            placeholderTextColor={themeColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.searchActionBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleSearch}
          >
            <Ionicons name="search" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          {searchMatches !== null && (
            <Text style={[styles.searchCountText, { color: themeColors.textSecondary }]}>
              {searchMatches} found
            </Text>
          )}
        </View>
      )}

      {/* PDF WEBVIEW CONTAINER */}
      <View style={styles.webViewWrapper}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          onMessage={handleWebViewMessage}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
        />
      </View>

      {/* TEXT TO SPEECH CONTROLLER BAR */}
      <TTSPlayer
        visible={isTTSVisible}
        text={pageText}
        currentPage={currentPage}
        onClose={() => setIsTTSVisible(false)}
        theme={theme}
        onRequestNextPageText={() => {
          if (currentPage < totalPages) {
            sendWebViewMessage('nextPage');
            setTimeout(() => sendWebViewMessage('extractText'), 500);
          }
        }}
      />

      {/* BOTTOM NAVIGATION BAR */}
      {controlsVisible && (
        <View style={[styles.bottomBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          {/* Previous Page */}
          <TouchableOpacity
            style={[styles.pageNavBtn, currentPage <= 1 && styles.btnDisabled]}
            disabled={currentPage <= 1}
            onPress={() => sendWebViewMessage('prevPage')}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={currentPage <= 1 ? themeColors.textMuted : themeColors.text}
            />
          </TouchableOpacity>

          {/* Page Counter (Click to Jump) */}
          <TouchableOpacity
            style={[styles.pageIndicator, { backgroundColor: themeColors.primaryLight }]}
            onPress={() => setJumpModalVisible(true)}
          >
            <Text style={[styles.pageIndicatorText, { color: themeColors.primary }]}>
              {currentPage} / {totalPages}
            </Text>
          </TouchableOpacity>

          {/* Next Page */}
          <TouchableOpacity
            style={[styles.pageNavBtn, currentPage >= totalPages && styles.btnDisabled]}
            disabled={currentPage >= totalPages}
            onPress={() => sendWebViewMessage('nextPage')}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={currentPage >= totalPages ? themeColors.textMuted : themeColors.text}
            />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          {/* Zoom Out */}
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => sendWebViewMessage('zoomOut')}
          >
            <Ionicons name="remove-circle-outline" size={22} color={themeColors.text} />
          </TouchableOpacity>

          {/* Zoom Reset */}
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => sendWebViewMessage('resetZoom')}
          >
            <Ionicons name="scan-outline" size={20} color={themeColors.text} />
          </TouchableOpacity>

          {/* Zoom In */}
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => sendWebViewMessage('zoomIn')}
          >
            <Ionicons name="add-circle-outline" size={22} color={themeColors.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* JUMP TO PAGE MODAL */}
      <JumpToPageModal
        visible={jumpModalVisible}
        currentPage={currentPage}
        totalPages={totalPages}
        theme={theme}
        onClose={() => setJumpModalVisible(false)}
        onJump={(page) => sendWebViewMessage('goToPage', { page })}
      />

      {/* BOOKMARKS LIST MODAL */}
      <BookmarksModal
        visible={bookmarksModalVisible}
        bookmarks={bookmarksList}
        theme={theme}
        onClose={() => setBookmarksModalVisible(false)}
        onSelectBookmark={(page) => sendWebViewMessage('goToPage', { page })}
        onDeleteBookmark={async (id) => {
          await StorageService.removeBookmark(id);
          loadBookmarks();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 13,
    marginTop: 6,
    maxWidth: 240,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  backBtnLarge: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnLargeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  topIconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  searchActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  webViewWrapper: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  pageNavBtn: {
    padding: 8,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.3,
  },
  pageIndicator: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 4,
  },
  zoomBtn: {
    padding: 8,
    borderRadius: 8,
  },
});
