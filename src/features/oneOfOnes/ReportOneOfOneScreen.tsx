import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Image,
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

type ReportSource =
  | 'seen_on_ebay'
  | 'seen_on_whatnot'
  | 'seen_on_fanatics'
  | 'seen_on_facebook'
  | 'seen_on_instagram'
  | 'pulled_by_me'
  | 'other_source';

type EvidenceImage = {
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  uri: string;
};

type FighterSuggestion = {
  id: string;
  name: string;
};

type SetSuggestion = {
  id: string;
  name: string;
};

type CandidateCard = {
  cardId: string | null;
  cardNumber: string | null;
  fighterId: string | null;
  fighterName: string | null;
  id: string;
  isOneOfOneCandidate: boolean;
  isRookie: boolean;
  printRun: string | null;
  setId: string | null;
  subset: string | null;
  variation: string | null;
};

const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUTOCOMPLETE_DELAY_MS = 250;
const AUTOCOMPLETE_LIMIT = 8;
const CANDIDATE_CARD_LIMIT = 75;
const EVIDENCE_VALIDATION_ERROR = 'Please choose a JPG, PNG, or WebP image under 5 MB.';
const EVIDENCE_TOO_LARGE_ERROR = 'Please choose a smaller image. Evidence must be under 5 MB.';
const COMPRESSED_EVIDENCE_TYPE = 'image/jpeg';
const COMPRESSED_EVIDENCE_QUALITY = 0.75;
const MAX_EVIDENCE_LONG_SIDE = 1600;

const REPORT_SOURCE_OPTIONS: { label: string; value: ReportSource }[] = [
  { label: 'Seen on eBay', value: 'seen_on_ebay' },
  { label: 'Seen on Whatnot', value: 'seen_on_whatnot' },
  { label: 'Seen on Fanatics Live', value: 'seen_on_fanatics' },
  { label: 'Seen on Facebook', value: 'seen_on_facebook' },
  { label: 'Seen on Instagram', value: 'seen_on_instagram' },
  { label: 'Pulled by me', value: 'pulled_by_me' },
  { label: 'Other source', value: 'other_source' },
];

function appendOptional(formData: FormData, name: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) formData.append(name, trimmed);
}

function getFileName(uri: string, fallback = 'evidence.jpg') {
  const name = uri.split('/').pop()?.split('?')[0]?.trim();
  return name || fallback;
}

function getAcceptedMimeType(uri: string, fileName?: string | null, mimeType?: string | null) {
  const normalizedType = String(mimeType || '').trim().toLowerCase();
  if (normalizedType === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_EVIDENCE_TYPES.has(normalizedType)) return normalizedType;

  const source = `${fileName || ''} ${uri}`.toLowerCase();
  if (source.match(/\.(jpe?g)(\?|$|\s)/)) return 'image/jpeg';
  if (source.match(/\.(png)(\?|$|\s)/)) return 'image/png';
  if (source.match(/\.(webp)(\?|$|\s)/)) return 'image/webp';

  return null;
}

function getEvidenceExtension(mimeType: string) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function getEvidenceFileName(uri: string, fileName: string | null | undefined, mimeType: string) {
  const fallback = `evidence${getEvidenceExtension(mimeType)}`;
  const name = (fileName || getFileName(uri, fallback)).trim() || fallback;
  const withoutQuery = name.split('?')[0];
  const extension = getEvidenceExtension(mimeType);
  const hasMatchingExtension =
    mimeType === 'image/jpeg'
      ? /\.jpe?g$/i.test(withoutQuery)
      : withoutQuery.toLowerCase().endsWith(extension);

  if (hasMatchingExtension) return withoutQuery;

  const baseName = withoutQuery
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .replace(/\.[^/.]+$/, '');

  return `${baseName || 'evidence'}${extension}`;
}

async function getLocalFileSize(uri: string) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return null;
  }
}

function getResizeActions(width?: number | null, height?: number | null) {
  if (!width || !height) return [];

  const longestSide = Math.max(width, height);
  if (longestSide <= MAX_EVIDENCE_LONG_SIDE) return [];

  if (width >= height) {
    return [{ resize: { width: MAX_EVIDENCE_LONG_SIDE } }];
  }

  return [{ resize: { height: MAX_EVIDENCE_LONG_SIDE } }];
}

function readString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return null;
}

function readBoolean(record: Record<string, unknown> | null, key: string) {
  return record?.[key] === true;
}

function getSearchTerm(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed : '';
}

