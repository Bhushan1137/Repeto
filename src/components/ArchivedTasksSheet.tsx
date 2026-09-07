import React from 'react';
import { View, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { Language, RepeatingTask, CategoryKey } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';

interface ArchivedTasksSheetProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
}

export function ArchivedTasksSheet({ visible, onClose, language }: ArchivedTasksSheetProps) {
  const { archivedTasks, restoreTask, deleteTask } = useTasks();
  const { showToast } = useToast();

  const isHi = language === 'hi';

  const handleRestore = async (taskId: string) => {
    await restoreTask(taskId);
    showToast(isHi ? 'कार्य पुनर्स्थापित किया गया!' : 'Task restored to active list!');
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    showToast(isHi ? 'कार्य स्थायी रूप से हटा दिया गया' : 'Task permanently deleted');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <AppIcon name="archive-outline" size={20} color={Colors.ink} />
              <Text style={styles.headerTitle}>
                {isHi ? `आर्काइव किए गए कार्य (${archivedTasks.length})` : `Archived Tasks (${archivedTasks.length})`}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <AppIcon name="close" size={20} color={Colors.inkSoft} />
            </Pressable>
          </View>

          {/* List */}
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {archivedTasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="archive-outline" size={36} color={Colors.inkFaint} />
                <Text style={styles.emptyTitle}>
                  {isHi ? 'कोई आर्काइव किया गया कार्य नहीं' : 'No Archived Tasks'}
                </Text>
                <Text style={styles.emptySub}>
                  {isHi
                    ? 'जब आप किसी कार्य को आर्काइव करेंगे, तो वह यहाँ दिखाई देगा।'
                    : 'Tasks you archive will appear here instead of being permanently deleted.'}
                </Text>
              </View>
            ) : (
              archivedTasks.map((task) => {
                const cat = CATEGORY_MAP[task.category as CategoryKey] || CATEGORY_MAP['home'];
                return (
                  <Card key={task.id} style={styles.taskCard} mode="elevated">
                    <View style={styles.cardRow}>
                      <View style={styles.iconWrap}>
                        <Text style={styles.icon}>{task.icon || cat.icon}</Text>
                      </View>
                      <View style={styles.infoCol}>
                        <Text style={styles.taskTitle} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text style={styles.taskMeta}>
                          {task.frequencyLabel}
                          {task.amount ? ` • ₹${task.amount.toLocaleString('en-IN')}` : ''}
                        </Text>
                      </View>
                      <View style={styles.actionsRow}>
                        <TouchableRipple
                          style={styles.restoreBtn}
                          onPress={() => handleRestore(task.id)}
                          borderless
                        >
                          <Text style={styles.restoreText}>{isHi ? 'पुनर्स्थापित करें' : 'Restore'}</Text>
                        </TouchableRipple>

                        <TouchableRipple
                          style={styles.deleteBtn}
                          onPress={() => handleDelete(task.id)}
                          borderless
                        >
                          <AppIcon name="trash-outline" size={16} color={Colors.clayDeep} />
                        </TouchableRipple>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '80%',
    minHeight: 320,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.ink,
  },
  closeBtn: {
    padding: 4,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: Colors.ink,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    maxWidth: 260,
  },
  taskCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  infoCol: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  taskMeta: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoreBtn: {
    backgroundColor: Colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  restoreText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: Colors.tealDeep,
  },
  deleteBtn: {
    padding: 6,
  },
});
