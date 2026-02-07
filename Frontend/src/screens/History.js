import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, Alert, StyleSheet, Modal, Share 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, ChevronLeft, Calendar, X, Share2 } from 'lucide-react-native';
import axiosInstance from '../api/axiosInstance';
import Toast from 'react-native-toast-message';

const History = ({ navigation }) => {
  const [maps, setMaps] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null); // 👈 State for Full Screen View

  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    try {
      const res = await axiosInstance.get('/all-maps');
      if (res.data.success) {
        setMaps(res.data.maps);
      }
    } catch (error) {
      console.log(error);
      Toast.show({ type: 'error', text1: 'Failed to load history' });
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Confirm Delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosInstance.delete(`/delete-map/${id}`);
            setMaps(prev => prev.filter(m => m._id !== id));
            Toast.show({ type: 'success', text1: 'Deleted successfully' });
          } catch (e) {
            Toast.show({ type: 'error', text1: 'Failed to delete' });
          }
        }
      }
    ]);
  };

  // Function to Share Image URL
  const handleShare = async (imageUrl) => {
    try {
      await Share.share({
        message: `Check out this Shift Report: ${imageUrl}`,
        url: imageUrl,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => setSelectedImage(item.image)} // 👈 Click to Open Full View
      style={styles.card}
    >
      <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      
      <View style={styles.info}>
        <View>
            <Text style={styles.date}>{item.date}</Text>
            <View style={[styles.badge, item.shift === 'Morning' ? styles.morning : styles.evening]}>
                <Text style={styles.badgeText}>{item.shift}</Text>
            </View>
        </View>
        
        {/* Delete Button */}
        <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.delBtn}>
            <Trash2 color="#ef4444" size={20} />
        </TouchableOpacity>
      </View>
      {item.caption ? <Text style={styles.caption}>"{item.caption}"</Text> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
      </View>
      
      {maps.length === 0 ? (
          <View style={styles.empty}>
              <Calendar size={50} color="#ccc" />
              <Text style={{color:'#aaa', marginTop:10}}>No saved reports yet.</Text>
          </View>
      ) : (
          <FlatList 
            data={maps} 
            renderItem={renderItem} 
            keyExtractor={item => item._id} 
            contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          />
      )}

      {/* 👇 FULL SCREEN IMAGE MODAL 👇 */}
      <Modal 
        visible={selectedImage !== null} 
        transparent={true} 
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          
          {/* Top Buttons (Close & Share) */}
          <View style={styles.modalControls}>
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.controlBtn}>
              <X color="white" size={24} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => handleShare(selectedImage)} style={styles.controlBtn}>
              <Share2 color="white" size={24} />
            </TouchableOpacity>
          </View>

          {/* Full Image */}
          <Image 
            source={{ uri: selectedImage }} 
            style={styles.fullImage} 
            resizeMode="contain" 
          />
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'white', borderBottomWidth:1, borderColor:'#eee' },
    title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
    
    // Card Styles
    card: { backgroundColor: 'white', borderRadius: 15, marginBottom: 20, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    image: { width: '100%', height: 200, backgroundColor: '#eee' },
    info: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    date: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginTop: 5 },
    morning: { backgroundColor: '#ffedd5' }, 
    evening: { backgroundColor: '#e0e7ff' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#555' },
    caption: { paddingHorizontal: 15, paddingBottom: 15, fontStyle: 'italic', color: '#64748b', fontSize: 12 },
    delBtn: { padding: 10, backgroundColor: '#fef2f2', borderRadius: 10 },
    empty: { flex:1, justifyContent:'center', alignItems:'center' },

    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '80%' },
    modalControls: { position: 'absolute', top: 50, right: 20, flexDirection: 'row', gap: 15, zIndex: 10 },
    controlBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 },
});

export default History;