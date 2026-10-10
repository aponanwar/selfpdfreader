import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { StorageService } from '../services/storage';
import { ConverterService } from '../services/converter';
import FileCard from '../components/FileCard';

export default function HomeScreen({ onOpenFile, currentTheme, onToggleTheme }) {
  const [activeTab, setActiveTab] = useState('recent'); // 'recent' | 'favorites' | 'bookmarks'
  const [files, setFiles] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Conversion loading state
  const [converting, setConverting] = useState(false);
  const [convertStatus, setConvertStatus] = useState('');

  const themeColors = colors[currentTheme] || colors.light;

  const loadData = async () => {
    try {
      const recentList = await StorageService.getRecentFiles();
      const bookmarksList = await StorageService.getBookmarks();
      setFiles(recentList);
      setBookmarks(bookmarksList);
    } catch (e) {
      console.error('Error loading home data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 1. Open Standard PDF
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileData = {
          name: asset.name || 'Selected Document.pdf',
          uri: asset.uri,
          size: asset.size || 0,
          lastPage: 1,
          totalPages: 1,
        };

        await StorageService.addOrUpdateRecentFile(fileData);
        await loadData();
        onOpenFile(fileData);
      }
    } catch (err) {
      console.error('Document picker error:', err);
      Alert.alert('Error', 'Could not open document picker.');
    }
  };

  // 2. Import Images and Convert to PDF
  const handlePickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to convert images to PDF.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 20,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setConverting(true);
        setConvertStatus(`Converting ${result.assets.length} image(s) to PDF...`);

        const newPdf = await ConverterService.convertImagesToPDF(
          result.assets,
          'Image_Document'
        );

        await StorageService.addOrUpdateRecentFile(newPdf);
        await loadData();
        setConverting(false);

        Alert.alert(
          'Conversion Complete! 🎉',
          `Created "${newPdf.name}". Opening in reader now.`,
          [{ text: 'Open PDF', onPress: () => onOpenFile(newPdf) }]
        );
      }
    } catch (err) {
      console.error('Image to PDF error:', err);
      setConverting(false);
      Alert.alert('Conversion Failed', 'Could not convert images to PDF: ' + err.message);
    }
  };

  // 3. Import Doc / Text file and Convert to PDF
  const handlePickDoc = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'text/plain', // .txt
          'text/markdown', // .md
          'text/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileNameLower = (asset.name || '').toLowerCase();

        // If it's already a PDF, open directly
        if (fileNameLower.endsWith('.pdf')) {
          const fileData = {
            name: asset.name,
            uri: asset.uri,
            size: asset.size || 0,
            lastPage: 1,
            totalPages: 1,
          };
          await StorageService.addOrUpdateRecentFile(fileData);
          await loadData();
          onOpenFile(fileData);
          return;
        }

        setConverting(true);
        setConvertStatus(`Converting "${asset.name}" to PDF...`);

        const newPdf = await ConverterService.convertDocToPDF(asset);

        await StorageService.addOrUpdateRecentFile(newPdf);
        await loadData();
        setConverting(false);

        Alert.alert(
          'Document Converted! 📄',
          `Converted "${asset.name}" to PDF. Opening in reader now.`,
          [{ text: 'Open PDF', onPress: () => onOpenFile(newPdf) }]
        );
      }
    } catch (err) {
      console.error('Doc to PDF error:', err);
      setConverting(false);
      Alert.alert('Conversion Failed', 'Could not convert document: ' + err.message);
    }
  };

  // Favorite toggle
  const handleToggleFavorite = async (uri) => {
    const updated = await StorageService.toggleFavorite(uri);
    setFiles(updated);
  };

  // Share File
  const handleShare = async (item) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'Sharing is not supported on this device.');
        return;
      }
      await Sharing.shareAsync(item.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${item.name}`,
      });
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Share Failed', 'Unable to share file.');
    }
  };

  // Delete File
  const handleDelete = (uri) => {
    Alert.alert(
      'Remove from Recent',
      'Do you want to remove this document from the recent list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = await StorageService.removeRecentFile(uri);
            setFiles(updated);
          },
        },
      ]
    );
  };

  // Clear all recent files
  const handleClearAll = () => {
    Alert.alert(
      'Clear All Recent',
      'Are you sure you want to clear your recent reading history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearRecentFiles();
            setFiles([]);
          },
        },
      ]
    );
  };

  // Filter items by search query
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'favorites') {
      return matchesSearch && f.isFavorite;
    }
    return matchesSearch;
  });

  const filteredBookmarks = bookmarks.filter((b) =>
    (b.fileName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.note || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.card}
      />

      {/* CONVERTING MODAL OVERLAY */}
      <Modal visible={converting} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: themeColors.overlay }]}>
          <View style={[styles.modalBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.modalStatusText, { color: themeColors.text }]}>{convertStatus}</Text>
            <Text style={[styles.modalSubText, { color: themeColors.textSecondary }]}>
              Please wait while generating your PDF...
            </Text>
          </View>
        </View>
      </Modal>

      {/* APP HEADER */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logoIcon, { backgroundColor: themeColors.primaryLight }]}>
            <Ionicons name="book" size={20} color={themeColors.primary} />
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: themeColors.text }]}>Self PDF Reader</Text>
            <Text style={[styles.brandSubtitle, { color: themeColors.textSecondary }]}>Your Personal Library</Text>
          </View>
        </View>

        {/* Theme Toggle Button */}
        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: themeColors.borderLight }]}
          onPress={onToggleTheme}
        >
          <Ionicons
            name={currentTheme === 'dark' ? 'sunny' : 'moon'}
            size={18}
            color={currentTheme === 'dark' ? '#FBBF24' : '#64748B'}
          />
        </TouchableOpacity>
      </View>

      {/* ACTION TOOLS BAR (OPEN PDF / IMAGES TO PDF / DOC TO PDF) */}
      <View style={styles.actionToolsContainer}>
        {/* Open PDF */}
        <TouchableOpacity
          style={[styles.actionTile, { backgroundColor: themeColors.primary }]}
          onPress={handlePickDocument}
          activeOpacity={0.8}
        >
          <Ionicons name="folder-open" size={20} color="#FFFFFF" />
          <Text style={styles.actionTileText}>Open PDF</Text>
        </TouchableOpacity>

        {/* Images to PDF */}
        <TouchableOpacity
          style={[styles.actionTile, { backgroundColor: '#059669' }]}
          onPress={handlePickImages}
          activeOpacity={0.8}
        >
          <Ionicons name="images" size={20} color="#FFFFFF" />
          <Text style={styles.actionTileText}>Image to PDF</Text>
        </TouchableOpacity>

        {/* Doc to PDF */}
        <TouchableOpacity
          style={[styles.actionTile, { backgroundColor: '#D97706' }]}
          onPress={handlePickDoc}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text" size={20} color="#FFFFFF" />
          <Text style={styles.actionTileText}>Doc to PDF</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH INPUT */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Ionicons name="search" size={18} color={themeColors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search documents or bookmarks..."
            placeholderTextColor={themeColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={themeColors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* NAVIGATION TABS */}
      <View style={[styles.tabsRow, { borderBottomColor: themeColors.borderLight }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'recent' && [styles.activeTab, { borderBottomColor: themeColors.primary }],
          ]}
          onPress={() => setActiveTab('recent')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'recent' ? themeColors.primary : themeColors.textSecondary },
            ]}
          >
            Recent ({files.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'favorites' && [styles.activeTab, { borderBottomColor: themeColors.primary }],
          ]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'favorites' ? themeColors.primary : themeColors.textSecondary },
            ]}
          >
            Favorites ({files.filter((f) => f.isFavorite).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'bookmarks' && [styles.activeTab, { borderBottomColor: themeColors.primary }],
          ]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'bookmarks' ? themeColors.primary : themeColors.textSecondary },
            ]}
          >
            Bookmarks ({bookmarks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* CLEAR ALL ACTION HEADER (IF APPLICABLE) */}
      {activeTab === 'recent' && files.length > 0 && (
        <View style={styles.subHeaderRow}>
          <Text style={[styles.subHeaderText, { color: themeColors.textSecondary }]}>
            Reading History
          </Text>
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.clearAllText, { color: themeColors.danger }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONTENT LIST */}
      {activeTab === 'bookmarks' ? (
        <FlatList
          data={filteredBookmarks}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.bookmarkCard,
                { backgroundColor: themeColors.card, borderColor: themeColors.border },
              ]}
              onPress={() => {
                onOpenFile({
                  uri: item.fileUri,
                  name: item.fileName,
                  lastPage: item.page,
                });
              }}
            >
              <View style={styles.bookmarkCardLeft}>
                <View style={[styles.bookmarkBadge, { backgroundColor: themeColors.primaryLight }]}>
                  <Text style={[styles.bookmarkBadgeText, { color: themeColors.primary }]}>
                    Page {item.page}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookmarkFileName, { color: themeColors.text }]} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={[styles.bookmarkDateText, { color: themeColors.textSecondary }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmarks-outline" size={54} color={themeColors.textMuted} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Bookmarks Found</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                Bookmark pages inside the reader to easily return here.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.uri}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <FileCard
              item={item}
              theme={currentTheme}
              onPress={onOpenFile}
              onToggleFavorite={handleToggleFavorite}
              onShare={handleShare}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'favorites' ? 'star-outline' : 'document-text-outline'}
                size={54}
                color={themeColors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
                {activeTab === 'favorites' ? 'No Favorites Yet' : 'No Recent Documents'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
                {activeTab === 'favorites'
                  ? 'Star your favorite books and files to view them here.'
                  : 'Open a PDF file, convert images, or import a doc to begin reading!'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalStatusText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  modalSubText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionToolsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  actionTile: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },
  actionTileText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  subHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  bookmarkCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  bookmarkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  bookmarkBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bookmarkFileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  bookmarkDateText: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
