//homepage

import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "expo-router";

export default function Home() {
  const navigation = useNavigation();

  const handleLogout = () => {
    // @ts-ignore
    navigation.navigate('(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Ads2Go Dashboard 🚀</Text>
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  title: { 
    fontSize: 20, 
    fontWeight: "600",
    marginBottom: 20 
  },
  logoutButton: {
    marginTop: 15,
    padding: 10,
  },
  logoutButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
});
