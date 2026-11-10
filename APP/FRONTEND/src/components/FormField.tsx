import { Feather } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, spacing } from '@/constants/theme';

interface FormFieldProps {
  label: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
  hint?: string;
  maxLength?: number;
  editable?: boolean;
  rightElement?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  autoCapitalize,
  autoComplete,
  error,
  hint,
  maxLength,
  editable = true,
  rightElement,
  style,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          multiline && styles.multilineWrap,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={[styles.input, multiline && styles.multiline]}
          secureTextEntry={secureTextEntry && hidden}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((current) => !current)}
            hitSlop={8}
            style={styles.adornment}
          >
            <Feather
              name={hidden ? 'eye' : 'eye-off'}
              size={18}
              color={colors.muted}
            />
          </Pressable>
        ) : (
          rightElement
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {multiline && maxLength ? (
        <Text style={styles.counter}>
          {(value ?? '').length}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy900,
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    borderColor: colors.teal600,
  },
  inputError: {
    borderColor: colors.red700,
  },
  multilineWrap: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 0,
    minHeight: 46,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  adornment: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.red700,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
  },
});
