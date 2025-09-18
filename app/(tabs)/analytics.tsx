import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  TextInput
} from 'react-native';
import { useFonts } from 'expo-font';
import { LineChart } from 'react-native-chart-kit';
import { FontAwesome5 } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';
import { database } from '../../config/firebase';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';
import SharedBackground from '../../components/SharedBackground';
import { useDeviceOnlineStatus } from '../../hooks/useDeviceOnlineStatus';

declare global {
  interface Date {
    getWeekNumber(): number;
  }
}

interface Feeding {
  date?: string;
  timestamp?: string;
  uid?: string;
  pet_name?: string;
}

interface DeviceData {
  feeding_history?: { [key: string]: Feeding };
  history?: { daily?: any };
  pet_registry?: { [key: string]: string };
  device_status?: {
    battery_level?: number;
  };
}

interface AnalyticsData {
  visits_per_pet_per_day: { [date: string]: { [uid: string]: { count: number; name: string } } };
  visits_per_pet_per_week: { [uid: string]: { count: number; name: string } };
  peak_hours: number[];
  last_visit_times: { [uid: string]: { name: string; time: string; timestamp: number } };
  new_tags_this_week: { [uid: string]: { name: string; first_seen: string } };
  most_frequent_visitor: { name: string; count: number } | null;
  most_inactive_pet: { name: string; hours: number } | null;
  visit_rate_change: number;
  unique_pets: { [uid: string]: string };
  feeding_history: { [key: string]: Feeding };
  daily_history: any;
  device_status: { battery_level?: number; status?: string } | null;
  error?: string;
}

