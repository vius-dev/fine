export const Colors = {
    // Primary (Calm)
    primary: '#4A6741', // Sage Green
    primaryLight: '#E8F1E4',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A1A1A',
    textSecondary: '#666666',

    // States
    active: '#4A6741',
    grace: '#D97706', // Amber/Orange
    escalated: '#DC2626', // Red
    resolved: '#059669', // Emerald

    // UI Elements
    border: '#E5E5E5',
    buttonText: '#FFFFFF',
    icon: '#666666',
};

export const Typography = {
    h1: {
        fontSize: 32,
        fontWeight: '700' as const,
        color: Colors.text,
    },
    h2: {
        fontSize: 24,
        fontWeight: '600' as const,
        color: Colors.text,
    },
    body: {
        fontSize: 16,
        color: Colors.text,
    },
    caption: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    button: {
        fontSize: 18,
        fontWeight: '600' as const,
    }
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};
