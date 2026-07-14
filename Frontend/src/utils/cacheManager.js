/**
 * Centralized Cache Manager
 * 
 * Single source of truth for all cached data across the app.
 * Uses AsyncStorage with timestamp-based staleness checks.
 * 
 * Pattern: Stale-While-Revalidate
 * - Show cached data instantly
 * - Fetch fresh data in background
 * - Update UI silently when fresh data arrives
 * - Skip fetch if data is still fresh (< STALE_TIME)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Cache Keys (SINGLE source of truth) ---
const KEYS = {
  MEMBERS: 'CACHE_MEMBERS_V3',
  MEMBERS_TIMESTAMP: 'CACHE_MEMBERS_V3_TS',
  HISTORY_MAPS: 'CACHE_HISTORY_MAPS_V2',
  HISTORY_MAPS_TIMESTAMP: 'CACHE_HISTORY_MAPS_V2_TS',
  ASSIGNMENTS_PREFIX: 'CACHE_ASSIGNMENTS_',
};

// --- Staleness Thresholds (milliseconds) ---
const STALE_TIME = {
  MEMBERS: 30 * 1000,       // 30 seconds — members data
  HISTORY: 60 * 1000,       // 60 seconds — history maps
  ASSIGNMENTS: 5 * 60 * 1000, // 5 minutes — assignments per date/shift
};

// --- In-memory cache for instant access (no AsyncStorage read delay) ---
let memoryCache = {
  members: null,
  membersTimestamp: 0,
  historyMaps: null,
  historyMapsTimestamp: 0,
};

// ============================================
// MEMBERS CACHE
// ============================================

/**
 * Get cached members (memory first, then AsyncStorage)
 * @returns {Array|null} Cached members array or null
 */
export const getCachedMembers = async () => {
  // 1. Try memory cache first (instant, no I/O)
  if (memoryCache.members) {
    return memoryCache.members;
  }

  // 2. Fall back to AsyncStorage
  try {
    const cached = await AsyncStorage.getItem(KEYS.MEMBERS);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryCache.members = parsed;

      // Also load timestamp
      const ts = await AsyncStorage.getItem(KEYS.MEMBERS_TIMESTAMP);
      memoryCache.membersTimestamp = ts ? parseInt(ts, 10) : 0;

      return parsed;
    }
  } catch (error) {
    console.log('CacheManager: Members load error', error);
  }
  return null;
};

/**
 * Save members to cache (both memory + AsyncStorage)
 * @param {Array} members 
 */
export const setCachedMembers = async (members) => {
  const now = Date.now();
  memoryCache.members = members;
  memoryCache.membersTimestamp = now;

  try {
    await AsyncStorage.multiSet([
      [KEYS.MEMBERS, JSON.stringify(members)],
      [KEYS.MEMBERS_TIMESTAMP, now.toString()],
    ]);
  } catch (error) {
    console.log('CacheManager: Members save error', error);
  }
};

/**
 * Check if members cache is still fresh
 * @returns {boolean} true if data is fresh (no API call needed)
 */
export const isMembersCacheFresh = () => {
  if (!memoryCache.members || memoryCache.membersTimestamp === 0) return false;
  return (Date.now() - memoryCache.membersTimestamp) < STALE_TIME.MEMBERS;
};

/**
 * Force invalidate members cache (call after add/edit/delete)
 */
export const invalidateMembersCache = () => {
  memoryCache.membersTimestamp = 0;
};

// ============================================
// ASSIGNMENTS CACHE (per date + shift)
// ============================================

const getAssignmentKey = (date, shift) => `${KEYS.ASSIGNMENTS_PREFIX}${date}_${shift}`;

/**
 * Get cached assignments for a specific date/shift
 */
export const getCachedAssignments = async (date, shift) => {
  try {
    const key = getAssignmentKey(date, shift);
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.log('CacheManager: Assignments load error', error);
    return null;
  }
};

/**
 * Save assignments to cache
 */
export const setCachedAssignments = async (date, shift, assignments) => {
  try {
    const key = getAssignmentKey(date, shift);
    await AsyncStorage.setItem(key, JSON.stringify(assignments));
  } catch (error) {
    console.log('CacheManager: Assignments save error', error);
  }
};

// ============================================
// HISTORY MAPS CACHE
// ============================================

export const getCachedHistoryMaps = async () => {
  if (memoryCache.historyMaps) {
    return memoryCache.historyMaps;
  }

  try {
    const cached = await AsyncStorage.getItem(KEYS.HISTORY_MAPS);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryCache.historyMaps = parsed;

      const ts = await AsyncStorage.getItem(KEYS.HISTORY_MAPS_TIMESTAMP);
      memoryCache.historyMapsTimestamp = ts ? parseInt(ts, 10) : 0;

      return parsed;
    }
  } catch (error) {
    console.log('CacheManager: History load error', error);
  }
  return null;
};

export const setCachedHistoryMaps = async (maps) => {
  const now = Date.now();
  memoryCache.historyMaps = maps;
  memoryCache.historyMapsTimestamp = now;

  try {
    await AsyncStorage.multiSet([
      [KEYS.HISTORY_MAPS, JSON.stringify(maps)],
      [KEYS.HISTORY_MAPS_TIMESTAMP, now.toString()],
    ]);
  } catch (error) {
    console.log('CacheManager: History save error', error);
  }
};

export const isHistoryCacheFresh = () => {
  if (!memoryCache.historyMaps || memoryCache.historyMapsTimestamp === 0) return false;
  return (Date.now() - memoryCache.historyMapsTimestamp) < STALE_TIME.HISTORY;
};

export const invalidateHistoryCache = () => {
  memoryCache.historyMapsTimestamp = 0;
};

// ============================================
// CLEANUP (old cache keys from previous versions)
// ============================================

export const cleanupOldCacheKeys = async () => {
  try {
    const oldKeys = [
      'DASHBOARD_MEMBERS_V1',
      'MEMBERS_CACHE_V1',
      'history_maps',
    ];
    await AsyncStorage.multiRemove(oldKeys);
  } catch (error) {
    // Silent cleanup — don't break app if old keys don't exist
  }
};
