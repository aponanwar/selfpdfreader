import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function FileCard({
  item,
  onPress,
  onToggleFavorite,
  onShare,
  onDelete,
  theme = 'light',
}) {
  const themeColors = colors[theme] || colors.light;

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'PDF Document';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const progressPercent = item.totalPages && item.totalPages > 0
    ? Math.min(100, Math.round(((item.lastPage || 1) / item.totalPages) * 100))
    : 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.card,
          borderColor: themeColors.border,
        },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        {/* PDF Red Badge Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="document-text" size={28} color="#EF4444" />
          <View style={styles.pdfTag}>
            <Text style={styles.pdfTagText}>PDF</Text>
          </View>
        </View>

        {/* Title & Metadata */}
        <View style={styles.infoContainer}>
          <Text
            style={[styles.title, { color: themeColors.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {item.name || 'Untitled Document'}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
              {formatFileSize(item.size)}
            </Text>
            {item.lastOpened && (
              <>
                <Text style={[styles.bullet, { color: themeColors.textMuted }]}>•</Text>
                <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                  {formatTimeAgo(item.lastOpened)}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Favorite toggle */}
        <TouchableOpacity
          onPress={() => onToggleFavorite(item.uri)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.starBtn}
        >
          <Ionicons
            name={item.isFavorite ? 'star' : 'star-outline'}
            size={20}
            color={item.isFavorite ? '#F59E0B' : themeColors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Reading Progress Indicator */}
      {item.totalPages > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
              Page {item.lastPage || 1} of {item.totalPages}
            </Text>
            <Text style={[styles.progressPercentage, { color: themeColors.primary }]}>
              {progressPercent}%
            </Text>
          </View>

          <View style={[styles.progressBarTrack, { backgroundColor: themeColors.borderLight }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: themeColors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Card Actions Bottom */}
      <View style={[styles.footerRow, { borderTopColor: themeColors.borderLight }]}>
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => onShare(item)}
        >
          <Ionicons name="share-outline" size={16} color={themeColors.textSecondary} />
          <Text style={[styles.footerBtnText, { color: themeColors.textSecondary }]}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => onDelete(item.uri)}
        >
          <Ionicons name="trash-outline" size={16} color={themeColors.danger} />
          <Text style={[styles.footerBtnText, { color: themeColors.danger }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 12,
  },
  pdfTag: {
    position: 'absolute',
    bottom: -3,
    backgroundColor: '#DC2626',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  pdfTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  infoContainer: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
  bullet: {
    marginHorizontal: 5,
    fontSize: 12,
  },
  starBtn: {
    padding: 4,
  },
  progressSection: {
    marginTop: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