function normalizeCandidateCard(row: Record<string, unknown>): CandidateCard | null {
  const id = readString(row, ['id']);
  if (!id) return null;

  return {
    cardId: readString(row, ['card_id', 'cardId']),
    cardNumber: readString(row, ['card_number', 'number', 'card_no']),
    fighterId: readString(row, ['fighter_id', 'fighterId']),
    fighterName: readString(row, ['fighter_name', 'name', 'title']),
    id,
    isOneOfOneCandidate: readBoolean(row, 'is_one_of_one_candidate'),
    isRookie: readBoolean(row, 'is_rookie'),
    printRun: readString(row, ['print_run', 'printRun']),
    setId: readString(row, ['set_id', 'setId']),
    subset: readString(row, ['subset']),
    variation: readString(row, ['variation', 'parallel', 'rarity']),
  };
}

function getCandidateMainLine(card: CandidateCard) {
  return [card.subset, card.variation].filter(Boolean).join(' - ') ||
    card.variation ||
    card.subset ||
    card.cardId ||
    card.fighterName ||
    '1-of-1 Candidate';
}

function getCandidateMetaLine(card: CandidateCard) {
  return [
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.printRun ? `/${card.printRun}` : null,
    card.isRookie ? 'Rookie' : null,
    card.fighterName,
  ].filter(Boolean).join(' - ');
}

function candidateMatchesSearch(card: CandidateCard, value: string) {
  const search = value.trim().toLowerCase();
  if (!search) return true;

  return [
    card.cardId,
    card.cardNumber,
    card.fighterName,
    card.printRun,
    card.subset,
    card.variation,
  ].filter(Boolean).join(' ').toLowerCase().includes(search);
}

