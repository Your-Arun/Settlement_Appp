import React, { useState, useEffect, useRef,useCallback  } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, Image, Alert, StyleSheet, Modal, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Users, RefreshCw, Save, Settings, Plus, Wind, ShieldCheck, AlertCircle, 
  Calendar, X, UserPlus, MessageSquare, ChevronRight 
} from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import axiosInstance from '../api/axiosInstance';

const Dashboard = () => {
  const navigation = useNavigation();
  const mapRef = useRef();
  
  // --- STATE ---
  const [showSettingsModal, setShowSettingsModal] = useState(false); // Settings Modal State
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState({ absent: [] });
  const [shift, setShift] = useState('Morning');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [caption, setCaption] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [])
  );

  const fetchMembers = async () => {
    try {
      const res = await axiosInstance.get('/shifting');
      const formatted = res.data.map(m => ({ ...m, id: m._id }));
      setMembers(formatted);
      
      // Update assignments logic (keep existing logic)
      const dbAbsents = formatted.filter(m => m.available === 'absent');
      setAssignments(prev => ({ ...prev, absent: dbAbsents }));
    } catch (error) {
      // Silent fail or Toast
      console.log("Fetch error", error);
    }
  };
  const toggleSelection = (staff) => {
    setSelectedStaffList(prev => {
      const isSelected = prev.find(s => s.id === staff.id);
      if (isSelected) {
        return prev.filter(s => s.id !== staff.id); // Remove
      } else {
        return [...prev, staff]; // Add
      }
    });
  };
  
  const handleZoneTap = async (zoneId) => {
    if (selectedStaffList.length === 0) return;

    // A. RESTRICTION: Single Slots (Nozzles/Supervisor) accept only 1 person
    if (zoneId !== 'absent' && zoneId !== 'pool' && selectedStaffList.length > 1) {
      Alert.alert("Multiple Selection", "You can only assign ONE person to a Nozzle/Desk at a time.");
      return;
    }

    const updates = []; // To store DB promises

    // B. LOOP THROUGH SELECTED STAFF
    setAssignments(prev => {
      const newAssigns = { ...prev };
      
      selectedStaffList.forEach(staff => {
        const staffId = staff.id;

        // 1. Remove from old location
        if (Array.isArray(newAssigns['absent'])) {
          newAssigns['absent'] = newAssigns['absent'].filter(s => s.id !== staffId);
        }
        Object.keys(newAssigns).forEach(key => {
          if (key !== 'absent' && newAssigns[key]?.id === staffId) {
            newAssigns[key] = null;
          }
        });

        // 2. Add to New Location
        if (zoneId === 'absent') {
           const curr = newAssigns['absent'] || [];
           if (!curr.find(s => s.id === staffId)) newAssigns['absent'] = [...curr, staff];
           // DB Update Push
           updates.push(axiosInstance.put(`/shifting/${staffId}`, { available: 'absent' }));
        } 
        else if (zoneId === 'pool') {
           // DB Update Push (Back to Present)
           updates.push(axiosInstance.put(`/shifting/${staffId}`, { available: 'present' }));
        } 
        else {
           // Single Assignment
           newAssigns[zoneId] = staff;
           // If coming from absent, mark present in DB
           if (staff.available === 'absent') {
              updates.push(axiosInstance.put(`/shifting/${staffId}`, { available: 'present' }));
           }
        }
      });

      return newAssigns;
    });

    // C. EXECUTE DB UPDATES
    try {
      await Promise.all(updates);
      // Refresh local member state if status changed
      if (zoneId === 'absent' || zoneId === 'pool') {
         fetchMembers(); 
      }
    } catch (e) { console.log("DB Error"); }

    // D. CLEAR SELECTION
    setSelectedStaffList([]);
  };
  
  const handleAutoAssign = () => { /* ... Paste Auto Assign Logic ... */ };

  const handleSaveMap = async () => {
    try {
        const uri = await mapRef.current.capture();
        const base64Img = `data:image/jpeg;base64,${await ViewShot.captureRef(mapRef, { result: "base64", quality: 0.7 })}`;
        await axiosInstance.post("/save-map", { date, shift, image: base64Img, caption, assignments });
        Toast.show({ type: 'success', text1: 'Map Saved Successfully!' });
        if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); }
    } catch (err) { Alert.alert("Error", "Save failed."); }
  };

  const assignedIds = Object.values(assignments).flat().map(s => s?.id).filter(Boolean);
  const availablePool = members.filter(s => s.available === 'present' && !assignedIds.includes(s.id));

  const renderStaffCircle = (staff, size = 50) => {
    const isSelected = selectedStaff?.id === staff.id;
    return (
        <TouchableOpacity onPress={() => setSelectedStaff(isSelected ? null : staff)} style={[styles.staffCircle, { width: size, height: size }, isSelected && styles.selectedRing]}>
            <Image source={{ uri: staff.avatar || `https://ui-avatars.com/api/?name=${staff.name}` }} style={styles.avatar} />
        </TouchableOpacity>
    );
  };

  const renderZone = (id, label, icon) => (
    <TouchableOpacity style={[styles.zone, assignments[id] && styles.filledZone]} onPress={() => handleZoneTap(id)}>
        <Text style={styles.zoneLabel}>{label}</Text>
        {assignments[id] ? renderStaffCircle(assignments[id], 55) : <View style={styles.emptyIcon}>{icon}</View>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
            <Text style={styles.title}>PUMP MANAGER</Text>
            <Text style={styles.subtitle}>{date} • {shift}</Text>
        </View>
        <TouchableOpacity onPress={() => setShift(shift === 'Morning' ? 'Evening' : 'Morning')} style={styles.shiftBtn}>
            <RefreshCw size={16} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Map Area */}
        <ViewShot ref={mapRef} options={{ format: "jpg", quality: 0.9 }} style={styles.mapContainer}>
             {/* ... (SAME MAP UI CODE AS BEFORE) ... */}
            <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10}}>{renderZone('Supervisor', 'Supervisor', <ShieldCheck color="#aaa" />)}</View>
            <View style={styles.grid}>
                <View style={styles.col}>{renderZone('N2', 'N2', <Text>⛽</Text>)}{renderZone('N3', 'N3', <Text>⛽</Text>)}</View>
                <View style={styles.mpdBox}><Text style={styles.mpdText}>MPD</Text></View>
                <View style={styles.col}>{renderZone('N1', 'N1', <Text>⛽</Text>)}{renderZone('N4', 'N4', <Text>⛽</Text>)}</View>
            </View>
            <View style={{flexDirection:'row', gap:20, justifyContent:'center'}}>{renderZone('N5', 'H-5', <Text>🪝</Text>)}{renderZone('N6', 'H-6', <Text>🪝</Text>)}</View>
            <View style={{flexDirection:'row', gap:20, justifyContent:'center', marginTop:15}}>{renderZone('Extra', 'Extra', <Plus color="#aaa" />)}{renderZone('Air', 'Air', <Wind color="#aaa" />)}</View>
            <TextInput placeholder="Note..." value={caption} onChangeText={setCaption} style={styles.captionInput} />
            {assignments['absent']?.length > 0 && <View style={styles.absentBox}><Text style={styles.absentTitle}>ABSENT: {assignments['absent'].map(m => m.name).join(', ')}</Text></View>}
        </ViewShot>

        {/* Action Buttons */}
        <View style={styles.actions}>
            <TouchableOpacity onPress={handleAutoAssign} style={[styles.btn, styles.autoBtn]}><RefreshCw color="white" size={20} /><Text style={styles.btnText}>Auto</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSaveMap} style={[styles.btn, styles.saveBtn]}><Save color="white" size={20} /><Text style={styles.btnText}>Save</Text></TouchableOpacity>
        </View>

        {/* Staff Pool */}
        <View style={styles.staffPool}>
            <Text style={styles.poolTitle}>Available Staff ({availablePool.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
                {availablePool.map(staff => <View key={staff.id} style={{marginRight:15}}>{renderStaffCircle(staff, 60)}<Text style={{fontSize:10, textAlign:'center', marginTop:4}}>{staff.name}</Text></View>)}
            </ScrollView>
        </View>

        {/* Absent Zone */}
        <TouchableOpacity style={[styles.absentZone, selectedStaff && styles.absentZoneActive]} onPress={() => handleZoneTap('absent')}>
            <AlertCircle color="#ef4444" size={24} />
            <Text style={styles.absentZoneText}>Mark Absent</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- UPDATED FOOTER --- */}
      <View style={styles.navBar}>
        {/* 1. History Button */}
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
            <Calendar color="#64748b" size={26} />
            <Text style={styles.navText}>History</Text>
        </TouchableOpacity>

        {/* 2. Settings Button (Opens Modal) */}
        <TouchableOpacity style={styles.navItem} onPress={() => setShowSettingsModal(true)}>
            <Settings color="#64748b" size={26} />
            <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* --- SETTINGS MODAL --- */}
      <Modal visible={showSettingsModal} transparent animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
              <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                  
                  {/* Handle Bar */}
                  <View style={styles.modalHandle} />
                  
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Settings</Text>
                      <TouchableOpacity onPress={() => setShowSettingsModal(false)}><X color="#94a3b8" /></TouchableOpacity>
                  </View>

                  {/* Option 1: Add Member */}
                  <TouchableOpacity 
                    style={styles.settingOption} 
                    onPress={() => { setShowSettingsModal(false); navigation.navigate('AddMember'); }}
                  >
                      <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                          <UserPlus color="#2563eb" size={20} />
                      </View>
                      <View style={{flex:1}}>
                          <Text style={styles.optionTitle}>Add New Staff</Text>
                          <Text style={styles.optionSub}>Create, edit or delete members</Text>
                      </View>
                      <ChevronRight color="#cbd5e1" />
                  </TouchableOpacity>

                  {/* Option 2: SMS Configuration (Future) */}
                  <TouchableOpacity style={styles.settingOption} onPress={() => Alert.alert("Coming Soon", "SMS timing features coming soon!")}>
                      <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
                          <MessageSquare color="#9333ea" size={20} />
                      </View>
                      <View style={{flex:1}}>
                          <Text style={styles.optionTitle}>SMS Configuration</Text>
                          <Text style={styles.optionSub}>Set morning/evening auto-send time</Text>
                      </View>
                      <ChevronRight color="#cbd5e1" />
                  </TouchableOpacity>

              </View>
          </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
};

