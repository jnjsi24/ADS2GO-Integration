// src/screens/MainScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import VideoPlayer from '../components/VideoPlayer';
import QRCodeOverlay from '../components/QRCodeOverlay';

const MainScreen = () => {
  const videoSource = require('../../assets/sample.mp4'); // Make sure this file exists

  const handleVideoEnd = () => {
    console.log('Video playback finished');
  };

  return (
    <View style={styles.container}>
      <VideoPlayer source={videoSource} onEnd={handleVideoEnd} />
      <QRCodeOverlay data="https://ads2go.example.com" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});

export default MainScreen;
