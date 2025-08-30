import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { Video, ResizeMode } from "expo-av";
import QRCode from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HomeScreen() {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission denied");
        setLoading(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // Store analytics example
      await AsyncStorage.setItem("lastLocation", JSON.stringify(loc));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Android Player</Text>

      {/* Show location */}
      <Text style={styles.text}>
        GPS: {location?.coords.latitude}, {location?.coords.longitude}
      </Text>

      {/* Play video */}
      <Video
  source={{ uri: "https://www.w3schools.com/html/mov_bbb.mp4" }}
  style={{ width: 300, height: 200 }}
  useNativeControls
  resizeMode={ResizeMode.CONTAIN}
  shouldPlay
  isLooping
/>

      {/* Show QR Code */}
      <View style={{ marginTop: 20 }}>
        <QRCode value="https://ads2go.app" size={150} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    marginVertical: 10,
  },
});
