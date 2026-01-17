import * as Contacts from 'expo-contacts';
import { useFocusEffect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../src/components/Avatar';
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
  user_id?: string;
  linked_user: {
    id: string;
    email: string;
    avatar_url?: string;
  } | null;
  user?: { // For incoming invites
    id: string;
    email: string;
    raw_user_meta_data?: any;
  }
};

export default function ContactsScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'guardians' | 'protecting'>('guardians');

  // Tab 1: My Guardians
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Tab 2: I'm Protecting
  const [pendingInvites, setPendingInvites] = useState<Contact[]>([]);
  const [activeLinks, setActiveLinks] = useState<Contact[]>([]);

  const [loading, setLoading] = useState(true);

  // Add Contact Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [channel, setChannel] = useState<'PUSH' | 'EMAIL' | 'SMS'>('SMS');

  // Edit Contact Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editChannel, setEditChannel] = useState<'PUSH' | 'EMAIL' | 'SMS'>('SMS');

  // Device Contacts Import State
  const [deviceContactsModalVisible, setDeviceContactsModalVisible] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      // Fetch "My Guardians"
      const { data: contactsData, error: contactsError } = await api.getContacts();
      if (contactsError) throw contactsError;
      setContacts(contactsData as Contact[]);

      // Fetch "I'm Protecting"
      const { data: linksData, error: linksError } = await api.getTrustedLinks();
      if (linksError) throw linksError;

      if (linksData) {

        setPendingInvites(linksData.pending || []);
        setActiveLinks(linksData.active || []);
      }

    } catch (error: any) {
      console.error(error);
      Alert.alert(t('common.error'), t('contacts.error_fetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Auto-refresh when screen comes into focus (e.g., from push notification)
  useFocusEffect(
    React.useCallback(() => {
      fetchContacts();
    }, [])
  );

  const handleAddContact = async () => {
    if (!newName || !newDestination) {
      Alert.alert(t('common.error'), t('contacts.fill_fields'));
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
        const { error: inviteError } = await api.inviteContact(contactId);

        if (inviteError) {
          // Contact was added but invite failed
          Alert.alert(
            t('common.success'),
            `Contact added, but invite failed: ${inviteError.message}`
          );
        } else {
          // Both contact and invite succeeded
          Alert.alert(t('common.success'), t('contacts.success_added'));
        }
      } else {
        // Contact added but no ID returned
        Alert.alert(t('common.success'), 'Contact added');
      }

      setModalVisible(false);
      setNewName('');
      setNewDestination('');
      fetchContacts();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleResendInvite = async (contactId: string) => {
    try {
      const { error } = await api.inviteContact(contactId);
      if (error) throw error;
      Alert.alert(t('common.success'), t('contacts.invite_sent'));
    } catch (error: any) {
      Alert.alert(t('common.error'), t('contacts.error_invite') + ': ' + error.message);
    }
  };

  const handleEditPress = (contact: Contact) => {
    setEditingContact(contact);
    setEditName(contact.name);
    setEditDestination(contact.destination);
    setEditChannel(contact.channel);
    setEditModalVisible(true);
  };

  const handleEditContact = async () => {
    if (!editingContact || !editName || !editDestination) {
      Alert.alert(t('common.error'), t('contacts.fill_fields'));
      return;
    }

    try {
      const { error } = await api.updateContact(editingContact.id, {
        name: editName,
        destination: editDestination,
        channel: editChannel,
      });

      if (error) throw error;


      Alert.alert(t('common.success'), t('contacts.success_updated'));
      setEditModalVisible(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    Alert.alert(
      t('contacts.delete_contact'),
      t('contacts.delete_confirmation', { name: contact.name }),
      [
        { text: t('contacts.cancel'), style: 'cancel' },
        {
          text: t('contacts.delete_contact'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await api.deleteContact(contact.id);
              if (error) throw error;
              Alert.alert(t('common.success'), t('contacts.success_deleted'));
              fetchContacts();
            } catch (error: any) {
              Alert.alert(t('common.error'), t('contacts.error_delete') + ': ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleImportFromDevice = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(t('contacts.permission_denied'), t('contacts.access_denied_desc'));
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
        Alert.alert(t('contacts.no_contacts_device'), t('contacts.no_contacts_device')); // Using same key for both title and desc if needed, or just one
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('common.error'), t('contacts.error_access_contacts'));
    }
  };

  const handleConfirmInvite = async (contact: Contact) => {
    try {
      const { error } = await api.confirmContactRequest(contact.id);
      if (error) throw error;
      Alert.alert(t('common.success'), "Invitation accepted!");
      fetchContacts();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleDeclineInvite = async (contact: Contact) => {
    Alert.alert(
      "Decline Invitation",
      "Are you sure you want to decline this invitation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await api.declineContactRequest(contact.id);
              if (error) throw error;
              Alert.alert(t('common.success'), "Invitation declined.");
              fetchContacts();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message);
            }
          }
        }
      ]
    );
  };

  const handleUnlinkUser = async (contact: Contact) => {
    Alert.alert(
      "Stop Protecting",
      `Are you sure you want to stop protecting ${contact.user?.email || 'this user'}? You will no longer receive their alerts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Protecting",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await api.unlinkContact(contact.id);
              if (error) throw error;
              Alert.alert(t('common.success'), "You are no longer a guardian for this user.");
              fetchContacts();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message);
            }
          }
        }
      ]
    );
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
      Alert.alert(t('contacts.invalid_contact'), t('contacts.invalid_contact_desc'));
    }
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar
          uri={item.linked_user?.avatar_url}
          size={48}
          fallbackInitials={item.name?.charAt(0).toUpperCase()}
        />
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <Text style={styles.contactName}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.linked_user && (
              <View style={styles.appBadge}>
                <Text style={styles.appBadgeText}>{t('contacts.has_app')}</Text>
              </View>
            )}
            <Text style={[styles.status, item.status === 'CONFIRMED' ? styles.statusConfirmed : styles.statusPending]}>
              {item.status === 'CONFIRMED' ? t('contacts.status_confirmed') : t('contacts.status_pending')}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.contactDetail}>{item.destination}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm }}>
        <Text style={styles.channelLabel}>
          {item.linked_user ? 'PUSH (In-App)' : item.channel}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {item.status !== 'CONFIRMED' && (
            <Button
              title={t('contacts.resend_invite')}
              variant="outline"
              onPress={() => handleResendInvite(item.id)}
              style={{ paddingVertical: 4, paddingHorizontal: 12, height: 32, minWidth: undefined }}
              textStyle={{ fontSize: 12 }}
            />
          )}
          <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteContact(item)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderGenericItem = (item: Contact, type: 'pending' | 'active') => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar
          uri={item.linked_user?.avatar_url}
          size={48}
          fallbackInitials={item.name?.charAt(0).toUpperCase() || item.linked_user?.email?.charAt(0).toUpperCase()}
        />
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <Text style={styles.contactName}>{item.name || item.linked_user?.email || 'Unknown User'}</Text>
          <Text style={styles.contactDetail}>{item.linked_user?.email || 'FineApp User'}</Text>
        </View>
        {type === 'pending' && <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>INVITE</Text></View>}
        {type === 'active' && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.sm, gap: 8 }}>
        {type === 'pending' ? (
          <>
            <Button
              title="Decline"
              variant="outline"
              onPress={() => handleDeclineInvite(item)}
              style={{ paddingVertical: 6, minWidth: 80 }}
              textStyle={{ color: Colors.escalated, fontSize: 12 }}
            />
            <Button
              title="Accept"
              onPress={() => handleConfirmInvite(item)}
              style={{ paddingVertical: 6, minWidth: 80 }}
              textStyle={{ fontSize: 12 }}
            />
          </>
        ) : (
          <Button
            title="Stop Protecting"
            variant="outline"
            onPress={() => handleUnlinkUser(item)}
            style={{ paddingVertical: 6 }}
            textStyle={{ color: Colors.escalated, fontSize: 12 }}
          />
        )}
      </View>
    </View>
  )

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={Typography.h1}>{t('contacts.title')}</Text>
        <Text style={[Typography.body, styles.subtitle]}>
          {t('contacts.subtitle')}
        </Text>

        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'guardians' && styles.segmentActive]}
            onPress={() => setActiveTab('guardians')}
          >
            <Text style={[styles.segmentText, activeTab === 'guardians' && styles.segmentTextActive]}>My Guardians</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'protecting' && styles.segmentActive]}
            onPress={() => setActiveTab('protecting')}
          >
            <Text style={[styles.segmentText, activeTab === 'protecting' && styles.segmentTextActive]}>I'm Protecting</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'guardians' ? (
        <>
          <FlatList
            data={contacts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={fetchContacts}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('contacts.no_contacts')}</Text>
              </View>
            }
          />
          <Button
            title={t('contacts.add_contact')}
            onPress={() => setModalVisible(true)}
            style={styles.fab}
          />
        </>
      ) : (
        <FlatList
          // Merge lists with headers? Or just sections.
          // Let's do a simple vertical scroll with headers manually inserted or filtered data.
          // Actually, keep it simple.
          data={[
            ...pendingInvites.map(i => ({ ...i, type: 'pending' as const })),
            ...activeLinks.map(i => ({ ...i, type: 'active' as const }))
          ]}
          renderItem={({ item }) => renderGenericItem(item, item.type)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchContacts}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>You are not protecting anyone yet.</Text>
              <Text style={[styles.emptyText, { fontSize: 12, marginTop: 8 }]}>Invites sent to your email/phone will appear here.</Text>
            </View>
          }
        />
      )}

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
              <Text style={[Typography.h2, { marginBottom: 0 }]}>{t('contacts.add_contact')}</Text>
              <Button
                title={t('contacts.import_device_contact')}
                onPress={handleImportFromDevice}
                variant="secondary"
                textStyle={{ fontSize: 12 }}
                style={{ paddingVertical: 6, paddingHorizontal: 12, minWidth: undefined }}
              />
            </View>

            <TextInput
              label={t('contacts.name')}
              value={newName}
              onChangeText={setNewName}
              placeholder="Mom, Alex, etc."
            />

            <View style={styles.channelSelector}>
              <Text style={styles.label}>{t('contacts.channel')}</Text>
              <View style={styles.channelButtons}>
                {(['EMAIL', 'SMS'] as const).map((c) => (
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
              label={channel === 'EMAIL' ? t('contacts.email_label') : t('contacts.phone_label')}
              value={newDestination}
              onChangeText={setNewDestination}
              placeholder={
                channel === 'EMAIL' ? 'friend@example.com' :
                  '+1234567890'
              }
              autoCapitalize="none"
              keyboardType={channel === 'SMS' ? 'phone-pad' : channel === 'EMAIL' ? 'email-address' : 'default'}
            />

            <View style={styles.modalButtons}>
              <Button
                title={t('contacts.cancel')}
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title={t('contacts.save')}
                onPress={handleAddContact}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={[Typography.h2, { marginBottom: Spacing.md }]}>{t('contacts.edit_contact')}</Text>

            <TextInput
              label={t('contacts.name')}
              value={editName}
              onChangeText={setEditName}
              placeholder="Mom, Alex, etc."
            />

            <View style={styles.channelSelector}>
              <Text style={styles.label}>{t('contacts.channel')}</Text>
              <View style={styles.channelButtons}>
                {(['PUSH', 'EMAIL', 'SMS'] as const).map((c) => (
                  <Button
                    key={c}
                    title={c}
                    variant={editChannel === c ? 'primary' : 'outline'}
                    onPress={() => setEditChannel(c)}
                    style={styles.channelButton}
                    textStyle={{ fontSize: 12 }}
                  />
                ))}
              </View>
            </View>

            <TextInput
              label={editChannel === 'PUSH' ? 'Expo Push Token' : editChannel === 'EMAIL' ? 'Email Address' : 'Phone Number'}
              value={editDestination}
              onChangeText={setEditDestination}
              placeholder={
                editChannel === 'PUSH' ? 'ExponentPushToken[...]' :
                  editChannel === 'EMAIL' ? 'friend@example.com' :
                    '+1234567890'
              }
              autoCapitalize="none"
              keyboardType={editChannel === 'SMS' ? 'phone-pad' : editChannel === 'EMAIL' ? 'email-address' : 'default'}
            />

            {editingContact?.linked_user && editDestination !== editingContact.destination && (
              <Text style={[styles.helperText, { color: Colors.grace }]}>
                {t('contacts.linked_user_warning')}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <Button
                title={t('contacts.cancel')}
                variant="outline"
                onPress={() => setEditModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title={t('contacts.save_changes')}
                onPress={handleEditContact}
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
            <Text style={styles.modalTitle}>{t('contacts.import_device_contact')}</Text>
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
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 18,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12, // slightly rounded
    padding: 4,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontWeight: '600',
    color: Colors.textSecondary,
    fontSize: 13,
  },
  segmentTextActive: {
    color: 'white',
  },
  pendingBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1565C0',
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
  },
});
