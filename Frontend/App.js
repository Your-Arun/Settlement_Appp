import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context'; // 👈 IMPORT THIS
import { StatusBar } from 'expo-status-bar'; // 👈 IMPORT THIS

import Dashboard from './src/screens/Dashboard';
import AddMember from './src/screens/AddMember';
import History from './src/screens/History';
import MemberList from './src/screens/MemberList';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    // ✅ 1. Wrap whole app in SafeAreaProvider
    <SafeAreaProvider>
      
      {/* ✅ 2. Handle Status Bar (Time/Battery icons) 
          style="dark" matlab icons black honge (light background ke liye best)
          translucent={true} android me transparent look dega
      */}
      <StatusBar style="dark" backgroundColor="transparent" translucent={true} />

      <NavigationContainer>
        <Stack.Navigator 
          screenOptions={{ 
            headerShown: false,
            // ✅ Animation fix for smooth transitions
            animation: 'slide_from_right' 
          }}
        >
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="AddMember" component={AddMember} />
          <Stack.Screen name="History" component={History} />
          <Stack.Screen name="MemberList" component={MemberList} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}