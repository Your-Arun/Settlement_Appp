import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from '../api/axiosInstance';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message'; // 👈 Import Toast

const AddMember = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  
  const memberToEdit = route.params?.memberToEdit; 

  const [formData, setFormData] = useState({
    name: memberToEdit?.name || '', 
    role: memberToEdit?.role || 'operator', 
    shift: memberToEdit?.shift || 'morning', 
    phoneNumber: memberToEdit?.phoneNumber || '',
    gender: memberToEdit?.gender || 'male',
  });

  const [image, setImage] = useState(null);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        // 👇 Alert hata kar Toast lagaya
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Sorry, we need gallery permissions!'
        });
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images', 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0]);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Image Error',
        text2: error.message
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phoneNumber) {
      // 👇 Validation Alert -> Toast
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Name & Phone number are required'
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

    if (image) {
      let filename = image.uri.split('/').pop();
      let match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1]}` : `image/jpeg`;

      data.append('avatar', {
        uri: image.uri,
        name: filename,
        type: type
      });
    }

    try {
      if (memberToEdit) {
        // ✅ UPDATE LOGIC
        await axiosInstance.put(`/members/${memberToEdit._id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        // 👇 Success Toast
        Toast.show({
          type: 'success',
          text1: 'Updated!',
          text2: 'Member details updated successfully.'
        });
      } else {
        // ✅ ADD LOGIC
        await axiosInstance.post('/shifting', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        // 👇 Success Toast
        Toast.show({
          type: 'success',
          text1: 'Success!',
          text2: 'New member added successfully.'
        });
      }
      
      navigation.goBack();
    } catch (error) {
      console.error("Submit Error:", error);
      // 👇 Error Toast
      Toast.show({
        type: 'error',
        text1: 'Action Failed',
        text2: 'Could not save member. Check server.'
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{memberToEdit ? "Edit Staff" : "New Staff"}</Text>
      </View>

      <View style={styles.form}>
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {getAvatarSource() ? (
            <Image source={getAvatarSource()} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Feather name="camera" color="#aaa" size={32} />
              <Text style={styles.uploadText}>Upload Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          placeholder="Ex: Rahul Kumar"
          style={styles.input}
          value={formData.name}
          onChangeText={t => setFormData({ ...formData, name: t })}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          placeholder="+91..."
          keyboardType="phone-pad"
          style={styles.input}
          value={formData.phoneNumber}
          onChangeText={t => setFormData({ ...formData, phoneNumber: t })}
        />

        {/* ... (Role, Gender, Shift selectors same as before) ... */}
        
        <Text style={styles.label}>Role</Text>
        <View style={styles.row}>
          {['operator', 'supervisor', 'air boy'].map((r) => (
            <TouchableOpacity 
              key={r}
              onPress={() => setFormData({ ...formData, role: r })} 
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
              key={g}
              onPress={() => setFormData({ ...formData, gender: g })} 
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
              key={s}
              onPress={() => setFormData({ ...formData, shift: s })} 
              style={[styles.chip, formData.shift === s && styles.activeChip]}
            >
              <Text style={formData.shift === s ? styles.activeText : styles.text}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {memberToEdit ? "Update Member" : "Save Member"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 30 },
  title: { fontSize: 24, fontWeight: '900' },
  form: { padding: 20, gap: 15 },
  imagePicker: {
    alignSelf: 'center', zIndex: 10, elevation: 5, position: 'relative', 
    width: 120, height: 120, borderRadius: 60, overflow: 'hidden', 
    backgroundColor: '#f1f5f9', marginBottom: 20, borderWidth: 1, borderColor: '#eee'
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  uploadText: { color: '#aaa', fontSize: 10, marginTop: 5 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: -10, marginTop: 5, marginLeft: 5 },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  submitBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20, height: 50, justifyContent: 'center' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: { paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 25, backgroundColor: '#f8fafc' },
  activeChip: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  text: { color: '#333' },
  activeText: { color: '#fff', fontWeight: 'bold' }
});

export default AddMember;