import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, radius, spacing, typography } from '@/theme/tokens';
import { useSession } from '@/lib/auth/SessionContext';
import {
  isPicksClosedError,
  logPickError,
  PICK_METHODS,
  recomputePickEntry,
  savePick,
  usePicksFlowData,
  type FightSlot,
  type FlowFight,
  type FlowFighter,
  type FlowPick,
  type PickMethod,
  type PicksFlowData,
} from '@/lib/fantasy/picksFlow';
import {
  ageFromDateOfBirth,
  fighterInitials,
  formatRecord,
  formatText,
  MISSING,
  parseLastFive,
  pickPoints,
  roundOptions,
  splitFighterName,
  type FormResult,
} from '@/lib/fantasy/pickDisplay';

// Displayed uppercase by the label text variant; the database spelling is what
// PICK_METHODS carries and what gets stored.
const METHOD_LABELS: Record<PickMethod, string> = {
  'KO/TKO': 'KO/TKO',
  Submission: 'Submission',
  Decision: 'Decision',
};

const CLOSE_TARGET = 44;
const CLOSE_ICON_SIZE = 24;

// Every block on this screen is a fixed height, so picking a winner, a method
// or a round can never move anything vertically.
const PHOTO_HEIGHT = 160;
const GIVEN_NAME_HEIGHT = 16;
const RECORD_HEIGHT = 16;
const FORM_SQUARE = 18;
const FORM_ROW_HEIGHT = FORM_SQUARE;
const TAPE_ROW_HEIGHT = 28;
const CHIP_ROW_HEIGHT = 34;
const ERROR_LINE_HEIGHT = 20;
const PRIMARY_BUTTON_HEIGHT = 40;
const BOTTOM_BAR_HEIGHT = 60;

// Reserved for a W square — used nowhere else in the app.
const FORM_WIN_COLOR = '#1E8E3E';
const FORM_COLORS: Record<FormResult, string> = {
  W: FORM_WIN_COLOR,
  L: colors.brandRed,
  D: colors.textSecondary,
  N: colors.textSecondary,
};

const DECISION_ROUND_NOTE = 'No round — decision goes the distance';

type Draft = {
  slot: FightSlot | null;
  method: PickMethod | null;
  round: number | null;
};

const EMPTY_DRAFT: Draft = { slot: null, method: null, round: null };

function draftFromPick(fight: FlowFight, pick: FlowPick | undefined): Draft {
  if (!pick) {
    return EMPTY_DRAFT;
  }

  let slot: FightSlot | null = null;
  if (pick.picked_fighter_id && pick.picked_fighter_id === fight.fighter1_id) {
    slot = 'fighter1';
  } else if (pick.picked_fighter_id && pick.picked_fighter_id === fight.fighter2_id) {
    slot = 'fighter2';
  }

  const method = PICK_METHODS.find((candidate) => candidate === pick.picked_method) ?? null;
  // A Decision has no round, so a stored one is never restored alongside it.
  const round = method && method !== 'Decision' ? pick.picked_round : null;

  return { slot, method, round };
}

export function FightPickScreen({ eventId, focusFightId }: { eventId: string; focusFightId?: string }) {
  const router = useRouter();
  const query = usePicksFlowData(eventId);

  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/fantasy');
    }
  }, [router]);

  if (query.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !query.data || query.data.fights.length === 0) {
    if (query.isError) {
      logPickError('load', query.error);
    }
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            {query.isError ? 'Could not load this card.' : 'This event has no fights yet.'}
          </Text>
          <Button variant="outline" label="Back" onPress={leave} />
        </View>
      </Screen>
    );
  }

  return <FightPickFlow eventId={eventId} data={query.data} onLeave={leave} focusFightId={focusFightId} />;
}