const AnalyticsScreen = () => {
  const [fontsLoaded] = useFonts({
    'Poppins': require('../../assets/fonts/Poppins/Poppins-Light.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubtab, setActiveSubtab] = useState('Feeding Patterns');
  const [contentOffsets, setContentOffsets] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [petSearchTerm, setPetSearchTerm] = useState('');
  
  // Use shared online status hook
  const { isDeviceOnline, batteryLevel } = useDeviceOnlineStatus();
  const scrollViewRef = useRef<ScrollView>(null);
  const isManualScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation for sliding indicator
  const indicatorPosition = useSharedValue(0);
  const indicatorWidth = useSharedValue(80);
  const scrollX = useSharedValue(0);
  const subtabScrollViewRef = useRef<ScrollView>(null);
  const tabs = ['Feeding Patterns', 'Historical Data', 'Overview', 'Pet Insights'];
  const [tabLayouts, setTabLayouts] = useState<{ [key: string]: { x: number; width: number } }>({});
  
  const slidingIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorPosition.value - scrollX.value }],
      width: indicatorWidth.value,
    };
  });
  
  const handleTabLayout = (tabName: string, event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => ({
      ...prev,
      [tabName]: { x: x + 2, width: width } // Minimal offset for perfect centering
    }));
  };
  
  const handleScroll = (event: any) => {
    scrollX.value = event.nativeEvent.contentOffset.x;
  };
  
  useEffect(() => {
    if (tabLayouts[activeSubtab] && !isManualScrollRef.current) {
      const layout = tabLayouts[activeSubtab];
      
      // Always animate the indicator immediately
      indicatorPosition.value = withTiming(layout.x, { duration: 300 });
      indicatorWidth.value = withTiming(layout.width, { duration: 300 });
      
      // Auto-scroll to make the active tab visible (separate from indicator animation)
      if (subtabScrollViewRef.current) {
        const screenWidth = 350; // Approximate visible width
        const tabCenter = layout.x + layout.width / 2;
        const currentScroll = scrollX.value;
        
        if (tabCenter < currentScroll + 50 || tabCenter > currentScroll + screenWidth - 50) {
          const targetScroll = Math.max(0, tabCenter - screenWidth / 2);
          subtabScrollViewRef.current.scrollTo({
            x: targetScroll,
            animated: true
          });
        }
      }
    }
  }, [activeSubtab, tabLayouts]);

  useEffect(() => {
    const dbRef = ref(database, '/devices/kibbler_001');

    const unsubscribe = onValue(dbRef, (snapshot) => {
      const firebaseData = snapshot.val();
      if (firebaseData) {
        const processedData = processAnalyticsData(firebaseData);
        setData(processedData);
      } else {
        setData({ error: 'Could not load analytics data' } as AnalyticsData);
      }
      setLoading(false);
    }, (error) => {
      console.error('Firebase error:', error);
      setData({ error: 'Could not load analytics data' } as AnalyticsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processAnalyticsData = (deviceData: DeviceData): AnalyticsData => {
    const feedingHistory = deviceData.feeding_history || {};
    const dailyHistory = deviceData.history?.daily || {};
    const petRegistry = deviceData.pet_registry || {};

    const uniquePets: { [uid: string]: string } = {};
    
    // First, add pets from pet_registry (all detected pets)
    Object.entries(petRegistry).forEach(([uid, name]) => {
      uniquePets[uid] = name as string;
    });
    
    // Then, add/update pets from feedingHistory (this captures all pets with feeding activity)
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (feeding.uid) {
        const uid = feeding.uid.toString();
        const petName = petRegistry[uid] || feeding.pet_name || 'Unknown';
        
        // Add this pet even if not in registry (same logic as pets.tsx)
        uniquePets[uid] = petName;
      }
    });

    const visitsPerPetPerDay: { [date: string]: { [uid: string]: { count: number; name: string } } } = {};
    const today = new Date().toISOString().split('T')[0];
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.date || !feeding.uid) return;

      const date = feeding.date;
      const petId = feeding.uid;

      if (!visitsPerPetPerDay[date]) {
        visitsPerPetPerDay[date] = {};
      }

      if (!visitsPerPetPerDay[date][petId]) {
        visitsPerPetPerDay[date][petId] = {
          count: 0,
          name: feeding.pet_name || 'Unknown'
        };
      }

      visitsPerPetPerDay[date][petId].count++;
    });

    const visitsPerPetPerWeek: { [uid: string]: { count: number; name: string } } = {};
    const currentWeek = new Date().getWeekNumber();
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp || !feeding.uid) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      const weekNumber = new Date(timestamp * 1000).getWeekNumber();
      const petId = feeding.uid;

      if (weekNumber !== currentWeek) return;

      if (!visitsPerPetPerWeek[petId]) {
        visitsPerPetPerWeek[petId] = {
          count: 0,
          name: feeding.pet_name || 'Unknown'
        };
      }

      visitsPerPetPerWeek[petId].count++;
    });

    const hourlyCounts = Array(24).fill(0);
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp) return;

      const hour = new Date(feeding.timestamp).getUTCHours();
      hourlyCounts[hour]++;
    });
    const peakHours = hourlyCounts.reduce((acc: number[], count, index) => {
      if (count === Math.max(...hourlyCounts)) acc.push(index);
      return acc;
    }, []);

    const lastVisitTimes: { [uid: string]: { name: string; time: string; timestamp: number } } = {};
    Object.entries(uniquePets).forEach(([uid, name]) => {
      lastVisitTimes[uid] = { name, time: 'Never', timestamp: 0 };
    });

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.uid || !feeding.timestamp) return;

      const uid = feeding.uid;
      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp > lastVisitTimes[uid].timestamp) {
        lastVisitTimes[uid].time = new Date(timestamp * 1000).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        lastVisitTimes[uid].timestamp = timestamp;
      }
    });

    const newTagsThisWeek: { [uid: string]: { name: string; first_seen: string } } = {};
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTimestamp = weekStart.getTime() / 1000;
    const allTimeTags: { [uid: string]: boolean } = {};

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp || !feeding.uid) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp < weekStartTimestamp) {
        allTimeTags[feeding.uid] = true;
      }
    });

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp || !feeding.uid) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp >= weekStartTimestamp && !allTimeTags[feeding.uid]) {
        if (!newTagsThisWeek[feeding.uid]) {
          newTagsThisWeek[feeding.uid] = {
            name: feeding.pet_name || 'Unknown',
            first_seen: new Date(timestamp * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric' })
          };
        }
      }
    });

    const visitCounts = Object.entries(uniquePets).map(([uid, name]) => ({
      name,
      count: 0,
      uid
    }));

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.uid) return;
      const visitor = visitCounts.find(v => v.uid === feeding.uid);
      if (visitor) visitor.count++;
    });

    const mostFrequentVisitor = visitCounts.sort((a, b) => b.count - a.count)[0] || null;

    const currentTime = Date.now() / 1000;
    const inactivePets = Object.entries(lastVisitTimes).map(([uid, data]) => ({
      name: data.name,
      hours: Math.round((currentTime - data.timestamp) / 3600)
    }));

    const mostInactivePet = inactivePets.sort((a, b) => b.hours - a.hours)[0] || null;

    let currentWeekCount = 0;
    let lastWeekCount = 0;
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp >= weekStartTimestamp) {
        currentWeekCount++;
      } else if (timestamp >= lastWeekStart.getTime() / 1000 && timestamp < weekStartTimestamp) {
        lastWeekCount++;
      }
    });

    const visitRateChange = lastWeekCount > 0 ? Math.round((currentWeekCount - lastWeekCount) / lastWeekCount * 100) : 0;

    return {
      visits_per_pet_per_day: visitsPerPetPerDay,
      visits_per_pet_per_week: visitsPerPetPerWeek,
      peak_hours: peakHours,
      last_visit_times: lastVisitTimes,
      new_tags_this_week: newTagsThisWeek,
      most_frequent_visitor: mostFrequentVisitor,
      most_inactive_pet: mostInactivePet,
      visit_rate_change: visitRateChange,
      unique_pets: uniquePets,
      feeding_history: feedingHistory,
      daily_history: dailyHistory,
      device_status: { 
        ...deviceData.device_status, 
        battery_level: batteryLevel,
        status: isDeviceOnline ? 'online' : 'offline' // Use our tracked online status
      }
    };
  };

  Date.prototype.getWeekNumber = function (): number {
    const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getBatteryIcon = (level?: number) => {
    if (!level) return 'battery-empty';
    if (level >= 80) return 'battery-full';
    if (level >= 60) return 'battery-three-quarters';
    if (level >= 40) return 'battery-half';
    if (level >= 20) return 'battery-quarter';
    return 'battery-empty';
  };

  const ranges = {
    '12AM - 6AM': [0, 6],
    '6AM - 12PM': [6, 12],
    '12PM - 6PM': [12, 18],
    '6PM - 12AM': [18, 24]
  };

  const rangeCounts: { [key: string]: number } = Object.keys(ranges).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  let totalFeedings = 0;

  Object.values(data?.feeding_history || {}).forEach((feeding: Feeding) => {
    if (!feeding.timestamp) return;
    try {
      const hour = new Date(feeding.timestamp).getUTCHours();
      totalFeedings++;
      for (const [label, hours] of Object.entries(ranges)) {
        if (hour >= hours[0] && hour < hours[1]) {
          rangeCounts[label]++;
          break;
        }
      }
    } catch (e) {
      console.error('Error processing feeding time:', e);
    }
  });

  const hourlyData = Array(24).fill(0);
  Object.values(data?.feeding_history || {}).forEach((feeding: Feeding) => {
    if (feeding.timestamp) {
      const hour = new Date(feeding.timestamp).getUTCHours();
      hourlyData[hour]++;
    }
  });

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const handleTabPress = (tabName: string) => {
    setActiveSubtab(tabName);
    isManualScrollRef.current = true;

    // Immediately update the indicator position for the new tab
    if (tabLayouts[tabName]) {
      const layout = tabLayouts[tabName];
      indicatorPosition.value = withTiming(layout.x, { duration: 300 });
      indicatorWidth.value = withTiming(layout.width, { duration: 300 });
      
      // Auto-scroll if needed
      if (subtabScrollViewRef.current) {
        const screenWidth = 350;
        const tabCenter = layout.x + layout.width / 2;
        const currentScroll = scrollX.value;
        
        if (tabCenter < currentScroll + 50 || tabCenter > currentScroll + screenWidth - 50) {
          const targetScroll = Math.max(0, tabCenter - screenWidth / 2);
          subtabScrollViewRef.current.scrollTo({
            x: targetScroll,
            animated: true
          });
        }
      }
    }

    if (contentOffsets[tabName] !== undefined) {
      scrollViewRef.current?.scrollTo({
        y: contentOffsets[tabName],
        animated: true
      });
    }

    // Reset the manual scroll flag after animation completes
    setTimeout(() => {
      isManualScrollRef.current = false;
    }, 1000);
  };

  const handleLayout = (tabName: string) => (event: any) => {
    const { y } = event.nativeEvent.layout;
    setContentOffsets(prev => ({
      ...prev,
      [tabName]: y - 100
    }));
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dd2c00" />
      </View>
    );
  }

  if (data?.error) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-triangle" size={24} color="#ff6b6b" />
        <Text style={styles.errorText}>{data.error}</Text>
      </View>
    );
  }

  return (
    <SharedBackground>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.contentContainer}>
          <View style={styles.headerContent}>
            <View style={styles.logoSection}>
              <View style={styles.dashboardTitleRow}>
                <Text style={styles.headerText}>Analytics</Text>
                <Image 
                  source={require('../../assets/Paw-Logo.png')} 
                  style={styles.headerIcon}
                />
              </View>
              <View style={styles.taglineBox}>
                <FontAwesome5 name="paw" size={12} color="#fff" style={styles.pawHeader} />
                <Text style={styles.taglineText}> Detailed feeding insights and patterns</Text>
              </View>
              <View style={styles.headerData}>
                  <View style={[styles.statusBadge, data?.device_status?.status === 'online' ? styles.connected : styles.disconnected]}>
                    <View style={[
                      styles.statusDot,
                      data?.device_status?.status === 'online' ? styles.connectedDot : styles.disconnectedDot
                    ]} />
                    <Text style={styles.statusText}>
                      {data?.device_status?.status
                        ? data.device_status.status.charAt(0).toUpperCase() + data.device_status.status.slice(1)
                        : 'Unknown'}
                    </Text>
                  </View>
                  <View style={styles.batteryIndicator}>
                    <FontAwesome5 name={getBatteryIcon(batteryLevel)} size={16} color="#ff9100" style={styles.batteryIcon} />
                    <Text style={styles.batteryText}>{batteryLevel ?? '--'}%</Text>
                  </View>
                </View>
            </View>
          </View>

          <View style={styles.subtabsOuterContainer}>
            <View style={styles.subtabsWrapper}>
              <Animated.View style={[styles.slidingIndicator, slidingIndicatorStyle]} />
              
              <ScrollView
                ref={subtabScrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subtabsScrollContainer}
                style={styles.subtabsScrollView}
                indicatorStyle="white"
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {tabs.map((tab, index) => (
                  <TouchableOpacity
                    key={tab}
                    style={styles.subtab}
                    onPress={() => handleTabPress(tab)}
                    onLayout={(event) => handleTabLayout(tab, event)}
                  >
                    <Text style={styles.subtabText}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.headerLine} />

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            indicatorStyle="white"
            showsVerticalScrollIndicator={true}
            scrollIndicatorInsets={{ right: 1 }}
            onScroll={(event) => {
              // Don't update activeSubtab if user just manually tapped a subtab
              if (isManualScrollRef.current) return;
              
              // Capture scroll values immediately to avoid synthetic event issues
              const scrollY = event.nativeEvent.contentOffset.y;
              const offsets = Object.entries(contentOffsets);
              
              // Clear any existing timeout
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              
              // Debounce the scroll detection using captured values
              scrollTimeoutRef.current = setTimeout(() => {
                for (let i = offsets.length - 1; i >= 0; i--) {
                  const [tabName, offset] = offsets[i];
                  if (scrollY >= offset - 100) {
                    if (tabName !== activeSubtab) {
                      setActiveSubtab(tabName);
                    }
                    break;
                  }
                }
              }, 100); // 100ms debounce
            }}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <View onLayout={handleLayout('Feeding Patterns')}>

              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>
                    Peak Feeding Hours
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  indicatorStyle="white"
                  style={styles.chartScrollContainer}
                >
                  <View style={styles.chartContainer}>
                    <LineChart
                      data={{
                        labels: Array.from({ length: 24 }, (_, i) => {
                          const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
                          const period = i < 12 ? 'AM' : 'PM';
                          return `${hour}${period}`;
                        }),
                        datasets: [{ data: hourlyData }]
                      }}
                      width={Dimensions.get('window').width * 3}
                      height={220}
                      chartConfig={{
                        backgroundGradientFromOpacity: 0,
                        backgroundGradientToOpacity: 0,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(255, 145, 0, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: {
                          borderRadius: 16,
                        },
                        propsForDots: {
                          r: "6",
                          strokeWidth: "2",
                          stroke: "#ff9100"
                        }
                      }}
                      bezier
                      style={{
                        marginVertical: 8,
                        borderRadius: 16,
                        paddingRight: 20
                      }}
                      withVerticalLabels={true}
                      withHorizontalLabels={true}
                      yAxisLabel=""
                      yAxisSuffix=""
                      fromZero={true}
                    />
                  </View>
                </ScrollView>

                <View style={styles.timeRangesGrid}>
                  <View style={styles.timeRangeRow}>
                    <View style={styles.timeRangeItem}>
                      <View style={styles.timeRangeHeader}>
                        <Text style={styles.timeRangeLabel}>12AM - 6AM</Text>
                      </View>
                      <View style={styles.timeRangeValueContainer}>
                        <Text style={styles.timeRangeCount}>{rangeCounts['12AM - 6AM']}</Text>
                        <Text style={styles.timeRangePercentage}>
                          {totalFeedings > 0 ? Math.round((rangeCounts['12AM - 6AM'] / totalFeedings) * 100) : 0}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.timeRangeItem}>
                      <View style={styles.timeRangeHeader}>
                        <Text style={styles.timeRangeLabel}>6AM - 12PM</Text>
                      </View>
                      <View style={styles.timeRangeValueContainer}>
                        <Text style={styles.timeRangeCount}>{rangeCounts['6AM - 12PM']}</Text>
                        <Text style={styles.timeRangePercentage}>
                          {totalFeedings > 0 ? Math.round((rangeCounts['6AM - 12PM'] / totalFeedings) * 100) : 0}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.timeRangeRow}>
                    <View style={styles.timeRangeItem}>
                      <View style={styles.timeRangeHeader}>
                        <Text style={styles.timeRangeLabel}>12PM - 6PM</Text>
                      </View>
                      <View style={styles.timeRangeValueContainer}>
                        <Text style={styles.timeRangeCount}>{rangeCounts['12PM - 6PM']}</Text>
                        <Text style={styles.timeRangePercentage}>
                          {totalFeedings > 0 ? Math.round((rangeCounts['12PM - 6PM'] / totalFeedings) * 100) : 0}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.timeRangeItem}>
                      <View style={styles.timeRangeHeader}>
                        <Text style={styles.timeRangeLabel}>6PM - 12AM</Text>
                      </View>
                      <View style={styles.timeRangeValueContainer}>
                        <Text style={styles.timeRangeCount}>{rangeCounts['6PM - 12AM']}</Text>
                        <Text style={styles.timeRangePercentage}>
                          {totalFeedings > 0 ? Math.round((rangeCounts['6PM - 12AM'] / totalFeedings) * 100) : 0}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>



                <Text style={styles.peakHoursFooter}>
                  <Text style={styles.bold}>Peak hour: </Text>
                  {data?.peak_hours.map(h => new Date(0, 0, 0, h).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })).join(', ')}
                </Text>
              </View>
            </View>

            <View onLayout={handleLayout('Historical Data')}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelTitleRow}>
                    <Text style={styles.panelTitle}>
                       Visits Past Week
                    </Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search pets..."
                      placeholderTextColor="#999"
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                    />
                  </View>
                </View>
                <Text style={styles.panelSubtitle}>7-day feeding counts per pet</Text>
                <ScrollView
                  style={styles.scrollableActivities}
                  nestedScrollEnabled={true}
                  horizontal={true}
                  indicatorStyle="white"
                >
                  <View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.stickyHeader, styles.petNameCell]}>Pet</Text>
                      <Text style={[styles.tableHeaderCell, styles.stickyHeader, styles.centeredCell]}>Total</Text>
                      {dates.map(date => (
                        <Text key={date} style={[styles.tableHeaderCell, styles.stickyHeader, styles.centeredCell]}>
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </Text>
                      ))}
                    </View>
                    <ScrollView
                      style={styles.verticalTableScroll}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      indicatorStyle="white"
                    >
                      {Object.entries(data?.unique_pets || {})
                        .filter(([uid, name]) => 
                          name.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(([uid, name]) => {
                          const total = dates.reduce((sum, date) => {
                            return sum + (data?.visits_per_pet_per_day[date]?.[uid]?.count || 0);
                          }, 0);
                          return { uid, name, total };
                        })
                        .sort((a, b) => b.total - a.total)
                        .map(({ uid, name, total }) => {
                        return (
                          <View key={uid} style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.petNameCell]}>{name}</Text>
                          <Text style={[styles.tableCell, styles.centeredCell, styles.bold]}>{total}</Text>
                          {dates.map(date => {
                            const count = data?.visits_per_pet_per_day[date]?.[uid]?.count || 0;
                            return (
                              <Text
                                key={date}
                                style={[styles.tableCell, styles.centeredCell, count > 0 ? styles.highlightCell : null]}
                              >
                                {count}
                              </Text>
                            );
                          })}
                        </View>
                      );
                    })}
                    </ScrollView>
                  </View>
                </ScrollView>
              </View>
            </View>

            <View onLayout={handleLayout('Overview')}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <FontAwesome5 name="calendar" style={[styles.statIcon, styles.yellow]} />
                    <FontAwesome5
                      name="chart-line"
                      style={[styles.statTrend, data?.visit_rate_change && data.visit_rate_change >= 0 ? styles.yellow : styles.yellow]}
                    />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Visit Rate Change</Text>
                    <Text style={styles.statValue}>{data?.visit_rate_change ? Math.abs(data.visit_rate_change) : 0}%</Text>
                    <Text style={[styles.statChange, data?.visit_rate_change && data.visit_rate_change >= 0 ? styles.yellow : styles.gold]}>
                      {data?.visit_rate_change && data.visit_rate_change >= 0 ? 'Up' : 'Down'} from last week
                    </Text>
                  </View>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <FontAwesome5 name="dog" style={[styles.statIcon, styles.yellow]} />
                    <FontAwesome5 name="crown" style={[styles.statTrend, styles.yellow]} />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Most Frequent Visitor</Text>
                    <Text style={styles.statValue}>{data?.most_frequent_visitor?.name || '--'}</Text>
                    <Text style={[styles.statChange, styles.gold]}>{data?.most_frequent_visitor?.count || 0} visits</Text>
                  </View>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <FontAwesome5 name="clock" style={[styles.statIcon, styles.yellow]} />
                    <FontAwesome5 name="bed" style={[styles.statTrend, styles.yellow]} />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Most Inactive Pet</Text>
                    <Text style={styles.statValue}>{data?.most_inactive_pet?.name || '--'}</Text>
                    <Text style={[styles.statChange, styles.negative]}>{data?.most_inactive_pet?.hours || 0}h inactive</Text>
                  </View>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <FontAwesome5 name="tag" style={[styles.statIcon, styles.yellow]} />
                    <FontAwesome5 name="plus" style={[styles.statTrend, styles.yellow]} />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>New Tags This Week</Text>
                    <Text style={styles.statValue}>{Object.keys(data?.new_tags_this_week || {}).length}</Text>
                    <Text style={[styles.statChange, styles.gold]}>New pets detected</Text>
                  </View>
                </View>
              </View>
            </View>

            <View onLayout={handleLayout('Pet Insights')}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelTitleRow}>
                    <Text style={styles.panelTitle}>
                       Last Seen
                    </Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search pets..."
                      placeholderTextColor="#999"
                      value={petSearchTerm}
                      onChangeText={setPetSearchTerm}
                    />
                  </View>
                </View>
                <Text style={styles.panelSubtitle}>Most Recent Visit Time per Pet</Text>
                <ScrollView
                  style={styles.scrollableActivities}
                  nestedScrollEnabled={true}
                  indicatorStyle="white"
                >
                  {Object.values(data?.last_visit_times || {})
                    .filter((pet) => 
                      pet.name.toLowerCase().includes(petSearchTerm.toLowerCase())
                    )
                    .sort((a, b) => {
                      // Sort by timestamp descending, but put "Never" at the end
                      if (a.time === 'Never' && b.time === 'Never') return 0;
                      if (a.time === 'Never') return 1;
                      if (b.time === 'Never') return -1;
                      return b.timestamp - a.timestamp;
                    })
                    .map((pet, index) => (
                    <View key={index} style={styles.lastSeenItem}>
                      <View style={[styles.activityIcon, styles.feedingIcon]}>
                        <FontAwesome5 name="paw" size={16} color="#fff" />
                      </View>
                      <View style={styles.lastSeenContent}>
                        <Text style={styles.activityMessage}>{pet.name}</Text>
                        <Text style={styles.lastSeenTime}>{pet.time}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ScrollView>
        </View>
    </SharedBackground>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorText: {
    color: '#ff6b6b',
    fontFamily: 'Poppins',
    fontSize: 16,
    marginTop: 10,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight || 40,
    height: 190
  },
  logoSection: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  dashboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20
  },
  headerIcon: {
    width: 30,
    height: 30,
    marginLeft: 10,
  },
  headerText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 25,
  },
  taglineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  pawHeader: {
    marginRight: 5,
  },
  taglineText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Light',
    fontSize: 14,
  },
  headerData: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
  },
  connected: {
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
  },
  disconnected: {
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 50,
    marginRight: 5,
  },
  connectedDot: {
    backgroundColor: '#00C853',
  },
  disconnectedDot: {
    backgroundColor: '#1a1a1aff',
  },
  statusText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 75,
    height: 30,
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
    borderRadius: 50
  },
  batteryIcon: {
    marginRight: 5,
  },
  batteryText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  subtabsOuterContainer: {
    height: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  subtabsWrapper: {
    position: 'relative',
    height: 50,
  },
  slidingIndicator: {
    position: 'absolute',
    top: 7.5,
    height: 35,
    backgroundColor: '#ff9100',
    borderRadius: 20,
    zIndex: 1,
  },
  subtabsScrollContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  subtabsScrollView: {
    height: 50,
    position: 'relative',
    zIndex: 2,
  },
  subtab: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    justifyContent: 'center',
    height: 35,
    marginHorizontal: 2,
    borderRadius: 20,
  },
  activeSubtab: {
    // backgroundColor removed - using sliding indicator instead
  },
  subtabText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  activeSubtabText: {
    color: '#000',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  headerLine: {
    height: 1,
    backgroundColor: 'rgba(77, 82, 89, 0.7)',
    width: '100%',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statIcon: {
    fontSize: 16,
  },
  statTrend: {
    fontSize: 16,
  },
  green: {
    color: '#4CAF50',
  },
  yellow: {
    color: '#FFC107',
  },
  gold: {
    color: '#ff9100',
  },
  blue: {
    color: '#2196F3',
  },
  purple: {
    color: '#9C27B0',
  },
  red: {
    color: '#FF4747',
  },
  statContent: {},
  statLabel: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    marginBottom: 5,
  },
  statValue: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 24,
    marginBottom: 5,
  },
  statChange: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#ff9100',
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 25,
    marginHorizontal: 15,
    marginBottom: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginLeft: 0,
  },
  panelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.83)',
    borderWidth: 1,
    borderRadius: 50,
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 150,
    maxWidth: 200,
    height: 35,
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 19,
  },
  panelSubtitle: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginBottom: 15,
  },
  controlMetrics: {
    marginBottom: 15,
  },
  controlMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  controlIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  controlInfo: {
    flex: 1,
  },
  controlLabel: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  controlValue: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginRight: 35,
  },
  chartScrollContainer: {
    width: '100%',
    marginBottom: 10,
  },
  peakHoursFooter: {
    color: '#d4d4d4ff',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginTop: 10,
  },
  bold: {
    fontFamily: 'Poppins-SemiBold',
  },
  scrollableActivities: {
    maxHeight: 300,
  },
  verticalTableScroll: {
    maxHeight: 250,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  lastSeenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  lastSeenContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 10,
  },
  lastSeenTime: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    textAlign: 'right',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  feedingIcon: {
    backgroundColor: '#dd2c00',
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginBottom: 3,
  },
  activityTime: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  scrollContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
    paddingHorizontal: 5,
  },
  stickyHeader: {
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableCell: {
    color: '#e8e8e8',
    fontFamily: 'Poppins',
    fontSize: 12,
    textAlign: 'center',
    width: 60,
    paddingHorizontal: 5,
  },
  centeredCell: {
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    textAlignVertical: 'center',
  },
  petNameCell: {
    textAlign: 'left',
    paddingLeft: 5,
    width: 100,
  },
  petColumnHeader: {
    backgroundColor: '#0d0d0d',
    textAlign: 'left',
    paddingLeft: 10,
  },
  totalColumnHeader: {
    backgroundColor: '#0d0d0d',
    textAlign: 'center',
  },
  petColumnCell: {
    backgroundColor: '#0d0d0d',
    textAlign: 'left',
    paddingLeft: 10,
  },
  totalColumnCell: {
    backgroundColor: '#0d0d0d',
    textAlign: 'center',
  },
  highlightCell: {
    backgroundColor: 'rgba(221, 44, 0, 0.2)',
  },
  timeRangesGrid: {
    marginBottom: 15,
  },
  timeRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeRangeItem: {
    width: '48%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeRangeHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  timeRangeLabel: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    textAlign: 'center',
  },
  timeRangeValue: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 16,
  },
  timeRangeValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  timeRangeCount: {
    color: '#ff9100',
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  timeRangePercentage: {
    color: '#bababaff',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
});

export default AnalyticsScreen;