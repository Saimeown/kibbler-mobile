# Kibbler Mobile Update Plan
## Comprehensive Guide to Updating kibbler-mobile Based on kibbler-vanilla

---

## ✅ **ALREADY CORRECT IN MOBILE**
1. **Firebase Configuration** - Already using correct database:
   - `databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app"`
   - Firebase SDK version: 12.2.1 ✅

---

## 🔄 **CRITICAL UPDATES NEEDED**

### 1. **RFID Display Format** ⚠️ HIGH PRIORITY
**Web Change:** RFID tags now show **LAST 8 digits** instead of first 8
```php
// OLD (web had this):
substr($uid, 0, 8)

// NEW (web updated to):
substr($uid, -8)  // Last 8 digits
```

**Mobile Files to Update:**
- `app/(tabs)/pets.tsx` - Update UID display in pet cards
- Search for any UID display and change to show last 8 characters

---

### 2. **Color Scheme Update** ⚠️ HIGH PRIORITY
**Primary Color Changed:**
- OLD: `#dd2c00` (red), `#ff4011ff` (orange-red)
- **NEW: `#fbae3c`** (golden orange) - PRIMARY ACCENT COLOR

**Mobile Files to Update:**
- `app/(tabs)/index.tsx` - Update all color references
- `app/(tabs)/analytics.tsx` - Chart colors
- `app/(tabs)/pets.tsx` - Button colors, icons
- `app/(tabs)/notifications.tsx` - Icon colors
- `app/(tabs)/settings.tsx` - Accent colors
- Components that use the old red/orange colors

**Specific Color Updates:**
```tsx
// Replace these colors:
'#dd2c00' → '#fbae3c'
'#ff4011ff' → '#fbae3c'
'#ff9100' → '#fbae3c'  // Keep this one if it looks good, or change to #fbae3c
```

---

### 3. **Analytics Screen Updates** ⚠️ MEDIUM PRIORITY
**Web Changes:**
- Chart title: "Hourly Feeding Distribution" → **"Peak Feeding Hours"**
- Bar colors: Red gradient → **#fbae3c gradient**
- Chart styling improvements

**Mobile File:** `app/(tabs)/analytics.tsx`
- Update chart title text
- Update bar/line chart colors to #fbae3c
- Verify chart configuration matches web styling

---

### 4. **Device Settings & Feeding Intervals** ⚠️ MEDIUM PRIORITY
**Web Has:**
- Portion sizes: 25%, 50%, 75%, 100%
- Feeding intervals: 1, 2, 4, 6, 8, 12, 24 hours

**Mobile Status:** VERIFY these match in settings screen
**File:** `app/(tabs)/settings.tsx`

---

### 5. **Battery Display When Offline** ⚠️ MEDIUM PRIORITY
**Web Change:** Battery shows `"--"` when device is offline (not the actual value)

```javascript
// Web logic:
if (isOnline && deviceStatus.battery_level !== undefined) {
    batteryText.textContent = level + '%';
} else {
    batteryText.textContent = '--'; // Offline
}
```

**Mobile Files to Check:**
- `app/(tabs)/index.tsx` - Dashboard battery display
- `hooks/useDeviceOnlineStatus.ts` - Battery logic

**Current Mobile Code:**
```tsx
// From index.tsx line ~732:
<Text style={styles.batteryText}>{data?.device_status.battery_level}%</Text>
```

**Should be:**
```tsx
<Text style={styles.batteryText}>
  {isDeviceOnline && data?.device_status.battery_level !== undefined 
    ? `${data.device_status.battery_level}%` 
    : '--'}
</Text>
```

---

### 6. **Pet Registration/Management** ✅ LIKELY GOOD
Mobile seems to have comprehensive pet management. Verify:
- Pet names list matches web
- Registration flow works correctly
- Delete functionality works
- UID detection works

---

### 7. **Notification System** ⚠️ LOW-MEDIUM PRIORITY
**Web Has:**
- Notification filters: All, Alerts, Activities, Reminders
- Mark all as read functionality
- Notification types: alert, activity, reminder
- Unread badge counter

**Mobile File:** `app/(tabs)/notifications.tsx`
**Verify:**
- Notification types match web categories
- Filtering works
- Styling uses #fbae3c accent color
- Badge counter works

---

### 8. **Modal Behavior** ✅ NOT APPLICABLE
**Web Fix:** Only one modal can be open at a time (closeAllModals function)
**Mobile:** React Native modals work differently, likely not needed

