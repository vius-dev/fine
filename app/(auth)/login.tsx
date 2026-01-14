import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { supabase } from '../../src/lib/supabase';
import { Colors, Spacing, Typography } from '../../src/theme';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password
                });
                if (error) throw error;
                Alert.alert('Success', 'Verification email sent!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Screen>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={Typography.h1}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
                        <Text style={[Typography.body, styles.subtitle]}>
                            {isSignUp ? 'Sign up to start your safety intervals' : 'Sign in to continue'}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            label="Email Address"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="name@example.com"
                            keyboardType="email-address"
                        />
                        <TextInput
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            secureTextEntry
                        />

                        <Button
                            title={isSignUp ? 'Sign Up' : 'Sign In'}
                            onPress={handleAuth}
                            loading={loading}
                            style={styles.authButton}
                        />

                        <TouchableOpacity
                            onPress={() => setIsSignUp(!isSignUp)}
                            style={styles.switchContainer}
                        >
                            <Text style={Typography.body}>
                                {isSignUp ? 'Already have an account? ' : 'Don\'t have an account? '}
                                <Text style={styles.switchText}>
                                    {isSignUp ? 'Sign In' : 'Sign Up'}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.disclaimer}>
                            By continuing, you agree to our Terms and Privacy Policy.
                            This app is not an emergency service.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingVertical: Spacing.xl,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    subtitle: {
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    form: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    authButton: {
        marginTop: Spacing.lg,
    },
    switchContainer: {
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    switchText: {
        color: Colors.primary,
        fontWeight: '700',
    },
    footer: {
        marginTop: Spacing.xxl,
        alignItems: 'center',
    },
    disclaimer: {
        ...Typography.caption,
        textAlign: 'center',
        color: Colors.textSecondary,
        lineHeight: 18,
    },
});
