import * as Notifications from 'expo-notifications';

/**
 * Schedule a local notification to remind user to check in
 * @param nextCheckInTime - When the next check-in is due
 * @param reminderOffsetHours - How many hours before to remind (0 = when due)
 */
export async function scheduleCheckInReminder(
    nextCheckInTime: Date,
    reminderOffsetHours: number = 0
): Promise<string | null> {
    try {
        // Cancel any existing check-in reminders
        await cancelCheckInReminders();

        // Calculate when to send the reminder
        const reminderTime = new Date(nextCheckInTime.getTime() - (reminderOffsetHours * 60 * 60 * 1000));

        // Don't schedule if reminder time is in the past
        if (reminderTime.getTime() <= Date.now()) {

            return null;
        }

        // Schedule the notification
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: '⏰ Check-in Reminder',
                body: reminderOffsetHours > 0
                    ? `Your check-in is due in ${reminderOffsetHours} hour${reminderOffsetHours > 1 ? 's' : ''}`
                    : 'Time to check in!',
                data: {
                    type: 'CHECKIN_REMINDER',
                    due_at: nextCheckInTime.toISOString(),
                },
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: reminderTime,
            },
        });


        return notificationId;
    } catch (error) {
        console.error('Failed to schedule check-in reminder:', error);
        return null;
    }
}

/**
 * Cancel all scheduled check-in reminders
 */
export async function cancelCheckInReminders(): Promise<void> {
    try {
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

        // Find and cancel check-in reminder notifications
        for (const notification of scheduledNotifications) {
            if (notification.content.data?.type === 'CHECKIN_REMINDER') {
                await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            }
        }
    } catch (error) {
        console.error('Failed to cancel check-in reminders:', error);
    }
}

/**
 * Calculate next check-in time based on last check-in and interval
 */
export function calculateNextCheckInTime(
    lastCheckInTime: Date,
    intervalHours: number
): Date {
    return new Date(lastCheckInTime.getTime() + (intervalHours * 60 * 60 * 1000));
}
