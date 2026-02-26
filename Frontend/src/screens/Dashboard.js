import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RefreshCw, Save, Settings, Plus, Wind, ShieldCheck, AlertCircle,
  Calendar, X, UserPlus, MessageSquare, ChevronRight, Check, UserCheck,
  Zap,
  Users
} from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import axiosInstance from '../api/axiosInstance';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const Dashboard = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef();

  // --- STATE ---
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState({
    Supervisor: null,
    N1: null, N2: null, N3: null, N4: null, N5: null, N6: null,
    Extra: null, Air: null,
    absent: []
  });
  const [shift, setShift] = useState('Morning');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [caption, setCaption] = useState('');
  const [selectedStaffList, setSelectedStaffList] = useState([]);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const MEMBERS_CACHE_KEY = 'DASHBOARD_MEMBERS_V1';
  const ASSIGNMENTS_CACHE_KEY = 'DASHBOARD_ASSIGNMENTS_V1';
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadCachedData = async () => {
    try {
      const cachedMembers = await AsyncStorage.getItem(MEMBERS_CACHE_KEY);
      const cachedAssignments = await AsyncStorage.getItem(ASSIGNMENTS_CACHE_KEY);
  
      if (cachedMembers) {
        const parsedMembers = JSON.parse(cachedMembers);
        setMembers(parsedMembers);
  
        const dbAbsents = parsedMembers.filter(m => m.available === 'absent');
        setAssignments(prev => ({ ...prev, absent: dbAbsents }));
      }
  
      if (cachedAssignments) {
        setAssignments(JSON.parse(cachedAssignments));
      }
  
    } catch (error) {
      console.log("Cache Load Error", error);
    }
  };

  // --- DATA LOADING ---
  useFocusEffect(
    useCallback(() => {
      loadCachedData();  
      fetchMembers();  
    }, [])
  );

  const fetchMembers = async () => {
    try {
      const res = await axiosInstance.get('/shifting');
      const formatted = res.data.map(m => ({ ...m, id: m._id }));
  
      setMembers(formatted);
  
      const dbAbsents = formatted.filter(m => m.available === 'absent');
      setAssignments(prev => ({ ...prev, absent: dbAbsents }));
  
      // ✅ Save to cache
      await AsyncStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(formatted));
  
    } catch (error) {
      console.log("Fetch Error", error);
    }
  };

  // 👇 3. Handle Date Change
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false); // Hide picker
    if (selectedDate) {
      // Format to YYYY-MM-DD
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setDate(formattedDate);
    }
  };

  // Toggle Selection Logic
  const toggleSelection = (staff) => {
    setSelectedStaffList(prev => {
      const isSelected = prev.find(s => s.id === staff.id);
      if (isSelected) {
        return prev.filter(s => s.id !== staff.id);
      } else {
        return [...prev, staff];
      }
    });
  };

  // Bulk Assignment Logic
  const handleZoneTap = async (zoneId) => {
    if (selectedStaffList.length === 0) return;

    const singleSlots = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'Supervisor', 'Extra', 'Air'];
    if (singleSlots.includes(zoneId) && selectedStaffList.length > 1) {
      Toast.show({
        type: 'error',
        text1: 'Multiple Selection',
        text2: 'You can only assign ONE person to this position.',
        visibilityTime: 2500,
        position: 'top'
      });
      return;
    }

    const nozzleSlots = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];

    if (nozzleSlots.includes(zoneId) && selectedStaffList.length > 0) {
      const staff = selectedStaffList[0];

      if (staff.nozzleRestriction === true) {
        Toast.show({
          type: 'error',
          text1: '⚠️ Complete Restriction',
          text2: `${staff.name} is restricted from ALL nozzles (N1-N6)`,
          visibilityTime: 3000,
          position: 'top'
        });
        return;
      }

      if (zoneId === 'N5' || zoneId === 'N6') {
        if (staff.gender === 'female' || staff.hangingRestriction === true) {
          Toast.show({
            type: 'error',
            text1: '⚠️ H5/H6 Restriction',
            text2: staff.gender === 'female'
              ? `${staff.name} is female - NOT allowed on H5/H6`
              : `${staff.name} has hanging restriction - NOT allowed on H5/H6`,
            visibilityTime: 3000,
            position: 'top'
          });
          return;
        }

      }
    }
    const updates = [];

    setAssignments(prev => {
      const newAssigns = { ...prev };

      selectedStaffList.forEach(staff => {
        const staffId = staff.id;
        if (Array.isArray(newAssigns['absent'])) {
          newAssigns['absent'] = newAssigns['absent'].filter(s => s.id !== staffId);
        }
        Object.keys(newAssigns).forEach(key => {
          if (key !== 'absent' && newAssigns[key]?.id === staffId) {
            newAssigns[key] = null;
          }
        });

        if (zoneId === 'absent') {
          const curr = newAssigns['absent'] || [];
          if (!curr.find(s => s.id === staffId)) {
            newAssigns['absent'] = [...curr, staff];
          }
          updates.push(axiosInstance.put(`/shifting/${staffId}`, { available: 'absent' }));
        }
        else if (zoneId === 'pool') {
          updates.push(axiosInstance.put(`/shifting/${staffId}`, { available: 'present' }));
        }
        else {
          newAssigns[zoneId] = staff;
          if (staff.available === 'absent') {
            updates.push(axiosInstance.put(`/shifting/${staffId}`, { available: 'present' }));
          }
        }
      });

      return newAssigns;
    });

    try {
      await Promise.all(updates);
      if (zoneId === 'absent' || zoneId === 'pool') {
        fetchMembers();
      }
      Toast.show({
        type: 'success',
        text1: zoneId === 'absent' ? 'Marked Absent' : zoneId === 'pool' ? 'Marked Present' : 'Assignment Updated'
      });
    } catch (e) {
      console.log("DB Error", e);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again',
        visibilityTime: 2000,
        position: 'top'
      });
    }

    setSelectedStaffList([]);
  };

  useEffect(() => {
    AsyncStorage.setItem(
      ASSIGNMENTS_CACHE_KEY,
      JSON.stringify(assignments)
    );
  }, [assignments]);

  const handleAutoAssign = async () => {
    setIsAutoAssigning(true);
    try {
      const res = await axiosInstance.post('/auto-assign', { shift, date });
      if (res.data.success) {
        const autoData = res.data.data;
        const backendAssignments = autoData.assignments;
        const newAssignments = { ...assignments };
        const keys = ['Supervisor', 'Air', 'Extra', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6'];

        keys.forEach(key => {
          if (backendAssignments[key]) {
            newAssignments[key] = {
              ...backendAssignments[key],
              id: backendAssignments[key]._id,
            };
          } else {
            newAssignments[key] = null;
          }
        });

        setAssignments(newAssignments);

        let text2 = `Assigned: ${autoData.summary.assigned}/6`;
        if (autoData.summary.overtime > 0) {
          text2 += ` | OT: ${autoData.summary.overtime}`;
        }
        if (autoData.summary.extra > 0) {
          text2 += ` | Extra: ${autoData.summary.extra}`;
        }
        if (autoData.summary.supervisorPromoted) {
          text2 += ` | ⭐ Promoted`;
        }

        Toast.show({
          type: 'success',
          text1: '✅ Auto-Assignment Complete!',
          text2: text2,
          visibilityTime: 4000,
          position: 'top'
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Auto-Assign Failed',
        text2: error.response?.data?.message || "Check connection.",
        visibilityTime: 3000,
        position: 'top'
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleSaveMap = async () => {
    try {
      const uri = await mapRef.current.capture();
      const base64Img = `data:image/jpeg;base64,${await ViewShot.captureRef(mapRef, { result: "base64", quality: 0.7 })}`;
      await axiosInstance.post("/save-map", { date, shift, image: base64Img, caption, assignments });
      Toast.show({
        type: 'success',
        text1: 'Map Saved Successfully!',
        visibilityTime: 2000,
        position: 'top'
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Failed to save map',
        visibilityTime: 2000,
        position: 'top'
      });
    }
  };

  const assignedIds = Object.values(assignments).flat().map(s => s?.id).filter(Boolean);
  const availablePool = members.filter(s => s.available === 'present');
  const absentStaff = assignments['absent'] || [];
  const currentShiftAbsent = absentStaff.filter(staff =>
    staff.shift && staff.shift.toLowerCase() === shift.toLowerCase()
  );

  const renderStaffCircle = (staff, size = 50, showBadges = false) => {
    const isSelected = selectedStaffList.some(s => s.id === staff.id);
    const isAssigned = assignedIds.includes(staff.id);
    const fontSize = size * 0.4;

    return (
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          onPress={() => toggleSelection(staff)}
          style={[
            styles.staffCircle,
            { width: size, height: size },
            isSelected && styles.selectedRing
          ]}
        >
          {staff.avatar ? (
            <Image
              source={{ uri: staff.avatar }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.avatar, styles.letterAvatar]}>
              <Text style={[styles.letterText, { fontSize: fontSize }]}>
                {staff.name ? staff.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.checkBadge}>
              <Check size={10} color="white" strokeWidth={4} />
            </View>
          )}
          {!isSelected && isAssigned && staff.available === 'present' && (
            <View style={styles.assignedBadge} />
          )}
        </TouchableOpacity>
        {showBadges && (
          <>
            {staff.isOvertime && (
              <View style={styles.otBadge}><Text style={styles.otText}>OT</Text></View>
            )}
            {staff.promotedToSupervisor && (
              <View style={styles.promotedBadge}><Text style={styles.promotedText}>⭐</Text></View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderZone = (id, label, icon) => (
    <TouchableOpacity
      style={[styles.zone, assignments[id] && styles.filledZone]}
      onPress={() => handleZoneTap(id)}
    >
      <Text style={styles.zoneLabel}>{label}</Text>
      {assignments[id] ? (
        renderStaffCircle(assignments[id], 55, true)
      ) : (
        <View style={styles.emptyIcon}>{icon}</View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']} >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>PUMP MANAGEMENT</Text>
          <Text style={styles.subtitle}>{date} • {shift}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShift(shift === 'Morning' ? 'Evening' : 'Morning')}
          style={styles.shiftBtn}
        >
          <RefreshCw size={16} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* --- MAP AREA --- */}
        <ViewShot ref={mapRef} options={{ format: "jpg", quality: 0.9 }} style={styles.mapContainer}>
          <View style={{ position: 'absolute', top: 20, left: 60, zIndex: 1 }}>
            {renderZone('Supervisor', 'Supervisor', <ShieldCheck color="#aaa" />)}
          </View>
          {/* 👇 4. Date Picker Trigger */}
          <View style={{ position: 'absolute', top: 30, right: 25, zIndex: 1 }}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBox}>
              <Calendar size={14} color="#1e40af" style={{ marginRight: 4 }} />
              <Text style={styles.dateText}>{date}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapLayout}>
            <View style={styles.leftColumn}>
              <View style={styles.leftSideBlock}>
                <View style={styles.nozzleRow}>
                  {renderZone('N2', 'N2', <Text>⛽</Text>)}
                  {renderZone('N1', 'N1', <Text>⛽</Text>)}
                </View>
                <View style={styles.mpdBox}><Text style={styles.mpdText}>MPD</Text></View>
                <View style={styles.nozzleRow}>
                  {renderZone('N3', 'N3', <Text>⛽</Text>)}
                  {renderZone('N4', 'N4', <Text>⛽</Text>)}
                </View>
              </View>
              <View style={styles.bottomUtilities}>
                <View style={styles.utilityItem}>
                  {renderZone('Extra', 'Extra', <Plus color="#aaa" />)}
                  <Text style={styles.utilityLabel}>Extra</Text>
                </View>
                <View style={styles.utilityItem}>
                  {renderZone('Air', 'Air', <Wind color="#aaa" />)}
                  <Text style={styles.utilityLabel}>Air</Text>
                </View>
              </View>
            </View>
            <View style={styles.rightColumn}>
              <View style={styles.hangingItem}>
                <Text style={styles.hangingText}>H-5</Text>
                {renderZone('N5', 'H-5', <Text>🪝</Text>)}
              </View>
              <View style={styles.hangingItem}>
                <Text style={styles.hangingText}>H-6</Text>
                {renderZone('N6', 'H-6', <Text>🪝</Text>)}
              </View>
            </View>
          </View>
          <TextInput placeholder="Add note..." value={caption} onChangeText={setCaption} style={styles.captionInput} />

          {currentShiftAbsent.length > 0 && (
            <View style={styles.absentBoxInMap}>
              <Text style={styles.absentTitleInMap}>Absent ({currentShiftAbsent.length})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                {currentShiftAbsent.map((staff, index) => (
                  <Text key={staff.id} style={styles.absentNameText}>
                    {staff.name}{index < currentShiftAbsent.length - 1 ? ',' : ''}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </ViewShot>

        <View style={styles.actions}>
          <TouchableOpacity onPress={handleAutoAssign} style={[styles.btn, styles.autoBtn]} disabled={isAutoAssigning}>
            {isAutoAssigning ? <ActivityIndicator color="white" size="small" /> : <Zap color="white" size={20} fill="white" />}
            <Text style={styles.btnText}>{isAutoAssigning ? 'Assigning...' : 'Auto Assign'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSaveMap} style={[styles.btn, styles.saveBtn]}>
            <Save color="white" size={20} />
            <Text style={styles.btnText}>Save & Share</Text>
          </TouchableOpacity>
        </View>

        {/* --- SECTION 1: AVAILABLE STAFF --- */}
        <View style={styles.staffPool}>
          <View style={styles.poolHeader}>
            <Text style={styles.poolTitle}>Available Staff ({availablePool.length})</Text>
            {selectedStaffList.length > 0 && selectedStaffList.some(s => s.available === 'present') && (
              <TouchableOpacity onPress={() => setSelectedStaffList([])}>
                <Text style={styles.clearText}>Clear Selection</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
            {availablePool.map(staff => (
              <View key={staff.id} style={styles.staffItem}>
                {renderStaffCircle(staff, 60, false)}
                <Text style={styles.staffName} numberOfLines={1}>{staff.name}</Text>
                {staff.nozzleRestriction === true ? (
                  <Text style={styles.warningText}>⚠️ N1-N6 Block</Text>
                ) : (staff.hangingRestriction === true || staff.gender === 'female') ? (
                  <Text style={styles.warningText}>⚠️ No H5/H6</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[styles.actionZone, styles.absentZone, selectedStaffList.length > 0 && selectedStaffList.every(s => s.available === 'present') && styles.activeAction]}
          onPress={() => handleZoneTap('absent')}
        >
          <AlertCircle color={selectedStaffList.length > 0 && selectedStaffList.every(s => s.available === 'present') ? "#ef4444" : "#aaa"} size={24} />
          <Text style={[styles.actionText, { color: selectedStaffList.length > 0 && selectedStaffList.every(s => s.available === 'present') ? '#ef4444' : '#94a3b8' }]}>
            Mark Selected as Absent
          </Text>
        </TouchableOpacity>

        {/* --- SECTION 2: ABSENT STAFF --- */}
        {absentStaff.length > 0 && (
          <>
            <View style={[styles.staffPool, { marginTop: 20, borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 20 }]}>
              <View style={styles.poolHeader}>
                <Text style={[styles.poolTitle, { color: '#b91c1c' }]}>Absent Staff ({absentStaff.length})</Text>
                {selectedStaffList.length > 0 && selectedStaffList.some(s => s.available === 'absent') && (
                  <TouchableOpacity onPress={() => setSelectedStaffList([])}>
                    <Text style={styles.clearText}>Clear Selection</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
                {absentStaff.map(staff => (
                  <View key={staff.id} style={styles.staffItem}>
                    {renderStaffCircle(staff, 60, false)}
                    <Text style={[styles.staffName, { color: '#b91c1c' }]} numberOfLines={1}>{staff.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.actionZone, styles.presentZone, selectedStaffList.length > 0 && selectedStaffList.every(s => s.available === 'absent') && styles.activePresent]}
              onPress={() => handleZoneTap('pool')}
            >
              <UserCheck color={selectedStaffList.length > 0 && selectedStaffList.every(s => s.available === 'absent') ? "#10b981" : "#aaa"} size={24} />
              <Text style={[styles.actionText, { color: selectedStaffList.length > 0 && selectedStaffList.every(s => s.available === 'absent') ? '#10b981' : '#94a3b8' }]}>
                Mark Selected as Present
              </Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      <View style={[styles.navBar, { paddingBottom: 15 + insets.bottom }]}>
        {/* 👆 insets.bottom add karne se ye Gesture bar ya Buttons ke hisaab se adjust ho jayega */}
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
          <Calendar color="#64748b" size={26} /><Text style={styles.navText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setShowSettingsModal(true)}>
          <Settings color="#64748b" size={26} /><Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showSettingsModal} transparent animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Settings</Text><TouchableOpacity onPress={() => setShowSettingsModal(false)}><X color="#94a3b8" /></TouchableOpacity></View>
            <TouchableOpacity style={styles.settingOption} onPress={() => { setShowSettingsModal(false); navigation.navigate('AddMember'); }}>
              <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}><UserPlus color="#2563eb" size={20} /></View>
              <View style={{ flex: 1 }}><Text style={styles.optionTitle}>Add New Staff</Text><Text style={styles.optionSub}>Create, edit or delete members</Text></View><ChevronRight color="#cbd5e1" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingOption}
              onPress={() => { setShowSettingsModal(false); navigation.navigate('MemberList'); }}
            >
              <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                <Users color="#2563eb" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Manage Staff</Text>
                <Text style={styles.optionSub}>View, add, edit or delete</Text>
              </View>
              <ChevronRight color="#cbd5e1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingOption} onPress={() => { setShowSettingsModal(false); Toast.show({ type: 'info', text1: 'Coming Soon', text2: 'SMS features coming soon!', visibilityTime: 2000, position: 'top' }); }}>
              <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}><MessageSquare color="#9333ea" size={20} /></View>
              <View style={{ flex: 1 }}><Text style={styles.optionTitle}>SMS Configuration</Text><Text style={styles.optionSub}>Set morning/evening auto-send time</Text></View><ChevronRight color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 👇 5. Render Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date(date)}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDate(selectedDate.toISOString().split('T')[0]);
            }
          }}
        />
      )}

      <Toast />
    </SafeAreaView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
  shiftBtn: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 20 },
  mapContainer: { backgroundColor: 'white', margin: 15, padding: 15, borderRadius: 25, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  btn: { flex: 1, flexDirection: 'row', padding: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  autoBtn: { backgroundColor: '#f97316' },
  saveBtn: { backgroundColor: '#10b981' },
  btnText: { color: 'white', fontWeight: 'bold' },
  mapLayout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', paddingHorizontal: 10, marginVertical: 80 },
  leftColumn: { flex: 1, alignItems: 'flex-start' },
  leftSideBlock: { alignItems: 'center', gap: 10, marginBottom: 30 },
  rightColumn: { alignItems: 'center', gap: 30, paddingTop: 10 },
  nozzleRow: { flexDirection: 'row', gap: 20, alignItems: 'center', justifyContent: 'center' },
  bottomUtilities: { flexDirection: 'row', gap: 20, marginTop: 10, paddingLeft: 20 },
  utilityItem: { alignItems: 'center', gap: 5 },
  utilityLabel: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  hangingItem: { alignItems: 'center', gap: 5 },
  hangingText: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
  mpdBox: { width: 100, height: 50, backgroundColor: '#1e293b', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mpdText: { color: 'white', fontWeight: '900' },

  // ✅ Updated Date Box to be clickable
  dateBox: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, borderWidth: 2, borderColor: '#3b82f6', flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 10, fontWeight: 'bold', color: '#1e40af' },

  zone: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  filledZone: { borderStyle: 'solid', borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  zoneLabel: { position: 'absolute', top: -8, backgroundColor: '#334155', color: 'white', fontSize: 8, paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  emptyIcon: { justifyContent: 'center', alignItems: 'center' },
  staffCircle: { borderRadius: 50, overflow: 'hidden', borderWidth: 2, borderColor: 'white', backgroundColor: '#ddd', position: 'relative' },
  selectedRing: { borderColor: '#22c55e', borderWidth: 3 },
  avatar: { width: '100%', height: '100%' },
  checkBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#22c55e', borderRadius: 10, padding: 2 },
  assignedBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#3b82f6', width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'white' },
  letterAvatar: { backgroundColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  letterText: { fontWeight: '900', color: '#475569' },
  otBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: 'white' },
  otText: { fontSize: 8, fontWeight: 'bold', color: 'white' },
  promotedBadge: { position: 'absolute', top: -8, left: -8, backgroundColor: '#fbbf24', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: 'white' },
  promotedText: { fontSize: 12 },
  warningText: { fontSize: 8, color: '#ef4444', fontWeight: 'bold', marginTop: 2 },
  absentBoxInMap: { width: '100%', marginTop: 15, padding: 12, backgroundColor: '#fef2f2', borderRadius: 12, borderWidth: 1, borderColor: '#fca5a5' },
  absentTitleInMap: { fontSize: 11, fontWeight: 'bold', color: '#b91c1c', marginBottom: 5 },
  absentNameText: { fontSize: 10, color: '#b91c1c', fontWeight: '500' },
  staffPool: { padding: 20 },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  poolTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  clearText: { fontSize: 12, color: '#ef4444', fontWeight: 'bold' },
  scrollRow: { flexDirection: 'row' },
  staffItem: { marginRight: 15, alignItems: 'center', width: 70 },
  staffName: { fontSize: 10, textAlign: 'center', marginTop: 4, color: '#334155', width: '100%' },
  actionZone: { margin: 20, marginTop: 5, padding: 15, borderWidth: 2, borderStyle: 'dashed', borderRadius: 15, flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center' },
  actionText: { fontWeight: 'bold' },
  absentZone: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  activeAction: { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderStyle: 'solid' },
  presentZone: { borderColor: '#cbd5e1', backgroundColor: 'white' },
  activePresent: { backgroundColor: '#d1fae5', borderColor: '#10b981', borderStyle: 'solid' },
  captionInput: { width: '100%', backgroundColor: '#f8fafc', padding: 8, borderRadius: 10, marginTop: 0, fontSize: 12, textAlign: 'center' },
  navBar: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, paddingBottom: 20, elevation: 10, position: 'absolute', bottom: 0, width: '100%' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  settingOption: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  optionSub: { fontSize: 12, color: '#94a3b8' },
});

export default Dashboard;