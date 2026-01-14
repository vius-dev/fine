import React from 'react';
import { StatusBar, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../theme';

type ScreenProps = {
    children: React.ReactNode;
    style?: ViewStyle;
    backgroundColor?: string;
};

export const Screen: React.FC<ScreenProps> = ({
    children,
    style,
    backgroundColor = Colors.background
}) => {
    return (
        <SafeAreaView style={[styles.container, { backgroundColor }]}>
            <StatusBar barStyle="dark-content" />
            <View style={[styles.content, style]}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
});
