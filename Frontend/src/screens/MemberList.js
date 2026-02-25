import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,  Alert, StyleSheet, TextInput, RefreshControl, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Search, Trash2, Edit3, Phone, ChevronLeft, Shield, Wind, User, Plus, ShieldAlert
} from 'lucide-react-native';
import { Image } from 'expo-image'; 
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axiosInstance from '../api/axiosInstance';
import Toast from 'react-native-toast-message';

const MemberList = () => {
    const navigation = useNavigation();
    const [members, setMembers] = useState([]);
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // --- FETCH MEMBERS ---
    const fetchMembers = async () => {
        try {
            const res = await axiosInstance.get('/shifting');
            // Sort by Name (A-Z)
            const sorted = res.data.sort((a, b) => a.name.localeCompare(b.name));
            setMembers(sorted);
            setFilteredMembers(sorted);
        } catch (error) {
            console.log("Fetch Error", error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load members list',
                position: 'top'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchMembers();
        }, [])
    );

    // --- SEARCH LOGIC ---
    const handleSearch = (text) => {
        setSearchQuery(text);
        if (text) {
            const newData = members.filter(item => {
                const itemData = item.name ? item.name.toUpperCase() : ''.toUpperCase();
                const phoneData = item.phoneNumber ? item.phoneNumber : '';
                const textData = text.toUpperCase();
                return itemData.indexOf(textData) > -1 || phoneData.indexOf(textData) > -1;
            });
            setFilteredMembers(newData);
        } else {
            setFilteredMembers(members);
        }
    };

    // --- DELETE LOGIC ---
    const handleDelete = (id, name) => {
        Alert.alert(
            "Delete Member",
            `Are you sure you want to delete ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await axiosInstance.delete(`/members/${id}`);
                            Toast.show({
                                type: 'success',
                                text1: 'Deleted',
                                text2: `${name} has been removed.`,
                                position: 'top'
                            });
                            fetchMembers();
                        } catch (error) {
                            Toast.show({
                                type: 'error',
                                text1: 'Delete Failed',
                                text2: 'Could not delete member.',
                                position: 'top'
                            });
                        }
                    }
                }
            ]
        );
    };

    // --- RENDER ITEM ---
    const renderItem = ({ item }) => {
        // Role Color Logic
        const isSupervisor = item.role.toLowerCase() === 'supervisor';
        const isAirBoy = item.role.toLowerCase() === 'air boy';

        const roleColor = isSupervisor ? '#9333ea' : isAirBoy ? '#06b6d4' : '#3b82f6';
        const roleBg = isSupervisor ? '#f3e8ff' : isAirBoy ? '#cffafe' : '#dbeafe';
        const RoleIcon = isSupervisor ? Shield : isAirBoy ? Wind : User;

        return (
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        {item.avatar ? (
                            <Image
                            source={{ uri: item.avatar }}
                            style={styles.avatarImage}
                            contentFit="cover"       
                            transition={500}          
                            cachePolicy="memory-disk" 
                        />
                        ) : (
                            <View style={[styles.avatarImage, styles.letterAvatar]}>
                                <Text style={styles.letterText}>
                                    {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Info */}
                    <View style={styles.infoContainer}>
                        <Text style={styles.name}>{item.name}</Text>

                        <View style={styles.row}>
                            <Phone size={12} color="#64748b" />
                            <Text style={styles.phone}>{item.phoneNumber}</Text>
                        </View>

                        {/* ✅ UPDATED: Badge showing logic */}
                        <View style={styles.badgeRow}>
                            {/* Role Badge */}
                            <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
                                <RoleIcon size={10} color={roleColor} />
                                <Text style={[styles.roleText, { color: roleColor }]}>{item.role}</Text>
                            </View>

                            {/* ✅ UPDATED: Show correct restriction badge */}
                            {item.nozzleRestriction === true ? (
                                <View style={styles.restrictionBadge}>
                                    <ShieldAlert size={10} color="#ef4444" />
                                    <Text style={styles.restrictionText}>N1-N6 Block</Text>
                                </View>
                            ) : (item.hangingRestriction === true || item.gender === 'female') ? (
                                <View style={[styles.restrictionBadge, { backgroundColor: '#fef3c7' }]}>
                                    <ShieldAlert size={10} color="#f59e0b" />
                                    <Text style={[styles.restrictionText, { color: '#f59e0b' }]}>No H5/H6</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#f1f5f9' }]}
                            onPress={() => navigation.navigate('AddMember', { memberToEdit: item })}
                        >
                            <Edit3 size={18} color="#334155" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                            onPress={() => handleDelete(item._id, item.name)}
                        >
                            <Trash2 size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft color="#334155" size={24} />
                </TouchableOpacity>
                <Text style={styles.title}>Staff List</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AddMember')} style={styles.addBtn}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Search color="#94a3b8" size={20} />
                <TextInput
                    placeholder="Search by name or phone..."
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearch}
                />
            </View>

            {/* List */}
            {loading ? (
                <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredMembers}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMembers(); }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <User color="#cbd5e1" size={50} />
                            <Text style={styles.emptyText}>No members found</Text>
                        </View>
                    }
                />
            )}
            <Toast />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white',
        borderBottomWidth: 1, borderColor: '#e2e8f0'
    },
    title: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    backBtn: { padding: 5 },
    addBtn: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 10 },

    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        margin: 15, paddingHorizontal: 15, borderRadius: 12, height: 50,
        borderWidth: 1, borderColor: '#e2e8f0'
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#334155' },

    listContent: { paddingHorizontal: 15, paddingBottom: 20 },

    card: {
        backgroundColor: 'white', borderRadius: 16, marginBottom: 12,
        padding: 15, borderWidth: 1, borderColor: '#f1f5f9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },

    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9'
    },
    avatarImage: {
        width: '100%',
        height: '100%'
    },
    letterAvatar: {
        backgroundColor: '#94a3b8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    letterText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },

    infoContainer: { flex: 1, marginLeft: 15 },
    name: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    phone: { fontSize: 12, color: '#64748b', fontWeight: '500' },

    // Badge Styles
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        flexWrap: 'wrap',
    },

    roleBadge: {
        flexDirection: 'row', alignItems: 'center',
        gap: 4, paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 8,
    },
    roleText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

    restrictionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
    restrictionText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#ef4444',
        textTransform: 'uppercase',
    },

    actions: { flexDirection: 'row', gap: 10 },
    actionBtn: { padding: 10, borderRadius: 10 },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#94a3b8', marginTop: 10, fontWeight: 'bold' },
});

export default MemberList;