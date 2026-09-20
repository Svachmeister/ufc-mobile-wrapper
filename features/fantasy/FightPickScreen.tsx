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
  pickPoints,
  roundOptions,
  splitFighterName,
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
const PHOTO_ASPECT_RATIO = 1;

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

export function FightPickScreen({ eventId }: { eventId: string }) {
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

  return <FightPickFlow eventId={eventId} data={query.data} onLeave={leave} />;
}

function FightPickFlow({ eventId, data, onLeave }: { eventId: string; data: PicksFlowData; onLeave: () => void }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { fights, fightersById } = data;

  // Opens at the first fight without a pick; if the card is complete, fight 1.
  const [index, setIndex] = useState(() => {
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

      if (isLastFight) {
        // The summary screen does not exist yet, so the last fight returns to
        // the Event landing.
        leaveFlow();
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

        {draft.method === 'Decision' ? null : (
          <View style={styles.pickRow}>
            <Text variant="label" color="textSecondary" style={styles.pickRowLabel}>
              Round
            </Text>
            <View style={styles.chips}>
              {roundOptions(fight.is_five_round_fight).map((round) => (
                <SelectChip
                  key={round}
                  label={String(round)}
                  selected={draft.round === round}
                  disabled={!draft.method}
                  onPress={() => updateDraft({ round: draft.round === round ? null : round })}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      {errorMessage ? (
        <Text variant="body" color="brandRed" style={styles.errorLine}>
          {errorMessage}
        </Text>
      ) : null}

      <View style={styles.bottomBar}>
        <Text variant="numeric">{points == null ? MISSING : `${points} pts`}</Text>
        <Button
          label={isLastFight ? 'Review picks' : 'Next fight'}
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
          <Image source={{ uri: fighter.image_url }} style={styles.photo} contentFit="cover" transition={0} />
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
        {given ? (
          <Text variant="body" color="textSecondary" style={styles.givenName} numberOfLines={1}>
            {given}
          </Text>
        ) : null}
        <Text variant="body" style={styles.record}>
          {formatRecord(fighter)}
        </Text>
      </View>
    </Pressable>
  );
}

function TaleOfTheTape({ fighter1, fighter2 }: { fighter1: FlowFighter | null; fighter2: FlowFighter | null }) {
  const nowMs = Date.now();
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
  photo: {
    width: '100%',
    aspectRatio: PHOTO_ASPECT_RATIO,
    backgroundColor: colors.border,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  surname: {
    marginTop: spacing.sm,
  },
  givenName: {
    fontSize: 12,
    lineHeight: 16,
  },
  record: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.fontFamily.bodyMedium,
  },
  tape: {
    borderTopWidth: borderWidths.structural,
    borderBottomWidth: borderWidths.structural,
    borderColor: colors.border,
  },
  tapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
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
  },
  pickRowLabel: {
    width: 60,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    flex: 1,
    borderWidth: borderWidths.structural,
    borderColor: colors.textPrimary,
    borderRadius: radius.none,
    paddingVertical: spacing.sm,
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
  errorLine: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
  },
  primaryButton: {
    minWidth: 160,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
});
