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
      // Wait for auth state to be ready
      if (state.isLoading) return;
      
      // If not authenticated, redirect to login
      if (!state.token) {
        router.replace('/auth/login');
        return;
      }
      
      // User is authenticated - check if photos are due
      try {
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        const token = await AsyncStorage.getItem('token');
        if (!driverInfo || !token) {
          router.replace('/auth/login');
          return;
        }
        
        const driver = JSON.parse(driverInfo);
        const driverId = driver.driverId || driver.id;
        
        // Fetch materials to check photo due dates
        const res: any = await request(API_CONFIG.API_URL, GET_DRIVER_MATERIALS_WITH_PHOTOS, { driverId }, { Authorization: `Bearer ${token}` });
        const mats = res?.getDriverMaterials?.materials || [];
        
        const today = new Date();
        // Normalize today to midnight in local timezone for accurate date comparison
        // This ensures that at 12:00 AM on Nov 8, it will be treated as Nov 8 00:00:00
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const currentMonth = today.toISOString().slice(0,7); // YYYY-MM
        
        console.log('🔍 Checking photo due dates at app launch:', {
          currentTime: today.toISOString(),
          todayStart: todayStart.toISOString(),
          materialsCount: mats.length
        });
        
        // Helper function to normalize date to midnight local time, handling UTC ISO strings
        const normalizeToLocalMidnight = (date: Date): Date => {
          // Extract date components in local timezone (handles UTC dates correctly)
          const year = date.getFullYear();
          const month = date.getMonth();
          const day = date.getDate();
          // Create new date at midnight in local timezone
          return new Date(year, month, day, 0, 0, 0, 0);
        };
        
        // Check if any material has photos due today or later
        // ✅ IMPORTANT: Only check materials that have nextPhotoDue (which means they have a device in slot 1 or 2)
        // Monthly compliance only applies to materials with devices registered
        const anyDue = mats.some((m: any) => {
          const dueStr = m?.materialTracking?.nextPhotoDue;
          
          // If nextPhotoDue is null/undefined, material has no device - skip it
          // Monthly compliance only applies when material is mounted AND has device in slot 1 or slot 2
          if (!dueStr) {
            console.log(`⏭️ Material ${m.materialId}: Skipping (no nextPhotoDue - no device registered)`);
            return false;
          }
          
          let due: Date | null = null;
          if (dueStr) {
            const d = new Date(dueStr);
            if (!isNaN(d.getTime())) due = d;
          }
          
          // Don't derive from mountedAt anymore - if nextPhotoDue is not set by server,
          // it means material has no device, so monthly compliance doesn't apply
          if (!due) return false;
          
          // Normalize due date to midnight in local timezone for accurate comparison
          // This correctly handles UTC dates from server by extracting local date components
          const dueStart = normalizeToLocalMidnight(due);
          const hasCurrent = Array.isArray(m?.materialTracking?.monthlyPhotos) && 
                             m.materialTracking.monthlyPhotos.some((p: any) => p.month === currentMonth);
          
          // Use timestamp comparison: allow upload if today is due date or later
          // At 12:00 AM on Nov 8, todayStart will be Nov 8 00:00:00 local
          // If dueStart is Nov 8 00:00:00 local, then isDue will be true (>= comparison)
          // This works correctly regardless of timezone because we normalize both to local midnight
          const isDue = todayStart.getTime() >= dueStart.getTime();
          
          console.log('📸 Material check:', {
            materialId: m.id,
            dueDate: due.toISOString(),
            dueStart: dueStart.toISOString(),
            todayStart: todayStart.toISOString(),
            isDue,
            hasCurrentPhoto: hasCurrent,
            needsPhoto: isDue && !hasCurrent
          });
          
          return isDue && !hasCurrent;
        });
        
        // Redirect based on photo due status
        if (anyDue) {
          console.log('✅ Photos are due - redirecting to photo submission page');
          router.replace('/photo-submission');
        } else {
          console.log('ℹ️ No photos due - redirecting to dashboard');
          router.replace('/tabs/dashboard');
        }
      } catch (e) {
        console.error('❌ Error checking photo due dates:', e);
        // On error, default to dashboard (don't block user from using app)
        router.replace('/tabs/dashboard');
      } finally {
        setCheckingDue(false);
      }
    })();
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
