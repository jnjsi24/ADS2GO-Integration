// src/components/QRCodeOverlay.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  data: string;
}

const QRCodeOverlay: React.FC<Props> = ({ data }) => {
  return (
    <View style={styles.qrContainer}>
      <QRCode value={data} size={100} />
    </View>
  );
};

const styles = StyleSheet.create({
  qrContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
  },
});

export default QRCodeOverlay;
