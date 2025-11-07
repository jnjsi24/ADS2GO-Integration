import { Tabs } from "expo-router";
import { StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            height: 65 + Math.max(insets.bottom, 0),
          }
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarActiveTintColor: '#3674B5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      <Tabs.Screen 
        name="dashboard" 
        options={{ 
          title: "Dashboard",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "grid" : "grid-outline"} 
              size={size} 
              color={color} 
            />
          )
        }} 
      />
      <Tabs.Screen 
        name="route" 
        options={{ 
          title: "Route",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "map" : "map-outline"} 
              size={size} 
              color={color} 
            />
          )
        }} 
      />
      
      <Tabs.Screen 
        name="notifications" 
        options={{ 
          title: "Notifications",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "notifications" : "notifications-outline"} 
              size={size} 
              color={color} 
            />
          )
        }} 
      />
      
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={size} 
              color={color} 
            />
          )
        }} 
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    height: 65,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  tabBarIcon: {
    marginBottom: 2,
  },
});