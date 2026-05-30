import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/lib/theme/tokens';
import { buildWebApiUrl } from '@/src/lib/webApi';

type ClaimType = 'i_own_this' | 'i_saw_this' | 'public_listing' | 'pulled_in_break' | 'other';
type SourceType =
  | 'owned_by_me'
  | 'ebay'
  | 'instagram'
  | 'facebook'
  | 'whatnot'
  | 'break_livestream'
  | 'private_sale'
  | 'other';

const CLAIM_OPTIONS: { label: string; value: ClaimType }[] = [
  { label: 'Public Listing', value: 'public_listing' },
  { label: 'Pulled In Break', value: 'pulled_in_break' },
  { label: 'I Own This', value: 'i_own_this' },
  { label: 'I Saw This', value: 'i_saw_this' },
  { label: 'Other', value: 'other' },
];

const SOURCE_OPTIONS: { label: string; value: SourceType }[] = [
  { label: 'eBay', value: 'ebay' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Whatnot', value: 'whatnot' },
  { label: 'Break Livestream', value: 'break_livestream' },
  { label: 'Private Sale', value: 'private_sale' },
  { label: 'Owned By Me', value: 'owned_by_me' },
  { label: 'Other', value: 'other' },
];

function appendOptional(formData: FormData, name: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) formData.append(name, trimmed);
}

export function ReportOneOfOneScreen() {
  const [fighterName, setFighterName] = useState('');
  const [setName, setSetName] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [parallelName, setParallelName] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('public_listing');
  const [sourceType, setSourceType] = useState<SourceType>('ebay');
  const [sourceUrl, setSourceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const clearForm = () => {
    setFighterName('');
    setSetName('');
    setCardName('');
    setCardNumber('');
    setParallelName('');
    setClaimType('public_listing');
    setSourceType('ebay');
    setSourceUrl('');
    setDescription('');
  };

  const submitReport = async () => {
    const trimmedCardName = cardName.trim();

    setError(null);
    setSuccess(false);

    if (!trimmedCardName) {
      setError('Card name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = buildWebApiUrl('/api/one-of-one-reports');

      if (!url) {
        setError('Report API is not configured for this native build.');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        setError('Please sign in again before submitting a report.');
        return;
      }

      const formData = new FormData();
      formData.append('card_name', trimmedCardName);
      formData.append('claim_type', claimType);
      formData.append('source_type', sourceType);
      appendOptional(formData, 'fighter_name', fighterName);
      appendOptional(formData, 'set_name', setName);
      appendOptional(formData, 'card_number', cardNumber);
      appendOptional(formData, 'parallel_name', parallelName);
      appendOptional(formData, 'source_url', sourceUrl);
      appendOptional(formData, 'description', description);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      let responseBody: { error?: string } = {};
      try {
        responseBody = await response.json();
      } catch {}

      if (!response.ok) {
        setError(responseBody.error || 'Could not submit report. Please check the details and try again.');
        return;
      }

      clearForm();
      setSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
            >
              <MaterialCommunityIcons color={colors.ink} name="chevron-left" size={24} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>1-of-1 Tracker</Text>
              <Text style={styles.title}>Report 1-of-1</Text>
              <Text style={styles.subtitle}>Submit a sighting for Society moderation.</Text>
            </View>
          </View>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Report submitted for review.</Text>
              <Text style={styles.successText}>
                Moderators will review the sighting before it appears in the public tracker.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Card details</Text>
            <Field
              autoCapitalize="words"
              label="Fighter name"
              onChangeText={setFighterName}
              placeholder="Sean Strickland"
              value={fighterName}
            />
            <Field
              autoCapitalize="words"
              label="Set name"
              onChangeText={setSetName}
              placeholder="2025 Topps Chrome UFC"
              value={setName}
            />
            <Field
              autoCapitalize="words"
              label="Card name"
              onChangeText={setCardName}
              placeholder="Crimson Patch Auto"
              required
              value={cardName}
            />
            <Field
              autoCapitalize="characters"
              label="Card number"
              onChangeText={setCardNumber}
              placeholder="CP-SS"
              value={cardNumber}
            />
            <Field
              autoCapitalize="words"
              label="Parallel / variation"
              onChangeText={setParallelName}
              placeholder="1/1"
              value={parallelName}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Claim type</Text>
            <OptionGrid
              options={CLAIM_OPTIONS}
              selected={claimType}
              onSelect={setClaimType}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Source type</Text>
            <OptionGrid
              options={SOURCE_OPTIONS}
              selected={sourceType}
              onSelect={setSourceType}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Source notes</Text>
            <Field
              autoCapitalize="none"
              keyboardType="url"
              label="Source URL"
              onChangeText={setSourceUrl}
              placeholder="https://..."
              value={sourceUrl}
            />
            <Field
              label="Notes / description"
              multiline
              onChangeText={setDescription}
              placeholder="Add details that help moderators verify the sighting."
              value={description}
            />
          </View>

          <Pressable
            disabled={isSubmitting}
            onPress={submitReport}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || isSubmitting) ? styles.pressed : null,
            ]}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  required,
  ...props
}: {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url';
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  required?: boolean;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline ? styles.textArea : null]}
        {...props}
      />
    </View>
  );
}

function OptionGrid<T extends string>({
  onSelect,
  options,
  selected,
}: {
  onSelect: (value: T) => void;
  options: { label: string; value: T }[];
  selected: T;
}) {
  return (
    <View style={styles.optionGrid}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.optionChip, isSelected ? styles.optionChipActive : null]}
          >
            <Text style={[styles.optionText, isSelected ? styles.optionTextActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  container: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderColor: colors.danger,
    borderTopColor: colors.danger,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  field: {
    gap: 7,
  },
  header: {
    alignItems: 'flex-start',
    borderBottomColor: colors.ink,
    borderBottomWidth: 2,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  keyboardWrap: {
    flex: 1,
  },
  kicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  label: {
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  optionChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  optionChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionText: {
    color: colors.gray700,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  optionTextActive: {
    color: colors.textInverse,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderTopColor: colors.red,
    borderTopWidth: 3,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  pressed: {
    opacity: 0.65,
  },
  required: {
    color: colors.red,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    gap: 13,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 21,
    textTransform: 'uppercase',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  successBox: {
    backgroundColor: '#dcfce7',
    borderColor: colors.success,
    borderTopColor: colors.success,
    borderTopWidth: 3,
    borderWidth: 1,
    padding: 14,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  successTitle: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  textArea: {
    minHeight: 104,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 31,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
