import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareScrollViewProps extends Omit<ScrollViewProps, 'keyboardShouldPersistTaps'> {
  children: React.ReactNode;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  keyboardShouldPersistTaps?: 'handled' | 'always' | 'never';
}

export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  ...props
}: KeyboardAwareScrollViewProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: bottomPadding + 20 },
        ]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}