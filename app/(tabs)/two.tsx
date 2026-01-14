import * as Contacts from 'expo-contacts';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { api } from '../../src/lib/api';
import { Colors, Spacing, Typography } from '../../src/theme';

type Contact = {
  id: string;
  name: string;
  channel: 'PUSH' | 'EMAIL' | 'SMS';
  destination: string;
  status: 'PENDING' | 'CONFIRMED';
  linked_user?: {
    id: string;
    email: string;
  };
};

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Contact Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [channel, setChannel] = useState<'PUSH' | 'EMAIL' | 'SMS'>('PUSH');

  // Device Contacts Import State
  const [deviceContactsModalVisible, setDeviceContactsModalVisible] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await api.getContacts();
      if (error) throw error;
      setContacts(data as Contact[]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleAddContact = async () => {
    if (!newName || !newDestination) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const { data, error } = await api.addContact({
        name: newName,
        destination: newDestination,
        channel: channel,
      });

      if (error) throw error;

      // Trigger invite immediately
      if (data && data.length > 0) {
        const contactId = data[0].id;
        await api.inviteContact(contactId);
      }

      Alert.alert('Success', 'Contact added and invite sent.');
      setModalVisible(false);
      setNewName('');
      setNewDestination('');
      fetchContacts();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleResendInvite = async (contactId: string) => {
    try {
      const { error } = await api.inviteContact(contactId);
      if (error) throw error;
      Alert.alert('Sent', 'Invite sent successfully.');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send invite: ' + error.message);
    }
  };

  const handleImportFromDevice = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Access to contacts was denied. Please enter details manually.');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      if (data.length > 0) {
        setDeviceContacts(data);
        setDeviceContactsModalVisible(true);
      } else {
        Alert.alert('No Contacts', 'No contacts found on this device.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to access contacts.');
    }
  };

  const selectDeviceContact = (contact: Contacts.Contact) => {
    const phone = contact.phoneNumbers?.[0]?.number;
    const email = contact.emails?.[0]?.email;

    // Simple heuristic: Prefer mobile phone -> SMS, then Email -> EMAIL
    if (phone) {
      setNewName(contact.name || 'Unknown');
      setNewDestination(phone);
      setChannel('SMS');
      setDeviceContactsModalVisible(false);
    } else if (email) {
      setNewName(contact.name || 'Unknown');
      setNewDestination(email);
      setChannel('EMAIL');
      setDeviceContactsModalVisible(false);
    } else {
      Alert.alert('Invalid Contact', 'This contact has no phone number or email.');
    }
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.contactName}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {item.linked_user && (
            <View style={styles.appBadge}>
              <Text style={styles.appBadgeText}>✓ Has ImFine</Text>
            </View>
          )}
          <Text style={[styles.status, item.status === 'CONFIRMED' ? styles.statusConfirmed : styles.statusPending]}>
            {item.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING REQUEST'}
          </Text>
        </View>
      </View>
      <Text style={styles.contactDetail}>{item.destination}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm }}>
        <Text style={styles.channelLabel}>
          {item.linked_user ? 'PUSH (In-App)' : item.channel}
        </Text>

        {item.status !== 'CONFIRMED' && (
          <Button
            title="Resend Invite"
            variant="outline"
            onPress={() => handleResendInvite(item.id)}
            style={{ paddingVertical: 4, paddingHorizontal: 12, height: 32, minWidth: undefined }}
            textStyle={{ fontSize: 12 }}
          />
        )}
      </View>
    </View>
  );

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={Typography.h1}>Trusted Contacts</Text>
        <Text style={[Typography.body, styles.subtitle]}>
          These people will be notified if you miss a check-in.
        </Text>
      </View>

      <FlatList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchContacts}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts added yet.</Text>
          </View>
        }
      />

      <Button
        title="Add Contact"
        onPress={() => setModalVisible(true)}
        style={styles.fab}
      />

      {/* Manual Add Contact Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={[Typography.h2, { marginBottom: 0 }]}>Add Contact</Text>
              <Button
                title="Import Device Contact"
                onPress={handleImportFromDevice}
                variant="secondary"
                textStyle={{ fontSize: 12 }}
                style={{ paddingVertical: 6, paddingHorizontal: 12, minWidth: undefined }}
              />
            </View>

            <TextInput
              label="Name"
              value={newName}
              onChangeText={setNewName}
              placeholder="Mom, Alex, etc."
            />

            <View style={styles.channelSelector}>
              <Text style={styles.label}>Channel</Text>
              <View style={styles.channelButtons}>
                {(['PUSH', 'EMAIL', 'SMS'] as const).map((c) => (
                  <Button
                    key={c}
                    title={c}
                    variant={channel === c ? 'primary' : 'outline'}
                    onPress={() => setChannel(c)}
                    style={styles.channelButton}
                    textStyle={{ fontSize: 12 }}
                  />
                ))}
              </View>
            </View>

            <TextInput
              label={channel === 'PUSH' ? 'Expo Push Token' : channel === 'EMAIL' ? 'Email Address' : 'Phone Number'}
              value={newDestination}
              onChangeText={setNewDestination}
              placeholder={
                channel === 'PUSH' ? 'ExponentPushToken[...]' :
                  channel === 'EMAIL' ? 'friend@example.com' :
                    '+1234567890'
              }
              autoCapitalize="none"
              keyboardType={channel === 'SMS' ? 'phone-pad' : channel === 'EMAIL' ? 'email-address' : 'default'}
            />

            {channel === 'PUSH' && (
              <Text style={styles.helperText}>
                Note: Since Android notifications are restricted in Expo Go, you may want to test with EMAIL or SMS contacts, or use a simulator for PUSH.
              </Text>
            )}

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title="Save"
                onPress={handleAddContact}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Device Contacts Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={deviceContactsModalVisible}
        onRequestClose={() => setDeviceContactsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalView, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select a Contact</Text>
            <FlatList
              data={deviceContacts}
              keyExtractor={(item) => (item as any).id || Math.random().toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceContactItem}
                  onPress={() => selectDeviceContact(item)}
                >
                  <Text style={styles.contactName}>{item.name}</Text>
                  {item.phoneNumbers && item.phoneNumbers.length > 0 && <Text style={styles.contactDetail}>{item.phoneNumbers[0].number}</Text>}
                  {item.emails && item.emails.length > 0 && <Text style={styles.contactDetail}>{item.emails[0].email}</Text>}
                </TouchableOpacity>
              )}
            />
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setDeviceContactsModalVisible(false)}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  list: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  contactName: {
    ...Typography.body,
    fontWeight: '600',
  },
  contactDetail: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  channelLabel: {
    ...Typography.caption,
    fontSize: 10,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusConfirmed: {
    backgroundColor: Colors.primaryLight,
    color: Colors.primary,
  },
  statusPending: {
    backgroundColor: '#FFE0B2',
    color: '#F57C00',
  },
  appBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
  },
  fab: {
    marginVertical: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: Spacing.lg,
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
    ...Typography.h2,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
  helperText: {
    ...Typography.caption,
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  channelSelector: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  channelButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  channelButton: {
    flex: 1,
    paddingVertical: 8,
    minHeight: 36,
  },
  deviceContactItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
