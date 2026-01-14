import React from 'react';
import { TextInput as RNTextInput, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';

type TextInputProps = {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    error?: string;
    style?: ViewStyle;
    inputStyle?: TextStyle;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export const TextInput: React.FC<TextInputProps> = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType = 'default',
    autoCapitalize = 'sentences',
    error,
    style,
    inputStyle,
}) => {
    return (
        <View style={[styles.container, style]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <RNTextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                placeholderTextColor={Colors.textSecondary}
                style={[
                    styles.input,
                    error ? { borderColor: Colors.escalated } : {},
                    inputStyle,
                ]}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
    },
    label: {
        ...Typography.caption,
        marginBottom: Spacing.xs,
        color: Colors.text,
        fontWeight: '600',
    },
    input: {
        height: 56,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: Spacing.md,
        fontSize: 16,
        color: Colors.text,
        backgroundColor: Colors.surface,
    },
    errorText: {
        color: Colors.escalated,
        fontSize: 12,
        marginTop: Spacing.xs,
    },
});
