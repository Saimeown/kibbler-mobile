# CRITICAL LOGIC DIFFERENCES BETWEEN WEB AND MOBILE

## 🔴 **MAJOR ISSUES FOUND**

---

## 1. **TODAY'S FEEDINGS CALCULATION** ⚠️ CRITICAL

### Web (dashboard.php) - CORRECT ✅
```php
function getTodayDispenses($deviceData) {
    $todayCount = 0;
    $uniquePetsToday = [];
    
    // Get current pet registry to filter only registered pets
    $petRegistry = $deviceData['pets']['pet_registry'] ?? [];
    
    $today = new DateTime('now', new DateTimeZone('Asia/Manila'));
    $today->setTime(0, 0, 0);
    $tomorrow = clone $today;
    $tomorrow->modify('+1 day');
    
    foreach ($deviceData['feeding_history'] as $key => $feeding) {
        // Only count registered pets
        $uid = $feeding['uid'] ?? null;
        if (!$uid || !isset($petRegistry[$uid])) {
            continue;
        }
        
        $timestamp = $feeding['timestamp'] ?? $key;
        
        $feedingTime = DateTime::createFromFormat('Y-m-d\TH:i:s\Z', $timestamp, new DateTimeZone('UTC'));
        if ($feedingTime >= $today && $feedingTime < $tomorrow) {
            $todayCount++;
            $uniquePetsToday[$uid] = true;
        }
    }
    
    return [
        'count' => $todayCount,
        'unique_pets' => count($uniquePetsToday)
    ];
}

// Usage:
$todayStats = getTodayDispenses($deviceData);
$stats['today_dispense_count'] = $todayStats['count'];
$stats['today_unique_pets'] = $todayStats['unique_pets'];
```

### Mobile (index.tsx) - WRONG ❌
```tsx
const stats = {
    // WRONG: Using Firebase stats directly without calculating from feeding_history
    today_dispense_count: firebaseData.stats?.today_dispense_count || 0,
    today_unique_pets: firebaseData.stats?.today_unique_pets || 0,
    // ... rest
};
```

**PROBLEM:** Mobile is using `firebaseData.stats` directly, which may be stale or outdated. Web RECALCULATES from `feeding_history` to ensure accuracy.

**FIX NEEDED:** Mobile must calculate today's feedings from `feeding_history` just like web does.

---

## 2. **WEEKLY DISPENSE COUNT** ⚠️ CRITICAL

### Web (dashboard.php) - CORRECT ✅
```php
function getCurrentWeekDispenses($deviceData) {
    $weekCount = 0;
    
    // Get current pet registry to filter only registered pets
    $petRegistry = $deviceData['pets']['pet_registry'] ?? [];
    
    $today = new DateTime('now', new DateTimeZone('Asia/Manila'));
    $today->setTime(0, 0, 0);
    $dayOfWeek = (int)$today->format('N'); // 1 (Mon) to 7 (Sun)
    $daysSinceMonday = ($dayOfWeek - 1);
    $lastMonday = clone $today;
    $lastMonday->modify("-$daysSinceMonday days");
    
    foreach ($deviceData['feeding_history'] as $key => $feeding) {
        // Only count registered pets
        $uid = $feeding['uid'] ?? null;
        if (!$uid || !isset($petRegistry[$uid])) {
            continue;
        }
        
        $timestamp = $feeding['timestamp'] ?? $key;
        $feedingTime = DateTime::createFromFormat('Y-m-d\TH:i:s\Z', $timestamp, new DateTimeZone('UTC'));
        
        $feedingDate = clone $feedingTime;
        $feedingDate->setTime(0, 0, 0);
        
        if ($feedingDate >= $lastMonday) {
            $weekCount++;
        }
    }
    
    return $weekCount;
}
```

### Mobile (index.tsx) - WRONG ❌
```tsx
const getCurrentWeekDispenses = (firebaseData: any): number => {
    let total = 0;
    if (!firebaseData.history?.daily) return 0;  // ❌ WRONG SOURCE

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysSinceMonday);

    // ❌ WRONG: Using history.daily instead of feeding_history
    Object.entries(firebaseData.history.daily).forEach(([date, dayData]: [string, any]) => {
        const feedingDate = new Date(date);
        if (feedingDate >= lastMonday) {
            total += dayData.dispense_count || 0;  // ❌ Using aggregated data
        }
    });

    return total;
};
```

**PROBLEMS:**
1. Mobile uses `history.daily` which is aggregated/summarized data
2. Web uses `feeding_history` which is raw feeding records
3. Mobile doesn't filter by registered pets
4. Different day-of-week calculation

**FIX NEEDED:** Mobile must use `feeding_history` and filter by `pet_registry` like web.

---

## 3. **ONLINE/OFFLINE STATUS** ⚠️ HIGH PRIORITY

### Web Logic
```javascript
// In sidebars.js
function updateDeviceStatus() {
    const deviceStatusRef = firebase.database().ref('/devices/kibbler_001/device_status');
    
    deviceStatusRef.on('value', (snapshot) => {
        const deviceStatus = snapshot.val();
        const lastSeenTime = new Date(deviceStatus.last_seen).getTime();
        const now = new Date().getTime();
        const secondsSinceLastSeen = (now - lastSeenTime) / 1000;
        
        const isOnline = secondsSinceLastSeen < 120;  // 120 second threshold
        
        if (isOnline) {
            statusBadge.className = 'status-badge connected';
            statusBadge.innerHTML = '<div class="status-dot"></div>Online';
        } else {
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = '<div class="status-dot"></div>Offline';
        }
    });
}
```

### Mobile Logic (useDeviceOnlineStatus.ts)
Need to check this file - it may have different threshold or calculation!