// --- UPDATED STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
  shiftBtn: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 20 },
  
  // Footer Styles
  navBar: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, paddingBottom: 20, elevation: 10 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  
  settingOption: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  optionSub: { fontSize: 12, color: '#94a3b8' },

  // Map Components (Collapsed for brevity)
  mapContainer: { backgroundColor: 'white', margin: 15, padding: 15, borderRadius: 25, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
  grid: { flexDirection: 'row', alignItems: 'center', gap: 15, marginVertical: 10 },
  col: { gap: 10 },
  mpdBox: { width: 100, height: 50, backgroundColor: '#1e293b', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mpdText: { color: 'white', fontWeight: '900',},
  zone: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  filledZone: { borderStyle: 'solid', borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  zoneLabel: { position: 'absolute', top: -8, backgroundColor: '#334155', color: 'white', fontSize: 8, paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  staffCircle: { borderRadius: 50, overflow: 'hidden', borderWidth: 2, borderColor: 'white', backgroundColor: '#ddd' },
  selectedRing: { borderColor: '#22c55e', borderWidth: 4 },
  avatar: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  btn: { flex: 1, flexDirection: 'row', padding: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  autoBtn: { backgroundColor: '#f97316' },
  saveBtn: { backgroundColor: '#10b981' },
  btnText: { color: 'white', fontWeight: 'bold' },
  staffPool: { padding: 20 },
  poolTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10 },
  scrollRow: { flexDirection: 'row' },
  absentBox: { marginTop: 10, width: '100%', padding: 10, backgroundColor: '#fef2f2', borderRadius: 10 },
  absentTitle: { color: '#ef4444', fontSize: 10, fontWeight: 'bold' },
  absentZone: { margin: 20, padding: 15, borderWidth: 2, borderColor: '#fca5a5', borderStyle: 'dashed', borderRadius: 15, flexDirection: 'row', justifyContent: 'center', gap: 10, alignItems: 'center', backgroundColor: '#fff1f2' },
  absentZoneActive: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  absentZoneText: { color: '#ef4444', fontWeight: 'bold' },
  captionInput: { width: '100%', backgroundColor: '#f8fafc', padding: 8, borderRadius: 10, marginTop: 10, fontSize: 12, textAlign: 'center' },
});

export default Dashboard;