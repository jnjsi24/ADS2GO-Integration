// src/components/VideoPlayer.tsx
import React from 'react';
import Video from 'react-native-video';
import { StyleSheet } from 'react-native';

interface Props {
  source: any;
  onEnd: () => void;
}

const VideoPlayer: React.FC<Props> = ({ source, onEnd }) => {
  return (
    <Video
      source={source}
      style={styles.video}
      resizeMode="cover"
      onEnd={onEnd}
      repeat
    />
  );
};

const styles = StyleSheet.create({
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});

export default VideoPlayer;
