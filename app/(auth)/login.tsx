import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { supabase } from '../../src/lib/supabase';
import { Colors, Spacing, Typography } from '../../src/theme';

export default function LoginScreen() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert(t('common.error'), t('auth.fill_fields'));
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
                Alert.alert(t('common.success'), t('auth.verification_sent'));
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
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
                        <Text style={Typography.h1}>{isSignUp ? t('auth.signup_title') : t('auth.login_title')}</Text>
                        <Text style={[Typography.body, styles.subtitle]}>
                            {isSignUp ? t('auth.signup_subtitle') : t('auth.login_subtitle')}
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            label={t('auth.email_label')}
                            value={email}
                            onChangeText={setEmail}
                            placeholder={t('auth.email_placeholder')}
                            keyboardType="email-address"
                        />
                        <TextInput
                            label={t('auth.password_label')}
                            value={password}
                            onChangeText={setPassword}
                            placeholder={t('auth.password_placeholder')}
                            secureTextEntry
                        />

                        <Button
                            title={isSignUp ? t('auth.signup_button') : t('auth.login_button')}
                            onPress={handleAuth}
                            loading={loading}
                            style={styles.authButton}
                        />

                        <TouchableOpacity
                            onPress={() => setIsSignUp(!isSignUp)}
                            style={styles.switchContainer}
                        >
                            <Text style={Typography.body}>
                                {isSignUp ? t('auth.already_account') : t('auth.dont_have_account')}
                                <Text style={styles.switchText}>
                                    {isSignUp ? t('auth.login_button') : t('auth.signup_button')}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.disclaimer}>
                            {t('auth.disclaimer')}
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
