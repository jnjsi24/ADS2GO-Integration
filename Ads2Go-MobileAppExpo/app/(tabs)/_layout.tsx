import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="dashboard" options={{ title: "Analytics" }} />
      <Tabs.Screen name="index" options={{ title: "Materials" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
    </Tabs>
  );
}
