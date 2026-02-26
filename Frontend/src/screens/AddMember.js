import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,  StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking, Switch
} from 'react-native';
// 👇 1. Import SafeAreaView
import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from '../api/axiosInstance';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { ShieldAlert } from 'lucide-react-native';

const AddMember = ({ navigation, route }) => {
  const memberToEdit = route.params?.memberToEdit;
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: memberToEdit?.name || '',
    role: memberToEdit?.role || 'operator',
    shift: memberToEdit?.shift || 'morning',
    phoneNumber: memberToEdit?.phoneNumber || '',
    gender: memberToEdit?.gender || 'male',
    nozzleRestriction: memberToEdit?.nozzleRestriction || false,
    hangingRestriction: memberToEdit?.hangingRestriction || false,
  });

  const [errors, setErrors] = useState({});
  const [image, setImage] = useState(null);

  const validate = () => {
    let newErrors = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Full Name is required';
      isValid = false;
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
      isValid = false;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone Number is required';
      isValid = false;
    } else if (!phoneRegex.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Enter a valid 10-digit number';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handlePermissionDenied = (permissionName) => {
    Alert.alert(
      "Permission Required",
      `We need ${permissionName} access to upload photos. Please enable it in settings.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]
    );
  };

  const handleImagePick = () => {
    Alert.alert(
      "Upload Photo",
      "Select source",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: openCamera },
        { text: "Gallery", onPress: openGallery },
      ]
    );
  };

  const openCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        handlePermissionDenied('Camera');
        return;
      }
      let result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, aspect: [1, 1], quality: 0.5,
      });
      if (!result.canceled) setImage(result.assets[0]);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open camera' });
    }
  };

  const openGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        handlePermissionDenied('Gallery');
        return;
      }
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.5,
      });
      if (!result.canceled) setImage(result.assets[0]);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open gallery' });
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Failed',
        text2: 'Please fix the red errors below.'
      });
      return;
    }

    setLoading(true);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('role', formData.role);
    data.append('shift', formData.shift);
    data.append('phoneNumber', formData.phoneNumber);
    data.append('available', 'present');
    data.append('gender', formData.gender);
    data.append('nozzleRestriction', formData.nozzleRestriction); 
    data.append('hangingRestriction', formData.hangingRestriction);

    if (image) {
      let filename = image.uri.split('/').pop();
      let match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1]}` : `image/jpeg`;
      data.append('avatar', { uri: image.uri, name: filename, type });
    }

    try {
      if (memberToEdit) {
        await axiosInstance.put(`/members/${memberToEdit._id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: 'Staff updated successfully',
          position: 'top'
        });
      } else {
        await axiosInstance.post('/shifting', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Toast.show({
          type: 'success',
          text1: 'Created',
          text2: 'New staff added successfully',
          position: 'top'
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Server Error',
        text2: 'Something went wrong.',
        position: 'top'
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvatarSource = () => {
    if (image) return { uri: image.uri };
    if (memberToEdit?.avatar) return { uri: memberToEdit.avatar };
    return null;
  };

  return (
    // 👇 2. SafeAreaView Wrapper (Edges define where to apply padding)
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" color="#333" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>{memberToEdit ? "Edit Staff" : "Add Staff"}</Text>
        </View>

        <View style={styles.form}>
          <TouchableOpacity onPress={handleImagePick} style={styles.imageWrapper}>
            <View style={styles.imageContainer}>
              {getAvatarSource() ? (
                <Image 
                  source={getAvatarSource()} 
                  style={styles.preview} 
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk" 
                />
              ) : (
                <View style={styles.placeholder}>
                  <Feather name="camera" color="#94a3b8" size={32} />
                  <Text style={styles.uploadText}>Tap to Upload</Text>
                </View>
              )}
            </View>
            <View style={styles.editBadge}>
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name <Text style={styles.req}>*</Text></Text>
            <TextInput
              placeholder="Ex: Rahul Kumar"
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={t => {
                setFormData({ ...formData, name: t });
                if (errors.name) setErrors({ ...errors, name: null }); 
              }}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number <Text style={styles.req}>*</Text></Text>
            <TextInput
              placeholder="9876543210"
              keyboardType="phone-pad"
              maxLength={10}
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              value={formData.phoneNumber}
              onChangeText={t => {
                setFormData({ ...formData, phoneNumber: t });
                if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: null });
              }}
            />
            {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
          </View>

          <Text style={styles.label}>Role</Text>
          <View style={styles.row}>
            {['operator', 'supervisor', 'air boy'].map((r) => (
              <TouchableOpacity
                key={r} onPress={() => setFormData({ ...formData, role: r })}
                style={[styles.chip, formData.role === r && styles.activeChip]}
              >
                <Text style={formData.role === r ? styles.activeText : styles.text}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Gender</Text>
          <View style={styles.row}>
            {['male', 'female'].map((g) => (
              <TouchableOpacity
                key={g} onPress={() => setFormData({ ...formData, gender: g })}
                style={[styles.chip, formData.gender === g && styles.activeChip]}
              >
                <Text style={formData.gender === g ? styles.activeText : styles.text}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Shift</Text>
          <View style={styles.row}>
            {['morning', 'evening'].map((s) => (
              <TouchableOpacity
                key={s} onPress={() => setFormData({ ...formData, shift: s })}
                style={[styles.chip, formData.shift === s && styles.activeChip]}
              >
                <Text style={formData.shift === s ? styles.activeText : styles.text}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.restrictionCard}>
            <View style={styles.restrictionHeader}>
              <View style={styles.restrictionTitleRow}>
                <ShieldAlert size={20} color={formData.nozzleRestriction ? "#ef4444" : "#94a3b8"} />
                <Text style={styles.restrictionTitle}>Nozzle Restriction</Text>
              </View>
              <Switch
                value={formData.nozzleRestriction}
                onValueChange={(value) => setFormData({ ...formData, nozzleRestriction: value })}
                trackColor={{ false: '#cbd5e1', true: '#fca5a5' }}
                thumbColor={formData.nozzleRestriction ? '#ef4444' : '#f1f5f9'}
              />
            </View>
            <Text style={styles.restrictionDesc}>
              {formData.nozzleRestriction
                ? '🔒 COMPLETELY RESTRICTED: Cannot work on ANY nozzle (N1-N6). Can only be Extra/Air/Supervisor.'
                : '✅ This member can work on all nozzles'
              }
            </Text>
            {formData.gender === 'female' && !formData.nozzleRestriction && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Female operators are automatically blocked from H5/H6 only
                </Text>
              </View>
            )}
            {formData.gender === 'female' && formData.nozzleRestriction && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Female + Restricted = Blocked from ALL nozzles
                </Text>
              </View>
            )}
          </View>

          <View style={styles.restrictionCard}>
            <View style={styles.restrictionHeader}>
              <View style={styles.restrictionTitleRow}>
                <ShieldAlert size={20} color={formData.hangingRestriction ? "#f59e0b" : "#94a3b8"} />
                <Text style={styles.restrictionTitle}>H5/H6 Restriction</Text>
              </View>
              <Switch
                value={formData.hangingRestriction}
                onValueChange={(value) => setFormData({ ...formData, hangingRestriction: value })}
                trackColor={{ false: '#cbd5e1', true: '#fef3c7' }}
                thumbColor={formData.hangingRestriction ? '#f59e0b' : '#f1f5f9'}
              />
            </View>
            <Text style={styles.restrictionDesc}>
              {formData.hangingRestriction
                ? '🔒 This member is BLOCKED from H5/H6 only'
                : '✅ This member can work on H5/H6'
              }
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtn, loading && styles.disabledBtn]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {memberToEdit ? "Update Staff Details" : "Save Staff Member"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  // 👇 3. Updated Header style (marginTop removed)
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 15 },
  title: { fontSize: 22, fontWeight: '800', color: '#1e293b' },

  form: { padding: 24, paddingBottom: 50 },

  imageWrapper: { alignSelf: 'center', marginBottom: 25 },
  imageContainer: {
    width: 110, height: 110, borderRadius: 55, overflow: 'hidden',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1',
    justifyContent: 'center', alignItems: 'center'
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center' },
  uploadText: { color: '#94a3b8', fontSize: 10, marginTop: 4, fontWeight: '600' },
  editBadge: {
    position: 'absolute', bottom: 0, right: 5, backgroundColor: '#2563eb',
    padding: 6, borderRadius: 15, borderWidth: 2, borderColor: '#fff'
  },

  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  req: { color: '#ef4444' },
  input: {
    backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b'
  },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 2 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#f1f5f9'
  },
  activeChip: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  text: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  activeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  restrictionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  restrictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restrictionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restrictionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  restrictionDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  warningText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
  },

  submitBtn: {
    backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 10, shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
  },
  disabledBtn: { opacity: 0.7, backgroundColor: '#93c5fd' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
});

export default AddMember;