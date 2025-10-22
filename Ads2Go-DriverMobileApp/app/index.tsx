import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, gql } from 'graphql-request';
import API_CONFIG from '../config/api';

export default function IndexScreen() {
  const { state } = useAuth();
  const router = useRouter();
  const [checkingDue, setCheckingDue] = useState(true);

  const GET_DRIVER_MATERIALS_WITH_PHOTOS = gql`
    query GetDriverMaterialsWithPhotos($driverId: ID!) {
      getDriverMaterials(driverId: $driverId) {
        success
        materials {
          id
          mountedAt
          materialTracking { nextPhotoDue monthlyPhotos { month } }
        }
      }
    }
  `;

  useEffect(() => {
    (async () => {
      if (state.isLoading) return;
      if (!state.token) {
        router.replace('/auth/login');
        return;
      }
      try {
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        const token = await AsyncStorage.getItem('token');
        if (!driverInfo || !token) {
          router.replace('/auth/login');
          return;
        }
        const driver = JSON.parse(driverInfo);
        const driverId = driver.driverId || driver.id;
        const res: any = await request(API_CONFIG.API_URL, GET_DRIVER_MATERIALS_WITH_PHOTOS, { driverId }, { Authorization: `Bearer ${token}` });
        const mats = res?.getDriverMaterials?.materials || [];
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const currentMonth = today.toISOString().slice(0,7); // YYYY-MM
        
        console.log('🔍 Checking photo compliance:', {
          currentMonth,
          materials: mats.map((m: any) => ({
            id: m.id,
            nextPhotoDue: m?.materialTracking?.nextPhotoDue,
            monthlyPhotos: m?.materialTracking?.monthlyPhotos
          }))
        });
        
        const anyDue = mats.some((m: any) => {
          const dueStr = m?.materialTracking?.nextPhotoDue;
          let due: Date | null = null;
          if (dueStr) {
            const d = new Date(dueStr);
            if (!isNaN(d.getTime())) due = d;
          } else if (m.mountedAt) {
            const mm = new Date(m.mountedAt);
            if (!isNaN(mm.getTime())) { mm.setMonth(mm.getMonth() + 1); due = mm; }
          }
          if (!due) return false;
          const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
          const hasCurrent = Array.isArray(m?.materialTracking?.monthlyPhotos) && m.materialTracking.monthlyPhotos.some((p: any) => p.month === currentMonth);
          
          console.log('📸 Material check:', {
            materialId: m.id,
            dueDate: due.toISOString(),
            todayStart: todayStart.toISOString(),
            isDue: todayStart >= dueStart,
            hasCurrentPhoto: hasCurrent,
            needsPhoto: todayStart >= dueStart && !hasCurrent
          });
          
          return todayStart >= dueStart && !hasCurrent;
        });
        if (anyDue) {
          router.replace('/photo-submission');
        } else {
          router.replace('/tabs/dashboard');
        }
      } catch (e) {
        router.replace('/tabs/dashboard');
      } finally {
        setCheckingDue(false);
      }
    })();
  }, [state.token, state.isLoading]);

  useEffect(() => {
    // Redirect based on authentication state
    if (!state.isLoading) {
      if (state.token) {
        // User is authenticated, go to dashboard
        router.replace('/tabs/dashboard');
      } else {
        // User is not authenticated, go to login
        router.replace('/auth/login');
      }
    }
  }, [state.token, state.isLoading]);

  // Show loading screen while determining auth state
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#ffffff'
    }}>
      <ActivityIndicator size="large" color="#3674B5" />
    </View>
  );
}