function FightPickFlow({
  eventId,
  data,
  onLeave,
  focusFightId,
}: {
  eventId: string;
  data: PicksFlowData;
  onLeave: () => void;
  focusFightId?: string;
}) {
  const router = useRouter();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { fights, fightersById } = data;

  // Opened from the summary at one fight: single-edit mode, saving returns
  // there instead of advancing through the rest of the card.
  const isFocusMode = focusFightId != null;

  // Opens at the requested fight in focus mode; otherwise the first fight
  // without a pick, or fight 1 if the card is already complete.
  const [index, setIndex] = useState(() => {
    if (focusFightId) {
      const requested = fights.findIndex((fight) => fight.id === focusFightId);
      if (requested !== -1) {
        return requested;
      }
    }
    const firstUnpicked = fights.findIndex((fight) => !data.picksByFightId[fight.id]);
    return firstUnpicked === -1 ? 0 : firstUnpicked;
  });
  const [savedPicks, setSavedPicks] = useState<Record<string, FlowPick>>(() => data.picksByFightId);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(fights.map((fight) => [fight.id, draftFromPick(fight, data.picksByFightId[fight.id])])),
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fight = fights[index];
  const draft = drafts[fight.id] ?? EMPTY_DRAFT;
  const isLastFight = index === fights.length - 1;
  const savedCount = useMemo(() => fights.filter((row) => savedPicks[row.id]).length, [fights, savedPicks]);

  const fighter1 = fight.fighter1_id ? (fightersById[fight.fighter1_id] ?? null) : null;
  const fighter2 = fight.fighter2_id ? (fightersById[fight.fighter2_id] ?? null) : null;

  // Only the next fight's two images are warmed — never the whole card.
  useEffect(() => {
    const nextFight = fights[index + 1];
    if (!nextFight) {
      return;
    }
    const urls = [nextFight.fighter1_id, nextFight.fighter2_id]
      .map((id) => (id ? fightersById[id]?.image_url : null))
      .filter((url): url is string => !!url);
    if (urls.length > 0) {
      // A warm cache is an optimisation; a failed prefetch must not surface.
      Image.prefetch(urls).catch((error) => logPickError('prefetch', error));
    }
  }, [index, fights, fightersById]);

  function updateDraft(next: Partial<Draft>) {
    setErrorMessage(null);
    setDrafts((current) => ({ ...current, [fight.id]: { ...(current[fight.id] ?? EMPTY_DRAFT), ...next } }));
  }

  function handleMethod(method: PickMethod) {
    // Method is optional, so tapping the chosen chip again clears it — and with
    // it the round, which a Decision never has and no method at all disables.
    const nextMethod = draft.method === method ? null : method;
    updateDraft({ method: nextMethod, round: nextMethod && nextMethod !== 'Decision' ? draft.round : null });
  }

  function leaveFlow() {
    // The Event landing counts picks and reads the pick entry — both just moved.
    queryClient.invalidateQueries({ queryKey: ['fantasy'] });
    onLeave();
  }

  function finishToSummary() {
    queryClient.invalidateQueries({ queryKey: ['fantasy'] });
    router.replace(`/picks/${eventId}/summary`);
  }

  async function handlePrimary() {
    if (!draft.slot || !userId || saving) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await savePick({
        userId,
        fight,
        slot: draft.slot,
        method: draft.method,
        round: draft.round,
        isCaptain: savedPicks[fight.id]?.is_captain ?? false,
      });
      await recomputePickEntry(eventId);

      setSavedPicks((current) => ({
        ...current,
        [fight.id]: {
          fight_id: fight.id,
          picked_fighter_id: draft.slot === 'fighter1' ? fight.fighter1_id : fight.fighter2_id,
          picked_method: draft.method,
          picked_round: draft.round,
          is_captain: current[fight.id]?.is_captain ?? false,
        },
      }));

      if (isFocusMode) {
        queryClient.invalidateQueries({ queryKey: ['fantasy'] });
        router.back();
        return;
      }
      if (isLastFight) {
        finishToSummary();
        return;
      }
      setIndex((current) => current + 1);
    } catch (error) {
      logPickError('save', error);
      if (isPicksClosedError(error)) {
        Alert.alert('Picks are closed', 'Picks for this event have closed, so this one could not be saved.', [
          { text: 'OK', onPress: leaveFlow },
        ]);
        return;
      }
      setErrorMessage('Could not save that pick. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const points = pickPoints(draft.slot != null, draft.method, draft.round);
  const progressPercent = fights.length > 0 ? Math.round((savedCount / fights.length) * 100) : 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="label" color="textSecondary">
          Fight {index + 1} of {fights.length}
        </Text>
        <Pressable
          onPress={onLeave}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close picks"
          disabled={saving}
        >
          <Ionicons name="close" size={CLOSE_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.body}>
        <View style={styles.tiles}>
          <FighterTile
            fallbackName={fight.fighter1}
            fighter={fighter1}
            selected={draft.slot === 'fighter1'}
            dimmed={draft.slot === 'fighter2'}
            onPress={() => updateDraft({ slot: 'fighter1' })}
          />
          <FighterTile
            fallbackName={fight.fighter2}
            fighter={fighter2}
            selected={draft.slot === 'fighter2'}
            dimmed={draft.slot === 'fighter1'}
            onPress={() => updateDraft({ slot: 'fighter2' })}
          />
        </View>

        <TaleOfTheTape fighter1={fighter1} fighter2={fighter2} />

        <View style={styles.pickRow}>
          <Text variant="label" color="textSecondary" style={styles.pickRowLabel}>
            Method
          </Text>
          <View style={styles.chips}>
            {PICK_METHODS.map((method) => (
              <SelectChip
                key={method}
                label={METHOD_LABELS[method]}
                selected={draft.method === method}
                onPress={() => handleMethod(method)}
              />
            ))}
          </View>
        </View>

        {/* The round row keeps its height in every state; a Decision replaces
            the chips rather than removing the row. */}
        <View style={styles.pickRow}>
          <Text variant="label" color="textSecondary" style={styles.pickRowLabel}>
            Round
          </Text>
          <View style={styles.chips}>
            {draft.method === 'Decision' ? (
              <Text variant="body" color="textSecondary" style={styles.decisionNote} numberOfLines={1}>
                {DECISION_ROUND_NOTE}
              </Text>
            ) : (
              roundOptions(fight.is_five_round_fight).map((round) => (
                <SelectChip
                  key={round}
                  label={String(round)}
                  selected={draft.round === round}
                  disabled={!draft.method}
                  onPress={() => updateDraft({ round: draft.round === round ? null : round })}
                />
              ))
            )}
          </View>
        </View>
      </View>

      {/* Always rendered, blank when there is nothing to say, so clearing an
          error on the next tap cannot shift the bar below it. */}
      <Text variant="body" color="brandRed" style={styles.errorLine} numberOfLines={1}>
        {errorMessage ?? ''}
      </Text>

      <View style={styles.bottomBar}>
        <Text variant="numeric">{points == null ? MISSING : `${points} pts`}</Text>
        <Button
          label={isFocusMode ? 'Save' : isLastFight ? 'Review picks' : 'Next fight'}
          onPress={handlePrimary}
          loading={saving}
          disabled={!draft.slot || saving}
          style={[styles.primaryButton, !draft.slot && styles.primaryButtonDisabled]}
        />
      </View>
    </Screen>
  );
}

function FighterTile({
  fallbackName,
  fighter,
  selected,
  dimmed,
  onPress,
}: {
  fallbackName: string;
  fighter: FlowFighter | null;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  // The fight row's own text name is the fallback when the fighter row (or its
  // name) is missing, so a tile is never nameless.
  const displayName = fighter?.name?.trim() || fallbackName;
  const { given, surname } = splitFighterName(displayName);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, selected && styles.tileSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={displayName}
    >
      <View style={dimmed ? styles.tileContentDimmed : undefined}>
        {fighter?.image_url ? (
          // No fill behind the photo: the cut-out sits straight on the white
          // screen, anchored to the bottom so both shoulders share a baseline.
          <Image
            source={{ uri: fighter.image_url }}
            style={styles.photo}
            contentFit="contain"
            contentPosition="bottom"
            transition={0}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text variant="heading" color="textSecondary">
              {fighterInitials(displayName)}
            </Text>
          </View>
        )}
        <Text variant="heading" style={styles.surname} numberOfLines={1}>
          {surname}
        </Text>
        {/* Rendered even when a fighter has no given name, so a one-word name
            cannot make its tile shorter than the other. */}
        <Text variant="body" color="textSecondary" style={styles.givenName} numberOfLines={1}>
          {given}
        </Text>
        <Text variant="body" style={styles.record} numberOfLines={1}>
          {formatRecord(fighter)}
        </Text>
        <FormIndicator lastFive={fighter?.last_five ?? null} />
      </View>
    </Pressable>
  );
}

// Fixed-height row regardless of how many results there are — including zero,
// which is every fighter's state until the backfill job runs.
function FormIndicator({ lastFive }: { lastFive: string | null }) {
  const results = parseLastFive(lastFive);

  return (
    <View style={styles.formRow}>
      {results.map((result, position) => (
        <View key={`${position}-${result}`} style={[styles.formSquare, { backgroundColor: FORM_COLORS[result] }]}>
          <Text variant="label" color="surface" style={styles.formSquareLabel}>
            {result}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TaleOfTheTape({ fighter1, fighter2 }: { fighter1: FlowFighter | null; fighter2: FlowFighter | null }) {
  // Age only needs to be correct as of when this screen was opened — it can't
  // change mid-session, so it's snapshotted once at mount rather than read
  // impurely on every render.
  const [nowMs] = useState(() => Date.now());
  const age1 = ageFromDateOfBirth(fighter1?.date_of_birth, nowMs);
  const age2 = ageFromDateOfBirth(fighter2?.date_of_birth, nowMs);

  const rows = [
    { label: 'Height', left: formatText(fighter1?.height), right: formatText(fighter2?.height) },
    { label: 'Reach', left: formatText(fighter1?.reach), right: formatText(fighter2?.reach) },
    { label: 'Age', left: age1 == null ? MISSING : String(age1), right: age2 == null ? MISSING : String(age2) },
    { label: 'Nationality', left: formatText(fighter1?.nationality), right: formatText(fighter2?.nationality) },
  ];

  return (
    <View style={styles.tape}>
      {rows.map((row, position) => (
        <View key={row.label} style={[styles.tapeRow, position > 0 && styles.tapeRowDivided]}>
          <Text variant="body" style={styles.tapeValueLeft} numberOfLines={1}>
            {row.left}
          </Text>
          <Text variant="label" color="textSecondary" style={styles.tapeLabel} numberOfLines={1}>
            {row.label}
          </Text>
          <Text variant="body" style={styles.tapeValueRight} numberOfLines={1}>
            {row.right}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SelectChip({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
    >
      <Text
        variant="label"
        color={disabled ? 'textSecondary' : selected ? 'surface' : 'textPrimary'}
        style={styles.chipLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  centeredText: {
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    // The close control keeps its full 44pt box while its glyph still lines up
    // with the screen's 16pt gutter.
    paddingRight: spacing.lg - (CLOSE_TARGET - CLOSE_ICON_SIZE) / 2,
    height: CLOSE_TARGET,
  },
  close: {
    width: CLOSE_TARGET,
    height: CLOSE_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.brandRed,
  },
  body: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    // Always 3pt wide, transparent when unselected, so selecting never shifts
    // the layout.
    borderWidth: borderWidths.emphasis,
    borderColor: 'transparent',
    borderRadius: radius.none,
    padding: spacing.xs,
  },
  tileSelected: {
    borderColor: colors.brandRed,
  },
  tileContentDimmed: {
    opacity: 0.35,
  },
  // No background fill — a cut-out portrait sits on the white screen. The
  // height is fixed so both tiles stay aligned whatever the image is.
  photo: {
    width: '100%',
    height: PHOTO_HEIGHT,
  },
  // The null-image placeholder keeps the neutral block it always had.
  photoPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surname: {
    marginTop: spacing.sm,
  },
  givenName: {
    height: GIVEN_NAME_HEIGHT,
    fontSize: 12,
    lineHeight: 16,
  },
  record: {
    marginTop: spacing.xs,
    height: RECORD_HEIGHT,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.bodyMedium,
  },
  // Same height with five squares, fewer, or none — an empty last_five is
  // today's normal state and must render as plain, deliberate blank space.
  formRow: {
    marginTop: spacing.xs,
    height: FORM_ROW_HEIGHT,
    flexDirection: 'row',
    gap: 2,
  },
  formSquare: {
    width: FORM_SQUARE,
    height: FORM_SQUARE,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSquareLabel: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 11,
    lineHeight: 13,
  },
  tape: {
    borderTopWidth: borderWidths.structural,
    borderBottomWidth: borderWidths.structural,
    borderColor: colors.border,
  },
  tapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAPE_ROW_HEIGHT,
  },
  tapeRowDivided: {
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
  },
  tapeValueLeft: {
    flex: 1,
    textAlign: 'left',
  },
  tapeLabel: {
    flex: 1,
    textAlign: 'center',
  },
  tapeValueRight: {
    flex: 1,
    textAlign: 'right',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CHIP_ROW_HEIGHT,
  },
  pickRowLabel: {
    width: 60,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chip: {
    flex: 1,
    height: CHIP_ROW_HEIGHT,
    borderWidth: borderWidths.structural,
    borderColor: colors.textPrimary,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.textPrimary,
  },
  // A disabled chip drops to the border tone so it reads as unavailable rather
  // than merely unselected.
  chipDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipLabel: {
    fontSize: 11,
  },
  // Fills the round row in place of the chips when a Decision is chosen.
  decisionNote: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  errorLine: {
    height: ERROR_LINE_HEIGHT,
    paddingHorizontal: spacing.lg,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: BOTTOM_BAR_HEIGHT,
    paddingHorizontal: spacing.lg,
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
  },
  primaryButton: {
    minWidth: 160,
    // Fixed, so the spinner that replaces the label while saving cannot
    // resize the bar's contents.
    height: PRIMARY_BUTTON_HEIGHT,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
});
