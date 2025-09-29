import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  Easing,
  interpolateColor,
  runOnJS
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';


const AnimatedTabIcon = ({ focused, name, size, color }: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
}) => {
  const scale = useSharedValue(focused ? 1.1 : 1);
  const pulseOpacity = useSharedValue(0);
  const colorProgress = useSharedValue(focused ? 1 : 0);
  const [iconColor, setIconColor] = useState(focused ? '#ff9100' : '#cacacbff');

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.4, { duration: 150, easing: Easing.out(Easing.exp) }),
        withTiming(1.1, { duration: 150, easing: Easing.inOut(Easing.quad) })
      );
      
      pulseOpacity.value = withSequence(
        withTiming(0.8, { duration: 150, easing: Easing.out(Easing.exp) }),
        withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) })
      );
      
      colorProgress.value = withTiming(1, { 
        duration: 200, 
        easing: Easing.out(Easing.exp) 
      }, () => {
        runOnJS(setIconColor)('#ff9100');
      });
    } else {
      scale.value = withTiming(1, { 
        duration: 200, 
        easing: Easing.inOut(Easing.quad) 
      });
      
      pulseOpacity.value = withTiming(0, { 
        duration: 100, 
        easing: Easing.inOut(Easing.quad) 
      });
      
      colorProgress.value = withTiming(0, { 
        duration: 200, 
        easing: Easing.out(Easing.exp) 
      }, () => {
        runOnJS(setIconColor)('#cacacbff');
      });
    }
  }, [focused]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      zIndex: 10,
    };
  });

  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      width: size + 25,
      height: size + 25,
      borderRadius: (size + 25) / 2,
      backgroundColor: '#ff9100',
      opacity: pulseOpacity.value,
      transform: [{ scale: scale.value }],
      zIndex: 1,
    };
  });

  return (
    <View style={{ 
      justifyContent: 'center', 
      alignItems: 'center', 
      width: size + 30, 
      height: size + 30,
      position: 'relative'
    }}>
      <Animated.View style={animatedPulseStyle} />
      <Animated.View style={animatedIconStyle}>
        <Ionicons 
          name={name} 
          size={size} 
          color={iconColor}
        />
      </Animated.View>
    </View>
  );
};

const TabsLayout = () => {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ff9100',
        tabBarInactiveTintColor: '#cacacbff',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarShowLabel: false,
        tabBarIconStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: 'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
        focused={focused}
        name={focused ? 'home' : 'home-outline'}
        size={size}
        color=""
      />
          )
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          headerTitle: 'Analytics',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'analytics' : 'analytics-outline'}
              size={size}
              color=""
            />
          )
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          headerTitle: 'Pets',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'paw' : 'paw-outline'}
              size={size}
              color=""
            />
          )
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          headerTitle: 'Notifications',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'notifications' : 'notifications-outline'}
              size={size}
              color=""
            />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerTitle: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color=""
            />
          )
        }}
      />
    </Tabs>
  );
};

const styles = StyleSheet.create({
  tabBar: {
  backgroundColor: 'rgba(13, 13, 13, 1)',
    borderRadius: 50,
    marginHorizontal: 15,
    marginBottom: 25,
    height: 60,
    paddingBottom: 5,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TabsLayout;