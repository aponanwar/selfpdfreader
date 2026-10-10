import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';

export default function JumpToPageModal({
  visible,
  onClose,
  currentPage,
  totalPages,
  onJump,
  theme = 'light',
}) {
  const [pageInput, setPageInput] = useState(currentPage ? currentPage.toString() : '1');
  const themeColors = colors[theme] || colors.light;

  const handleJump = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onJump(pageNum);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: themeColors.overlay }]}
      >
        <View style={[styles.dialog, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>Jump to Page</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Enter page number (1 - {totalPages || 1})
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                {
                  color: themeColors.text,
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.border,
                },
              ]}
              keyboardType="number-pad"
              value={pageInput}
              onChangeText={setPageInput}
              autoFocus
              selectTextOnFocus
              maxLength={6}
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: themeColors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.jumpBtn, { backgroundColor: themeColors.primary }]}
              onPress={handleJump}
            >
              <Text style={styles.jumpBtnText}>Go to Page</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 18,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  jumpBtn: {},
  jumpBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
