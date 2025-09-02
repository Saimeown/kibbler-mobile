import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  Platform,
  ActionSheetIOS,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ref, onValue, set, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { useRouter } from 'expo-router';

const SettingsScreen = () => {
  const [fontsLoaded] = useFonts({
    Poppins: require('../../assets/fonts/Poppins/Poppins-Light.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  const [portionLevel, setPortionLevel] = useState('100');
  const [feedingInterval, setFeedingInterval] = useState('2');
  const [autoWakeEnabled, setAutoWakeEnabled] = useState(true);
  const [autoWakeHours, setAutoWakeHours] = useState('4');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Modal states for iOS pickers
  const [showPortionPicker, setShowPortionPicker] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  const [showWakePicker, setShowWakePicker] = useState(false);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Online/offline tracking based on battery data changes
  const [lastBatteryUpdate, setLastBatteryUpdate] = useState<number>(Date.now());
  const [isDeviceOnline, setIsDeviceOnline] = useState(true);
  const [previousBatteryLevel, setPreviousBatteryLevel] = useState<number | null>(null);
  
  // Configuration for offline detection (in milliseconds)
  const OFFLINE_TIMEOUT = 120000; // 2 minutes - adjust as needed

  const router = useRouter();

  // Picker options
  const portionOptions = [
    { label: '25%', value: '25' },
    { label: '50%', value: '50' },
    { label: '75%', value: '75' },
    { label: '100%', value: '100' },
  ];

  const intervalOptions = [
    { label: '1 hour', value: '1' },
    { label: '2 hours', value: '2' },
    { label: '4 hours', value: '4' },
    { label: '6 hours', value: '6' },
    { label: '8 hours', value: '8' },
    { label: '12 hours', value: '12' },
    { label: '24 hours', value: '24' },
  ];

  const wakeOptions = [
    { label: '1 hour', value: '1' },
    { label: '2 hours', value: '2' },
    { label: '4 hours', value: '4' },
    { label: '6 hours', value: '6' },
    { label: '8 hours', value: '8' },
    { label: '12 hours', value: '12' },
  ];

  // iOS picker handlers
  const showPortionActionSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...portionOptions.map(option => option.label)],
          cancelButtonIndex: 0,
          title: 'Select Portion Size',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setPortionLevel(portionOptions[buttonIndex - 1].value);
          }
        }
      );
    } else {
      setShowPortionPicker(true);
    }
  };

  const showIntervalActionSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...intervalOptions.map(option => option.label)],
          cancelButtonIndex: 0,
          title: 'Select Feeding Interval',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setFeedingInterval(intervalOptions[buttonIndex - 1].value);
          }
        }
      );
    } else {
      setShowIntervalPicker(true);
    }
  };

  const showWakeActionSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...wakeOptions.map(option => option.label)],
          cancelButtonIndex: 0,
          title: 'Select Wake Time',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setAutoWakeHours(wakeOptions[buttonIndex - 1].value);
          }
        }
      );
    } else {
      setShowWakePicker(true);
    }
  };

  const getLabelForValue = (options: typeof portionOptions, value: string) => {
    const option = options.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  useEffect(() => {
    const deviceRef = ref(database, '/devices/kibbler_001/sleep_settings');
    onValue(deviceRef, (snapshot) => {
      if (!snapshot.exists()) {
        set(deviceRef, { auto_wake_enabled: true, auto_wake_hours: 4 });
      }
    }, { onlyOnce: true });

    loadCurrentSettings();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Monitor device online status based on battery data updates
  useEffect(() => {
    const checkOnlineStatus = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastBatteryUpdate;
      const isOnline = timeSinceLastUpdate < OFFLINE_TIMEOUT;
      
      console.log('Settings - Online status check:', {
        timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000) + 's',
        isOnline,
        threshold: OFFLINE_TIMEOUT / 1000 + 's'
      });
      
      setIsDeviceOnline(isOnline);
    };

    // Check immediately and then every 10 seconds
    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 10000);

    return () => clearInterval(interval);
  }, [lastBatteryUpdate, OFFLINE_TIMEOUT]);

  // Separate listener for battery level changes to track real-time updates
  useEffect(() => {
    const batteryRef = ref(database, '/devices/kibbler_001/device_status/battery_level');
    
    const unsubscribeBattery = onValue(batteryRef, (snapshot) => {
      const batteryLevel = snapshot.val();
      if (batteryLevel !== null && batteryLevel !== undefined) {
        const now = Date.now();
        
        // Only update if battery level actually changed
        if (previousBatteryLevel !== null && batteryLevel !== previousBatteryLevel) {
          console.log('Settings - Battery level changed:', {
            previous: previousBatteryLevel,
            current: batteryLevel,
            timestamp: new Date(now).toLocaleTimeString()
          });
          setLastBatteryUpdate(now);
        }
        
        setPreviousBatteryLevel(batteryLevel);
      }
    }, (error) => {
      console.error('Settings - Battery listener error:', error);
    });

    return () => unsubscribeBattery();
  }, [previousBatteryLevel]);

  const loadCurrentSettings = () => {
    const dbRef = ref(database, '/devices/kibbler_001');
    onValue(
      dbRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPortionLevel((data.portion_level || 100).toString());
          setFeedingInterval((data.feeding_interval_hours || 2).toString());
          const sleepSettings = data.sleep_settings || {};
          setAutoWakeEnabled(sleepSettings.auto_wake_enabled !== undefined ? sleepSettings.auto_wake_enabled : true);
          setAutoWakeHours((sleepSettings.auto_wake_hours || 4).toString());
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading settings:', error);
        setToast({ message: 'Failed to load settings', type: 'error' });
        setPortionLevel('100');
        setFeedingInterval('2');
        setAutoWakeEnabled(true);
        setAutoWakeHours('4');
        setLoading(false);
      },
      { onlyOnce: true }
    );
  };

  const saveDeviceSettings = () => {
    setIsSavingSettings(true);
    const dbRef = ref(database, '/devices/kibbler_001');
    const updates = {
      portion_level: parseInt(portionLevel),
      feeding_interval_hours: parseInt(feedingInterval),
      'sleep_settings/auto_wake_enabled': autoWakeEnabled,
      'sleep_settings/auto_wake_hours': parseInt(autoWakeHours),
    };

    update(dbRef, updates)
      .then(() => {
        setToast({ message: 'Settings saved successfully', type: 'success' });
      })
      .catch((error) => {
        console.error('Error saving settings:', error);
        setToast({ message: `Failed to save settings: ${error.message}`, type: 'error' });
      })
      .finally(() => {
        setIsSavingSettings(false);
      });
  };

  const sendSleepCommand = () => {
    const dbRef = ref(database, '/devices/kibbler_001/sleep_settings/user_request_sleep');
    set(dbRef, true)
      .then(() => {
        setToast({ message: 'Sleep command sent to device', type: 'success' });
      })
      .catch((error) => {
        console.error('Error sending sleep command:', error);
        setToast({ message: 'Failed to send sleep command', type: 'error' });
      });
  };

  const updatePasscode = () => {
    setPasscodeError({ current: false, new: false, confirm: false });

    if (!currentPasscode || !newPasscode || !confirmPasscode) {
      setPasscodeError({
        current: !currentPasscode,
        new: !newPasscode,
        confirm: !confirmPasscode,
      });
      setToast({ message: 'Please fill in all fields', type: 'error' });
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setPasscodeError({ current: false, new: true, confirm: true });
      setToast({ message: 'New passcodes do not match', type: 'error' });
      return;
    }

    if (newPasscode.length < 6) {
      setPasscodeError({ current: false, new: true, confirm: true });
      setToast({ message: 'Passcode must be at least 6 characters', type: 'error' });
      return;
    }

    setIsSavingPasscode(true);
    const userRef = ref(database, 'users/current_user');

    onValue(
      userRef,
      (snapshot) => {
        const userData = snapshot.val();
        if (!userData) {
          setToast({ message: 'User account not found', type: 'error' });
          setIsSavingPasscode(false);
          return;
        }

        if (userData.passcode !== currentPasscode) {
          setPasscodeError({ current: true, new: false, confirm: false });
          setToast({ message: 'Current passcode is incorrect', type: 'error' });
          setIsSavingPasscode(false);
          return;
        }

        update(userRef, { passcode: newPasscode })
          .then(() => {
            setToast({ message: 'Passcode updated successfully', type: 'success' });
            setCurrentPasscode('');
            setNewPasscode('');
            setConfirmPasscode('');
          })
          .catch((error) => {
            console.error('Error updating passcode:', error);
            setToast({ message: `Failed to update passcode: ${error.message}`, type: 'error' });
          })
          .finally(() => {
            setIsSavingPasscode(false);
          });
      },
      (error) => {
        console.error('Error fetching user data:', error);
        setToast({ message: 'Failed to verify passcode', type: 'error' });
        setIsSavingPasscode(false);
      },
      { onlyOnce: true }
    );
  };

  const handleLogout = () => {
    set(ref(database, 'users/current_user/isLoggedIn'), false)
      .then(() => {
        setToast({ message: 'Logged out successfully', type: 'success' });
        router.replace('/login');
      })
      .catch((error) => {
        console.error('Logout error:', error);
        setToast({ message: `Logout failed: ${error.message}`, type: 'error' });
      });
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dd2c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.contentContainer}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                 Settings
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Settings</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Portion Size</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity style={styles.pickerButton} onPress={showPortionActionSheet}>
                  <Text style={styles.pickerButtonText}>
                    {getLabelForValue(portionOptions, portionLevel)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={portionLevel}
                    onValueChange={(value) => setPortionLevel(value)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {portionOptions.map((option) => (
                      <Picker.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Feeding Interval</Text>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity style={styles.pickerButton} onPress={showIntervalActionSheet}>
                  <Text style={styles.pickerButtonText}>
                    {getLabelForValue(intervalOptions, feedingInterval)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={feedingInterval}
                    onValueChange={(value) => setFeedingInterval(value)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {intervalOptions.map((option) => (
                      <Picker.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Device Sleep</Text>
              <TouchableOpacity
                style={[styles.sleepButton, !isDeviceOnline && styles.disabledButton]}
                onPress={isDeviceOnline ? sendSleepCommand : undefined}
                disabled={!isDeviceOnline}
                accessibilityLabel={isDeviceOnline ? "Put device to sleep" : "Device offline - sleep unavailable"}
              >
                <Ionicons name="moon" size={16} color={isDeviceOnline ? "#fff" : "#666"} />
                <Text style={[styles.sleepButtonText, !isDeviceOnline && styles.disabledButtonText]}>
                  {isDeviceOnline ? "Sleep Now" : "Device Offline"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.sleepNote}>
                {isDeviceOnline 
                  ? "Put your Kibbler to sleep to conserve battery."
                  : "Device must be online to send sleep command."
                }
              </Text>
            </View>
            <View style={styles.formGroup}>
              <View style={styles.toggleContainer}>
                <Text style={styles.label}>Automatically wake up</Text>
                <Switch
                  value={autoWakeEnabled}
                  onValueChange={(value) => setAutoWakeEnabled(value)}
                  trackColor={{ false: '#767577', true: '#ff9100' }}
                  thumbColor={autoWakeEnabled ? '#fff' : '#f4f3f4'}
                  accessibilityLabel="Toggle auto wake"
                />
              </View>
              {autoWakeEnabled && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Wake after</Text>
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity style={styles.pickerButton} onPress={showWakeActionSheet}>
                      <Text style={styles.pickerButtonText}>
                        {getLabelForValue(wakeOptions, autoWakeHours)}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={autoWakeHours}
                        onValueChange={(value) => setAutoWakeHours(value)}
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                      >
                        {wakeOptions.map((option) => (
                          <Picker.Item key={option.value} label={option.label} value={option.value} />
                        ))}
                      </Picker>
                    </View>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.saveButton, isSavingSettings && styles.saveButtonDisabled]}
              onPress={saveDeviceSettings}
              disabled={isSavingSettings}
              accessibilityLabel="Save device settings"
            >
              <Text style={styles.saveButtonText}>
                {isSavingSettings ? 'Saving...' : 'Save All'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Passcode</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Current Passcode</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={16} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, passcodeError.current && styles.inputError]}
                  value={currentPasscode}
                  onChangeText={setCurrentPasscode}
                  secureTextEntry
                  placeholder="Enter current passcode"
                  placeholderTextColor="#a0a0a0"
                  accessibilityLabel="Current passcode input"
                />
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Passcode (min 6 characters)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={16} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, passcodeError.new && styles.inputError]}
                  value={newPasscode}
                  onChangeText={setNewPasscode}
                  secureTextEntry
                  placeholder="Enter new passcode"
                  placeholderTextColor="#a0a0a0"
                  accessibilityLabel="New passcode input"
                />
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Passcode</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={16} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, passcodeError.confirm && styles.inputError]}
                  value={confirmPasscode}
                  onChangeText={setConfirmPasscode}
                  secureTextEntry
                  placeholder="Confirm new passcode"
                  placeholderTextColor="#a0a0a0"
                  accessibilityLabel="Confirm passcode input"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.saveButton, isSavingPasscode && styles.saveButtonDisabled]}
              onPress={updatePasscode}
              disabled={isSavingPasscode}
              accessibilityLabel="Save new passcode"
            >

              <Text style={styles.saveButtonText}>{isSavingPasscode ? 'Updating...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              accessibilityLabel="Logout"
            >
              <Ionicons name="log-out" size={16} color="#ff9100" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {toast && (
          <View
            style={[
              styles.toastContainer,
              toast.type === 'success'
                ? styles.toastSuccess
                : toast.type === 'error'
                ? styles.toastError
                : styles.toastInfo,
            ]}
          >
            <Ionicons
              name={
                toast.type === 'success'
                  ? 'checkmark-circle'
                  : toast.type === 'error'
                  ? 'alert-circle'
                  : 'information-circle'
              }
              size={16}
              color="#fff"
            />
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}

        {/* Android Modal Pickers */}
        <Modal visible={showPortionPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Portion Size</Text>
                <TouchableOpacity onPress={() => setShowPortionPicker(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={portionLevel}
                onValueChange={(value) => {
                  setPortionLevel(value);
                  setShowPortionPicker(false);
                }}
                style={styles.modalPicker}
              >
                {portionOptions.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>
          </View>
        </Modal>

        <Modal visible={showIntervalPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Feeding Interval</Text>
                <TouchableOpacity onPress={() => setShowIntervalPicker(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={feedingInterval}
                onValueChange={(value) => {
                  setFeedingInterval(value);
                  setShowIntervalPicker(false);
                }}
                style={styles.modalPicker}
              >
                {intervalOptions.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>
          </View>
        </Modal>

        <Modal visible={showWakePicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Wake Time</Text>
                <TouchableOpacity onPress={() => setShowWakePicker(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={autoWakeHours}
                onValueChange={(value) => {
                  setAutoWakeHours(value);
                  setShowWakePicker(false);
                }}
                style={styles.modalPicker}
              >
                {wakeOptions.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>
          </View>
        </Modal>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: StatusBar.currentHeight || 50,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 25,
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginBottom: 5,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    fontFamily: 'Poppins',
  },
  pickerItem: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#fff',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pickerButtonText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    flex: 1,
  },
  sleepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 50,
    paddingHorizontal: 25,
    paddingVertical: 10,
    width: '100%',
  },
  sleepButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#666',
  },
  sleepNote: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginTop: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    paddingVertical: 10,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  inputError: {
    borderColor: '#ff4747',
    borderWidth: 1,
    borderRadius: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c27006ff',
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center',
    marginBottom: 10
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  spinner: {
    transform: [{ rotate: '360deg' }],
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'center'
  },
  logoutButtonText: {
    color: '#ff9100',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginLeft: 10,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  toastSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  toastError: {
    backgroundColor: 'rgba(255, 71, 71, 0.9)',
  },
  toastInfo: {
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
  },
  toastText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
  },
  modalPicker: {
    color: '#fff',
    fontFamily: 'Poppins',
  },
});

export default SettingsScreen;