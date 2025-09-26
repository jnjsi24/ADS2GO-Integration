import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="dashboard" options={{ title: "Analytics" }} />
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Materials",
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons name="cube-outline" size={size} color={color} />
              {/* Notification badge will be added dynamically based on photo needs */}
            </View>
          )
        }} 
      />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
    </Tabs>
  );
}