---

## 4. **REGISTERED PETS COUNT** ✅ BOTH CORRECT

### Web
```php
$petRegistry = $deviceData['pets']['pet_registry'] ?? [];
$registeredPetsCount = count($petRegistry);
$stats['total_unique_uids'] = $registeredPetsCount;
```

### Mobile
```tsx
const petRegistry = firebaseData.pets?.pet_registry || {};
const registeredPetsCount = Object.keys(petRegistry).length;
total_unique_uids: registeredPetsCount,
```

**STATUS:** Both are correctly counting from `pet_registry`. ✅

---

## 5. **CHART DATA GENERATION** ⚠️ NEEDS VERIFICATION

### Web
- Uses server-side date calculations (PHP DateTime with Asia/Manila timezone)
- Processes `feeding_history` directly
- Filters by registered pets

### Mobile
- Uses client-side date calculations (JavaScript Date)
- Uses different data sources (history.daily vs feeding_history)
- May not filter by registered pets

**NEEDS INVESTIGATION**

---

## 📋 **PRIORITY FIX LIST**

### 🔴 **CRITICAL (Must Fix Now)**
1. **Mobile: Calculate today's feedings from feeding_history**
   - Don't use `firebaseData.stats.today_dispense_count`
   - Iterate through `feeding_history`
   - Filter by `pet_registry`
   - Check if timestamp is today

2. **Mobile: Calculate weekly count from feeding_history**
   - Don't use `history.daily`
   - Iterate through `feeding_history`
   - Filter by `pet_registry`
   - Check if timestamp is >= last Monday

3. **Mobile: Fix online/offline status detection**
   - Must match web's 120-second threshold
   - Must check `last_seen` timestamp correctly
   - Update hook: `useDeviceOnlineStatus.ts`

### 🟡 **HIGH PRIORITY**
4. **Mobile: Verify chart data processing**
   - Ensure it matches web's calculation
   - Use correct data source
   - Apply same timezone handling

5. **Mobile: Verify timestamp formatting**
   - Check `formatTimeForDisplay` matches web
   - Ensure timezone consistency

### 🟢 **MEDIUM PRIORITY**
6. **Mobile: Recent activities processing**
   - Verify pet name mapping
   - Check message formatting
   - Ensure sorting is correct

---

## 🛠️ **IMPLEMENTATION PLAN**

### Step 1: Create Helper Functions in Mobile
```tsx
// Add to index.tsx

const getTodayFeedings = (firebaseData: any): { count: number; uniquePets: number } => {
    let todayCount = 0;
    const uniquePetsToday: Set<string> = new Set();
    
    if (!firebaseData.feeding_history) return { count: 0, uniquePets: 0 };
    
    const petRegistry = firebaseData.pets?.pet_registry || {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    Object.entries(firebaseData.feeding_history).forEach(([key, feeding]: [string, any]) => {
        const uid = feeding.uid;
        if (!uid || !petRegistry[uid]) {
            return; // Skip unregistered pets
        }
        
        const timestamp = feeding.timestamp || key;
        const feedingTime = new Date(timestamp);
        
        if (feedingTime >= today && feedingTime < tomorrow) {
            todayCount++;
            uniquePetsToday.add(uid);
        }
    });
    
    return {
        count: todayCount,
        uniquePets: uniquePetsToday.size
    };
};

const getCurrentWeekFeedings = (firebaseData: any): number => {
    let weekCount = 0;
    
    if (!firebaseData.feeding_history) return 0;
    
    const petRegistry = firebaseData.pets?.pet_registry || {};
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7; // Convert Sun=0 to Mon=0 based
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysSinceMonday);
    
    Object.entries(firebaseData.feeding_history).forEach(([key, feeding]: [string, any]) => {
        const uid = feeding.uid;
        if (!uid || !petRegistry[uid]) {
            return; // Skip unregistered pets
        }
        
        const timestamp = feeding.timestamp || key;
        const feedingTime = new Date(timestamp);
        feedingTime.setHours(0, 0, 0, 0);
        
        if (feedingTime >= lastMonday) {
            weekCount++;
        }
    });
    
    return weekCount;
};
```

### Step 2: Update processDeviceData
```tsx
const processDeviceData = (firebaseData: any): DashboardData => {
    // ... existing deviceStatus code ...
    
    // ✅ NEW: Calculate stats from feeding_history
    const todayStats = getTodayFeedings(firebaseData);
    const weekCount = getCurrentWeekFeedings(firebaseData);
    
    const petRegistry = firebaseData.pets?.pet_registry || {};
    const registeredPetsCount = Object.keys(petRegistry).length;
    
    const stats = {
        today_dispense_count: todayStats.count,  // ✅ From calculation
        week_dispense_count: weekCount,          // ✅ From calculation
        today_unique_pets: todayStats.uniquePets, // ✅ From calculation
        total_unique_uids: registeredPetsCount,   // ✅ Already correct
        // ... rest
    };
    
    // ... rest of processing ...
};
```

### Step 3: Fix Online/Offline Hook
Check `hooks/useDeviceOnlineStatus.ts` and ensure it matches web's logic exactly.

---

## ⚠️ **CRITICAL NOTES**

1. **The stats difference is why web shows offline but mobile shows online!**
   - Mobile might be using cached/stale data
   - Web recalculates everything fresh

2. **The feeding count difference is significant!**
   - If mobile shows different numbers, it's using wrong data source

3. **This is NOT just a UI update - it's a LOGIC OVERHAUL**
   - Every stat must be recalculated
   - Data sources must match web exactly
   - Filtering logic must be identical

---

**PRIORITY: Fix items 1, 2, and 3 IMMEDIATELY. These are causing incorrect data display.**
