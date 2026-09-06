import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { Colors, Radius } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Repeato Production ErrorBoundary Log]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.content}>
              <View style={styles.iconCircle}>
                <AppIcon name="warning-outline" size={32} color={Colors.clay} />
              </View>
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.subTitle}>
                Repeato encountered an unexpected issue. Don&apos;t worry, your tasks are saved locally.
              </Text>
              <Pressable style={styles.btn} onPress={this.handleReset}>
                <Text style={styles.btnText}>Try Again</Text>
              </Pressable>
            </Card.Content>
          </Card>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 18,
    color: Colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  subTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: Colors.marigoldDeep,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  btnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.white,
  },
});
