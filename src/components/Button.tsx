import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '../theme';

type ButtonProps = {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'text';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
};

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    loading = false,
    disabled = false,
    style,
    textStyle,
}) => {
    const getBackgroundColor = () => {
        if (disabled) return Colors.border;
        switch (variant) {
            case 'primary': return Colors.primary;
            case 'secondary': return Colors.primaryLight;
            case 'outline': return 'transparent';
            case 'text': return 'transparent';
            case 'danger': return Colors.escalated;
            default: return Colors.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return Colors.textSecondary;
        switch (variant) {
            case 'outline': return Colors.primary;
            case 'text': return Colors.primary;
            case 'secondary': return Colors.primary;
            default: return Colors.buttonText;
        }
    };

    const getHeight = () => {
        switch (size) {
            case 'small': return 36;
            case 'large': return 64;
            default: return 56;
        }
    };

    const getPadding = () => {
        switch (size) {
            case 'small': return Spacing.sm;
            case 'large': return Spacing.xl;
            default: return Spacing.lg;
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.button,
                {
                    backgroundColor: getBackgroundColor(),
                    minHeight: getHeight(),
                    paddingHorizontal: getPadding()
                },
                variant === 'outline' && { borderWidth: 1, borderColor: Colors.primary },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    text: {
        ...Typography.button,
    },
});
