import React, { useState, useEffect } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import { StorageService } from './src/services/storage';

export default function App() {
  const systemColorScheme = useColorScheme();
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' | 'reader'
  const [selectedFile, setSelectedFile] = useState(null);
  const [theme, setTheme] = useState(systemColorScheme === 'dark' ? 'dark' : 'light');

  // Load saved theme from storage
  useEffect(() => {
    async function initSettings() {
      const settings = await StorageService.getSettings();
      if (settings && settings.theme) {
        setTheme(settings.theme);
      }
    }
    initSettings();
  }, []);

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    await StorageService.updateSettings({ theme: nextTheme });
  };

  const handleOpenFile = (file) => {
    setSelectedFile(file);
    setCurrentScreen('reader');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedFile(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {currentScreen === 'reader' && selectedFile ? (
        <ReaderScreen
          file={selectedFile}
          onBack={handleBackToHome}
          initialTheme={theme}
        />
      ) : (
        <HomeScreen
          onOpenFile={handleOpenFile}
          currentTheme={theme}
          onToggleTheme={handleToggleTheme}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
