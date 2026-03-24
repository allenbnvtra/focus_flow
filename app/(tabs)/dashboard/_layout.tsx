import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import AdminDashboard from './AdminDashboard';

export default function DashboardLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FFFE',
      }}>
        <ActivityIndicator size="large" color="#2DD4BF" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/auth/login" />;
  if (user?.is_admin)   return <AdminDashboard />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}