export function ReportOneOfOneScreen() {
  const [fighterName, setFighterName] = useState('');
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [fighterSuggestions, setFighterSuggestions] = useState<FighterSuggestion[]>([]);
  const [setName, setSetName] = useState('');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [setSuggestions, setSetSuggestions] = useState<SetSuggestion[]>([]);
  const [cardName, setCardName] = useState('');
  const [selectedCandidateCardId, setSelectedCandidateCardId] = useState<string | null>(null);
  const [candidateCards, setCandidateCards] = useState<CandidateCard[]>([]);
  const [candidateCardsLoading, setCandidateCardsLoading] = useState(false);
  const [candidateCardsError, setCandidateCardsError] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceImage, setEvidenceImage] = useState<EvidenceImage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const clearForm = () => {
    setFighterName('');
    setSelectedFighterId(null);
    setFighterSuggestions([]);
    setSetName('');
    setSelectedSetId(null);
    setSetSuggestions([]);
    setCardName('');
    setSelectedCandidateCardId(null);
    setCandidateCards([]);
    setCandidateCardsLoading(false);
    setCandidateCardsError(null);
    setCardNumber('');
    setReportSource(null);
    setSourceUrl('');
    setDescription('');
    setEvidenceImage(null);
  };

  const clearSelectedCandidate = () => {
    setSelectedCandidateCardId(null);
    setCardName('');
    setCardNumber('');
  };

  useEffect(() => {
    if (selectedFighterId) {
      setFighterSuggestions([]);
      return;
    }

    const searchTerm = getSearchTerm(fighterName);
    if (!searchTerm) {
      setFighterSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      const { data, error } = await supabase
        .from('fighters')
        .select('id,name')
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(AUTOCOMPLETE_LIMIT);

      if (!isActive) return;
      if (error) {
        setFighterSuggestions([]);
        return;
      }

      setFighterSuggestions(((data ?? []) as Record<string, unknown>[])
        .map((row) => {
          const id = readString(row, ['id']);
          const name = readString(row, ['name']);
          if (!id || !name) return null;
          return { id, name };
        })
        .filter((item): item is FighterSuggestion => Boolean(item)));
    }, AUTOCOMPLETE_DELAY_MS);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [fighterName, selectedFighterId]);

  useEffect(() => {
    if (selectedSetId) {
      setSetSuggestions([]);
      return;
    }

    const searchTerm = getSearchTerm(setName);
    if (!searchTerm) {
      setSetSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      const { data, error } = await supabase
        .from('sets')
        .select('id,name')
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(AUTOCOMPLETE_LIMIT);

      if (!isActive) return;
      if (error) {
        setSetSuggestions([]);
        return;
      }

      setSetSuggestions(((data ?? []) as Record<string, unknown>[])
        .map((row) => {
          const id = readString(row, ['id']);
          const name = readString(row, ['name']);
          if (!id || !name) return null;
          return { id, name };
        })
        .filter((item): item is SetSuggestion => Boolean(item)));
    }, AUTOCOMPLETE_DELAY_MS);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [setName, selectedSetId]);

  useEffect(() => {
    setCandidateCards([]);
    setCandidateCardsError(null);

    if (!selectedFighterId || !selectedSetId) {
      setCandidateCardsLoading(false);
      return;
    }

    let isActive = true;
    setCandidateCardsLoading(true);

    const loadCandidateCards = async () => {
      const { data, error } = await supabase
        .from('cards')
        .select('id,set_id,fighter_id,fighter_name,card_id,card_number,subset,variation,print_run,is_rookie,is_one_of_one_candidate')
        .eq('set_id', selectedSetId)
        .eq('fighter_id', selectedFighterId)
        .eq('is_one_of_one_candidate', true)
        .order('subset', { ascending: true })
        .order('variation', { ascending: true })
        .order('card_number', { ascending: true })
        .limit(CANDIDATE_CARD_LIMIT);

      if (!isActive) return;
      setCandidateCardsLoading(false);

      if (error) {
        setCandidateCardsError('Candidate cards could not load. You can type the card manually.');
        setCandidateCards([]);
        return;
      }

      setCandidateCards(((data ?? []) as Record<string, unknown>[])
        .map(normalizeCandidateCard)
        .filter((item): item is CandidateCard => Boolean(item)));
    };

    loadCandidateCards();

    return () => {
      isActive = false;
    };
  }, [selectedFighterId, selectedSetId]);

  const chooseEvidenceImage = async () => {
    setError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library access is required to attach evidence.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        setError('Could not read the selected image.');
        return;
      }

      const originalMimeType = getAcceptedMimeType(asset.uri, asset.fileName, asset.mimeType);

      if (!originalMimeType) {
        setError(EVIDENCE_VALIDATION_ERROR);
        return;
      }

      const resizedImage = await ImageManipulator.manipulateAsync(
        asset.uri,
        getResizeActions(asset.width, asset.height),
        {
          compress: COMPRESSED_EVIDENCE_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );
      const compressedFileSize = await getLocalFileSize(resizedImage.uri);

      if (compressedFileSize !== null && compressedFileSize > MAX_EVIDENCE_SIZE) {
        setError(EVIDENCE_TOO_LARGE_ERROR);
        return;
      }

      setEvidenceImage({
        fileName: getEvidenceFileName(asset.uri, asset.fileName, COMPRESSED_EVIDENCE_TYPE),
        fileSize: compressedFileSize,
        mimeType: COMPRESSED_EVIDENCE_TYPE,
        uri: resizedImage.uri,
      });
    } catch {
      setError('Could not open the image picker.');
    }
  };

  const submitReport = async () => {
    const trimmedCardName = cardName.trim();

    setError(null);
    setSuccess(false);

    if (!trimmedCardName) {
      setError('Card name is required.');
      return;
    }

    if (!reportSource) {
      setError('Please choose where this 1-of-1 was seen.');
      return;
    }

    if (evidenceImage) {
      const evidenceType = getAcceptedMimeType(
        evidenceImage.uri,
        evidenceImage.fileName,
        evidenceImage.mimeType,
      );

      if (!evidenceImage.uri || !evidenceType) {
        setError(EVIDENCE_VALIDATION_ERROR);
        return;
      }

      if (evidenceImage.fileSize !== null && evidenceImage.fileSize > MAX_EVIDENCE_SIZE) {
        setError(EVIDENCE_VALIDATION_ERROR);
        return;
      }
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
      formData.append('report_source', reportSource);
      if (selectedCandidateCardId) {
        formData.append('candidate_card_id', selectedCandidateCardId);
      }
      appendOptional(formData, 'fighter_name', fighterName);
      appendOptional(formData, 'set_name', setName);
      appendOptional(formData, 'card_number', cardNumber);
      appendOptional(formData, 'source_url', sourceUrl);
      appendOptional(formData, 'description', description);

      if (evidenceImage) {
        const evidenceType = getAcceptedMimeType(
          evidenceImage.uri,
          evidenceImage.fileName,
          evidenceImage.mimeType,
        );

        if (!evidenceImage.uri || !evidenceType) {
          setError(EVIDENCE_VALIDATION_ERROR);
          return;
        }

        formData.append('evidence', {
          uri: evidenceImage.uri,
          name: getEvidenceFileName(evidenceImage.uri, evidenceImage.fileName, evidenceType),
          type: evidenceType,
        } as any);
      }

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
              <Text style={styles.subtitle}>
                Log a chase-card sighting with source details for verification.
              </Text>
            </View>
          </View>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Sighting submitted for review.</Text>
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>Step 01</Text>
              <Text style={styles.sectionTitle}>Card details</Text>
            </View>
            <Field
              autoCapitalize="words"
              label="Fighter name"
              onChangeText={(value) => {
                setFighterName(value);
                setSelectedFighterId(null);
                clearSelectedCandidate();
              }}
              placeholder="Sean Strickland"
              value={fighterName}
            />
            <SuggestionList
              items={fighterSuggestions}
              renderPrimary={(item) => item.name}
              onSelect={(item) => {
                setFighterName(item.name);
                setSelectedFighterId(item.id);
                setFighterSuggestions([]);
                clearSelectedCandidate();
              }}
            />
            <Field
              autoCapitalize="words"
              label="Set name"
              onChangeText={(value) => {
                setSetName(value);
                setSelectedSetId(null);
                clearSelectedCandidate();
              }}
              placeholder="2025 Topps Chrome UFC"
              value={setName}
            />
            <SuggestionList
              items={setSuggestions}
              renderPrimary={(item) => item.name}
              onSelect={(item) => {
                setSetName(item.name);
                setSelectedSetId(item.id);
                setSetSuggestions([]);
                clearSelectedCandidate();
              }}
            />
            <Field
              autoCapitalize="words"
              label="Card name"
              onChangeText={(value) => {
                setCardName(value);
                setSelectedCandidateCardId(null);
              }}
              placeholder="Crimson Patch Auto"
              required
              value={cardName}
            />
            <CandidatePicker
              cards={candidateCards.filter((card) => candidateMatchesSearch(card, cardName))}
              error={candidateCardsError}
              isLoading={candidateCardsLoading}
              isScoped={Boolean(selectedFighterId && selectedSetId)}
              selectedId={selectedCandidateCardId}
              onSelect={(card) => {
                setSelectedCandidateCardId(card.id);
                setCardName(getCandidateMainLine(card));
                setCardNumber(card.cardNumber ?? '');
              }}
            />
            <Field
              autoCapitalize="characters"
              label="Card number"
              onChangeText={setCardNumber}
              placeholder="CP-SS"
              value={cardNumber}
            />
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>Step 02</Text>
              <Text style={styles.sectionTitle}>Report Source</Text>
            </View>
            <Text style={styles.helperText}>Where did you see this 1-of-1?</Text>
            <OptionGrid
              options={REPORT_SOURCE_OPTIONS}
              selected={reportSource}
              onSelect={setReportSource}
            />
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>Step 03</Text>
              <Text style={styles.sectionTitle}>Source notes</Text>
            </View>
            <Field
              autoCapitalize="none"
              keyboardType="url"
              label="Source link"
              onChangeText={setSourceUrl}
              placeholder="https://..."
              value={sourceUrl}
            />
            <Text style={styles.fieldHint}>Optional link to listing, post, or pull proof.</Text>
            <Field
              label="Notes / description"
              multiline
              onChangeText={setDescription}
              placeholder="Add details that help moderators verify the sighting."
              value={description}
            />
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionKicker}>Step 04</Text>
              <Text style={styles.sectionTitle}>Evidence Image</Text>
            </View>
            <Text style={styles.helperText}>
              Optional screenshot/photo that helps moderators verify the sighting.
            </Text>
            {evidenceImage ? (
              <View style={styles.evidencePreviewRow}>
                <Image
                  resizeMode="cover"
                  source={{ uri: evidenceImage.uri }}
                  style={styles.evidencePreview}
                />
                <View style={styles.evidenceCopy}>
                  <Text numberOfLines={1} style={styles.evidenceTitle}>
                    {evidenceImage.fileName || 'Evidence selected'}
                  </Text>
                  <Text style={styles.evidenceMeta}>
                    {evidenceImage.fileSize === null
                      ? evidenceImage.mimeType
                      : `${evidenceImage.mimeType} - ${(evidenceImage.fileSize / 1024 / 1024).toFixed(1)} MB`}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.evidenceActions}>
              <Pressable
                onPress={chooseEvidenceImage}
                style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.secondaryButtonText}>Choose Image</Text>
              </Pressable>
              {evidenceImage ? (
                <Pressable
                  onPress={() => setEvidenceImage(null)}
                  style={({ pressed }) => [styles.removeButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
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
              {isSubmitting ? 'Submitting...' : 'Submit Sighting'}
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
  selected: T | null;
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

function SuggestionList<T>({
  items,
  onSelect,
  renderPrimary,
}: {
  items: T[];
  onSelect: (item: T) => void;
  renderPrimary: (item: T) => string;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.suggestionList}>
      {items.map((item, index) => {
        const primary = renderPrimary(item);

        return (
          <Pressable
            key={`${primary}-${index}`}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.suggestionRow,
              index === items.length - 1 ? styles.suggestionRowLast : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text numberOfLines={1} style={styles.suggestionPrimary}>
              {primary}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CandidatePicker({
  cards,
  error,
  isLoading,
  isScoped,
  onSelect,
  selectedId,
}: {
  cards: CandidateCard[];
  error: string | null;
  isLoading: boolean;
  isScoped: boolean;
  onSelect: (card: CandidateCard) => void;
  selectedId: string | null;
}) {
  if (!isScoped) {
    return (
      <Text style={styles.fieldHint}>
        Select fighter and set first for tracked 1-of-1 candidate suggestions.
      </Text>
    );
  }

  if (isLoading) {
    return <Text style={styles.fieldHint}>Loading tracked 1-of-1 candidates...</Text>;
  }

  if (error) {
    return <Text style={styles.fieldHint}>{error}</Text>;
  }

  if (cards.length === 0) {
    return (
      <Text style={styles.fieldHint}>
        No tracked 1-of-1 candidates for this fighter/set yet. You can type the card manually.
      </Text>
    );
  }

  return (
    <View style={styles.candidateList}>
      <Text style={styles.candidateListTitle}>Tracked candidates</Text>
      {cards.map((card) => {
        const isSelected = card.id === selectedId;

        return (
          <Pressable
            key={card.id}
            onPress={() => onSelect(card)}
            style={({ pressed }) => [
              styles.candidateRow,
              isSelected ? styles.candidateRowSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.candidateCopy}>
              <Text numberOfLines={1} style={styles.candidateTitle}>
                {getCandidateMainLine(card)}
              </Text>
              <Text numberOfLines={1} style={styles.candidateMeta}>
                {getCandidateMetaLine(card)}
              </Text>
            </View>
            <View style={styles.candidateBadges}>
              {card.printRun ? (
                <Text style={styles.printRunBadge}>/{card.printRun}</Text>
              ) : null}
              {card.isRookie ? (
                <Text style={styles.rookieBadge}>Rookie</Text>
              ) : null}
            </View>
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
    borderTopWidth: 4,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  field: {
    gap: 8,
  },
  fieldHint: {
    color: colors.gray700,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: -4,
  },
  candidateBadges: {
    alignItems: 'flex-end',
    gap: 5,
  },
  candidateCopy: {
    flex: 1,
    minWidth: 0,
  },
  candidateList: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  candidateListTitle: {
    backgroundColor: colors.ink,
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  candidateMeta: {
    color: colors.gray700,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  candidateRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  candidateRowSelected: {
    backgroundColor: '#fff1f1',
  },
  candidateTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  evidenceActions: {
    flexDirection: 'row',
    gap: 9,
  },
  evidenceCopy: {
    flex: 1,
    minWidth: 0,
  },
  evidenceMeta: {
    color: colors.gray700,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  evidencePreview: {
    backgroundColor: '#f1f1ec',
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 62,
    width: 60,
  },
  evidencePreviewRow: {
    alignItems: 'center',
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 10,
  },
  evidenceTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
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
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 52,
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
    backgroundColor: '#fbfaf7',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  optionChipActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  optionTextActive: {
    color: colors.textInverse,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderTopColor: colors.ink,
    borderTopWidth: 4,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  pressed: {
    opacity: 0.65,
  },
  printRunBadge: {
    backgroundColor: colors.red,
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  helperText: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  required: {
    color: colors.red,
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    gap: 13,
  },
  sectionHeader: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 3,
    paddingBottom: 10,
  },
  sectionKicker: {
    color: colors.red,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
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
    backgroundColor: '#f1fff4',
    borderColor: colors.success,
    borderTopColor: colors.success,
    borderTopWidth: 4,
    borderWidth: 1,
    borderRadius: radius.sm,
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
  rookieBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryButtonText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  suggestionList: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: -6,
    overflow: 'hidden',
  },
  suggestionPrimary: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  suggestionRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    minHeight: 46,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
});
