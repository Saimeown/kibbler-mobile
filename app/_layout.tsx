import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../config/firebase';

const RootLayout = () => {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const userRef = ref(database, 'users/current_user');
    get(userRef).then((snapshot) => {
      const userData = snapshot.val();
      const isInTabs = segments[0] === '(tabs)';
      if (userData?.isLoggedIn && !isInTabs) {
        router.replace('/(tabs)');
      } else if (!userData?.isLoggedIn && isInTabs) {
        router.replace('/login');
      }
    }).catch((error) => {
      console.error('Error checking login state:', error);
    });
  }, [router, segments]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
};

export default RootLayout;