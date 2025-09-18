import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';

interface SharedBackgroundProps {
  children: React.ReactNode;
}

const SharedBackground: React.FC<SharedBackgroundProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {children}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
});

export default SharedBackground;