---

### 9. **Error Handling** ⚠️ LOW PRIORITY
**Web Has:** Custom error page (`error.php`) with professional error handling
**Mobile:** Should have similar try-catch blocks and error states
**Consider:** Adding error boundaries and user-friendly error messages

---

## 📋 **UPDATE CHECKLIST BY FILE**

### `app/(tabs)/index.tsx` (Dashboard)
- [ ] Change all `#dd2c00`, `#ff4011ff` colors to `#fbae3c`
- [ ] Update battery display to show `"--"` when offline
- [ ] Verify chart colors use `#fbae3c`
- [ ] Check stat card colors
- [ ] Verify online/offline status indicator

### `app/(tabs)/analytics.tsx`
- [ ] Change chart title to "Peak Feeding Hours"
- [ ] Update all chart colors to `#fbae3c` gradient
- [ ] Change icon colors to `#fbae3c`
- [ ] Verify data fetching logic matches web

### `app/(tabs)/pets.tsx`
- [ ] **CRITICAL:** Change UID display to show LAST 8 digits (`.slice(-8)`)
- [ ] Update button colors to `#fbae3c`
- [ ] Update icon colors to `#fbae3c`
- [ ] Verify feeding interval options: 1, 2, 4, 6, 8, 12, 24 hours
- [ ] Check pet name picker styling

### `app/(tabs)/notifications.tsx`
- [ ] Update accent colors to `#fbae3c`
- [ ] Verify notification categories: alert, activity, reminder
- [ ] Check filter buttons styling
- [ ] Update icon colors

### `app/(tabs)/settings.tsx`
- [ ] Update accent colors to `#fbae3c`
- [ ] Verify portion sizes: 25%, 50%, 75%, 100%
- [ ] Verify feeding intervals match web
- [ ] Update button colors to `#fbae3c`
- [ ] Check passcode modal styling

### `components/SharedBackground.tsx`
- [ ] Verify background matches web aesthetic

### `hooks/useDeviceOnlineStatus.ts`
- [ ] Verify 120-second threshold for offline detection
- [ ] Check battery logic returns null/undefined when offline

---

## 🎨 **DESIGN CONSISTENCY**

### Color Palette (from web)
- **Primary Background:** `#141414` (dark)
- **Card Background:** `#1e1e1e` (slightly lighter dark)
- **Accent Color:** `#fbae3c` (golden orange) ← **PRIMARY CHANGE**
- **Text Primary:** `#ffffff` (white)
- **Text Secondary:** `#e8e8e8` (light gray)
- **Text Muted:** `#b8b8b8` (gray)
- **Online Status:** `#00C853` (green)
- **Offline Status:** `#1a1a1a` (dark)

### Typography (from web)
- **Font Family:** Inter (web) vs Poppins (mobile) - **KEEP POPPINS**
- **Font Weights:** Light, Regular, Medium, SemiBold, Bold

---

## 🔥 **HIGH PRIORITY UPDATES (Do These First)**

1. **Change all colors from red/orange to #fbae3c** (affects all screens)
2. **Fix RFID display to show last 8 digits** (pets.tsx)
3. **Update battery display to show "--" when offline** (index.tsx)
4. **Update analytics chart title and colors** (analytics.tsx)

---

## 📝 **TESTING CHECKLIST**

After updates, test:
- [ ] All screens load without errors
- [ ] Colors are consistent (#fbae3c accent throughout)
- [ ] Battery shows "--" when device goes offline
- [ ] RFID tags show last 8 digits correctly
- [ ] Charts render with correct colors
- [ ] Pet registration works
- [ ] Notifications display correctly
- [ ] Settings can be saved
- [ ] Online/offline status updates correctly

---

## 🚀 **DEPLOYMENT NOTES**

1. Update one screen at a time
2. Test thoroughly after each screen update
3. Verify Firebase connectivity
4. Check performance on both iOS and Android
5. Update app version in `app.json` after all changes

---

## ⚠️ **IMPORTANT NOTES**

- **DO NOT** change Firebase database URL (already correct)
- **DO NOT** change core logic unless specifically noted
- **DO NOT** remove existing functionality
- **FOCUS ON:** Visual consistency with web version
- **PRIORITY:** Color scheme and RFID display format

---

**Last Updated:** Based on kibbler-vanilla state as of latest changes
**Mobile Version:** 1.0.0 → Will need to increment after updates
