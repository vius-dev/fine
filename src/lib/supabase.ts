import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';

// SecureStore has a 2048 byte limit per item
// This adapter chunks large values to avoid the warning
const CHUNK_SIZE = 2000; // Leave some buffer

const ChunkedSecureStoreAdapter = {
    async getItem(key: string): Promise<string | null> {
        try {
            // Try to get the main item first
            const mainValue = await SecureStore.getItemAsync(key);

            // Check if it's chunked (has metadata)
            const chunkCountKey = `${key}_chunks`;
            const chunkCountStr = await SecureStore.getItemAsync(chunkCountKey);

            if (!chunkCountStr) {
                // Not chunked, return as-is
                return mainValue;
            }

            // Reconstruct from chunks
            const chunkCount = parseInt(chunkCountStr, 10);
            const chunks: string[] = [];

            for (let i = 0; i < chunkCount; i++) {
                const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
                if (chunk) {
                    chunks.push(chunk);
                }
            }

            return chunks.join('');
        } catch (error) {
            console.error('Error reading from SecureStore:', error);
            return null;
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        try {
            // If value is small enough, store directly
            if (value.length <= CHUNK_SIZE) {
                await SecureStore.setItemAsync(key, value);
                // Clean up any existing chunks
                await SecureStore.deleteItemAsync(`${key}_chunks`);
                return;
            }

            // Value is too large, chunk it
            const chunks: string[] = [];
            for (let i = 0; i < value.length; i += CHUNK_SIZE) {
                chunks.push(value.slice(i, i + CHUNK_SIZE));
            }

            // Store chunks
            for (let i = 0; i < chunks.length; i++) {
                await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
            }

            // Store chunk count metadata
            await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());
        } catch (error) {
            console.error('Error writing to SecureStore:', error);
        }
    },

    async removeItem(key: string): Promise<void> {
        try {
            // Remove main item
            await SecureStore.deleteItemAsync(key);

            // Check if chunked and remove chunks
            const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
            if (chunkCountStr) {
                const chunkCount = parseInt(chunkCountStr, 10);
                for (let i = 0; i < chunkCount; i++) {
                    await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
                }
                await SecureStore.deleteItemAsync(`${key}_chunks`);
            }
        } catch (error) {
            console.error('Error removing from SecureStore:', error);
        }
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ChunkedSecureStoreAdapter as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
