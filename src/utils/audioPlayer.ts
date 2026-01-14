import { Audio } from 'expo-av';

// Define available ringtone options with local asset sources
export const RINGTONE_OPTIONS = [
    {
        id: 'default',
        name: 'Default Alert',
        description: 'Standard alarm sound',
        source: require('@/assets/sounds/default.mp3'),
    },
    {
        id: 'urgent',
        name: 'Urgent',
        description: 'More intense alert',
        source: require('@/assets/sounds/urgent.mp3'),
    },
    {
        id: 'gentle',
        name: 'Gentle',
        description: 'Softer alert option',
        source: require('@/assets/sounds/gentle.mp3'),
    },
    {
        id: 'siren',
        name: 'Siren',
        description: 'Emergency siren style',
        source: require('@/assets/sounds/siren.mp3'),
    },
    {
        id: 'chime',
        name: 'Chime',
        description: 'Pleasant chime sound',
        source: require('@/assets/sounds/chime.mp3'),
    },
] as const;

export type RingtoneId = typeof RINGTONE_OPTIONS[number]['id'];

let currentSound: Audio.Sound | null = null;

/**
 * Configure audio mode for emergency alerts
 * - Plays in silent mode
 * - Stays active in background
 * - Maximum priority
 */
async function configureAudioMode() {
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
        });
    } catch (error) {
        console.error('Failed to configure audio mode:', error);
    }
}

/**
 * Play a ringtone with specified settings
 * @param ringtoneId - ID of the ringtone to play
 * @param volume - Volume level (0-100)
 * @param loop - Whether to loop the sound
 * @returns Promise<Audio.Sound | null>
 */
export async function playRingtone(
    ringtoneId: RingtoneId = 'default',
    volume: number = 100,
    loop: boolean = false
): Promise<Audio.Sound | null> {
    try {
        // Stop any currently playing sound
        await stopRingtone();

        // Configure audio mode
        await configureAudioMode();

        // Find the ringtone option
        const ringtone = RINGTONE_OPTIONS.find(r => r.id === ringtoneId);
        if (!ringtone) {
            console.warn(`Ringtone ${ringtoneId} not found, using default`);
        }

        // Load and play the actual audio file
        const { sound } = await Audio.Sound.createAsync(
            ringtone?.source || RINGTONE_OPTIONS[0].source,
            {
                isLooping: loop,
                volume: volume / 100, // Convert 0-100 to 0-1
                shouldPlay: true,
            }
        );

        currentSound = sound;
        return sound;
    } catch (error) {
        console.error('Failed to play ringtone:', error);
        return null;
    }
}

/**
 * Stop the currently playing ringtone
 */
export async function stopRingtone(): Promise<void> {
    try {
        if (currentSound) {
            await currentSound.stopAsync();
            await currentSound.unloadAsync();
            currentSound = null;
        }
    } catch (error) {
        console.error('Failed to stop ringtone:', error);
    }
}

/**
 * Preview a ringtone (plays once, not looping)
 * @param ringtoneId - ID of the ringtone to preview
 * @param volume - Volume level (0-100)
 */
export async function previewRingtone(
    ringtoneId: RingtoneId,
    volume: number = 100
): Promise<void> {
    const sound = await playRingtone(ringtoneId, volume, false);

    // Auto-stop after 3 seconds for preview
    if (sound) {
        setTimeout(async () => {
            await stopRingtone();
        }, 3000);
    }
}

/**
 * Get ringtone option by ID
 */
export function getRingtoneOption(ringtoneId: RingtoneId) {
    return RINGTONE_OPTIONS.find(r => r.id === ringtoneId) || RINGTONE_OPTIONS[0];
}
