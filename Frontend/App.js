import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Dashboard from './src/screens/Dashboard';
import AddMember from './src/screens/AddMember';
import History from './src/screens/History';
import MemberList from './src/screens/MemberList';
// History screen aap khud Web wale logic se AllReports.js convert kar lena

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="AddMember" component={AddMember} />
        <Stack.Screen name="History" component={History} />
        <Stack.Screen name="MemberList" component={MemberList} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}