import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function TTSPlayer({
  visible,
  text,
  currentPage,
  onClose,
  theme = 'light',
  onRequestNextPageText,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const themeColors = colors[theme] || colors.light;

  useEffect(() => {
    // When text changes or player opens, start reading
    if (visible && text && text.trim().length > 0) {
      startSpeaking(text);
    }
    return () => {
      Speech.stop();
    };
  }, [text, visible]);

  const startSpeaking = async (content) => {
    Speech.stop();
    setIsPlaying(true);
    setIsPaused(false);

    Speech.speak(content, {
      rate: speechRate,
      pitch: 1.0,
      onDone: () => {
        setIsPlaying(false);
        setIsPaused(false);
        // Optionally request next page reading
        if (onRequestNextPageText) {
          onRequestNextPageText();
        }
      },
      onStopped: () => {
        setIsPlaying(false);
        setIsPaused(false);
      },
      onError: (e) => {
        console.error('Speech error:', e);
        setIsPlaying(false);
        setIsPaused(false);
      },
    });
  };

  const handlePause = async () => {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleResume = async () => {
    if (isPaused) {
      await Speech.resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else if (text) {
      startSpeaking(text);
    }
  };

  const handleStop = async () => {
    await Speech.stop();
    setIsPlaying(false);
    setIsPaused(false);
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5];
    const currentIndex = speeds.indexOf(speechRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setSpeechRate(nextSpeed);
    if (isPlaying && text) {
      startSpeaking(text);
    }
  };

  if (!visible) return null;

  const hasText = text && text.trim().length > 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.card,
          borderColor: themeColors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.statusIndicator}>
          <Ionicons
            name={isPlaying ? 'volume-high' : 'volume-mute'}
            size={18}
            color={isPlaying ? themeColors.primary : themeColors.textMuted}
          />
          <Text style={[styles.statusText, { color: themeColors.text }]}>
            {hasText
              ? isPlaying
                ? `Reading Page ${currentPage}`
                : isPaused
                ? `Paused on Page ${currentPage}`
                : `Ready (Page ${currentPage})`
              : 'Extracting text...'}
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>
        {/* Speed toggle */}
        <TouchableOpacity
          style={[styles.speedBtn, { backgroundColor: themeColors.borderLight }]}
          onPress={cycleSpeed}
        >
          <Text style={[styles.speedBtnText, { color: themeColors.text }]}>
            {speechRate}x
          </Text>
        </TouchableOpacity>

        {/* Play / Pause buttons */}
        <View style={styles.playbackButtons}>
          <TouchableOpacity
            style={[styles.iconButton, { borderColor: themeColors.border }]}
            onPress={handleStop}
          >
            <Ionicons name="stop" size={18} color={themeColors.text} />
          </TouchableOpacity>

          {!isPlaying ? (
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: themeColors.primary }]}
              onPress={isPaused ? handleResume : () => startSpeaking(text)}
              disabled={!hasText}
            >
              <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: themeColors.primary }]}
              onPress={handlePause}
            >
              <Ionicons name="pause" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Text character info */}
        <Text style={[styles.charCount, { color: themeColors.textMuted }]}>
          {hasText ? `${text.trim().length} chars` : 'No text'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 76,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playbackButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  charCount: {
    fontSize: 11,
  },
});
