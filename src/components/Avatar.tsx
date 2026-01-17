import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme';

interface AvatarProps {
    uri?: string | null;
    size?: number;
    fallbackInitials?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
    uri,
    size = 40,
    fallbackInitials
}) => {
    const styles = createStyles(size);

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={styles.avatar}
                defaultSource={require('@/assets/images/icon.png')}
            />
        );
    }

    // Blank circle if no avatar and no initials
    if (!fallbackInitials) {
        return <View style={styles.placeholder} />;
    }

    // Show initials if provided
    return (
        <View style={styles.initialsContainer}>
            <Text style={styles.initials}>{fallbackInitials}</Text>
        </View>
    );
};

const createStyles = (size: number) => StyleSheet.create({
    avatar: {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.surface,
    },
    placeholder: {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.border,
    },
    initialsContainer: {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        color: Colors.buttonText,
        fontSize: size * 0.4,
        fontWeight: '600',
    },
});
