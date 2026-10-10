import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function BookmarksModal({
  visible,
  onClose,
  bookmarks = [],
  onSelectBookmark,
  onDeleteBookmark,
  theme = 'light',
}) {
  const themeColors = colors[theme] || colors.light;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.bookmarkItem,
        {
          backgroundColor: themeColors.card,
          borderColor: themeColors.border,
        },
      ]}
      onPress={() => {
        onSelectBookmark(item.page);
        onClose();
      }}
    >
      <View style={styles.leftContainer}>
        <View style={[styles.pageBadge, { backgroundColor: themeColors.primaryLight }]}>
          <Text style={[styles.pageBadgeText, { color: themeColors.primary }]}>
            P. {item.page}
          </Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.bookmarkTitle, { color: themeColors.text }]} numberOfLines={1}>
            {item.note || `Bookmark on Page ${item.page}`}
          </Text>
          <Text style={[styles.bookmarkDate, { color: themeColors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDeleteBookmark(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: themeColors.overlay }]}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="bookmarks" size={20} color={themeColors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>Bookmarks</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {bookmarks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color={themeColors.textMuted} />
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                No bookmarks added yet.
              </Text>
              <Text style={[styles.emptySubtext, { color: themeColors.textMuted }]}>
                Tap the bookmark icon at the top to save important pages!
              </Text>
            </View>
          ) : (
            <FlatList
              data={bookmarks}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  pageBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  bookmarkTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookmarkDate: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
});
