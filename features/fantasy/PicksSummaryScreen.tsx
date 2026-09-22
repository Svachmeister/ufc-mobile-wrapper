import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Screen, Text } from '@/components/ui';
import { borderWidths, colors, spacing } from '@/theme/tokens';
import { useSession } from '@/lib/auth/SessionContext';
import { useFeaturedEvent } from '@/lib/fantasy/queries';
import { deriveEventState, shortEventName } from '@/lib/fantasy/eventState';
import {
  isPicksClosedError,
  logPickError,
  PICK_METHODS,
  recomputePickEntry,
  type FlowFight,
  type FlowFighter,
  type FlowPick,
  type PickMethod,
} from '@/lib/fantasy/picksFlow';
import { fetchPickEntryStatus, setChampion, usePicksSummaryData } from '@/lib/fantasy/picksSummary';
import { pickPoints, pickResultLine, splitFighterName } from '@/lib/fantasy/pickDisplay';

const CLOSE_TARGET = 44;
const CLOSE_ICON_SIZE = 24;

function winnerAndOther(
  fight: FlowFight,
  fightersById: Record<string, FlowFighter>,
  winnerId: string | null | undefined,
): { winnerSurname: string; otherSurname: string } | null {
  if (!winnerId) {
    return null;
  }
  const winnerIsFighter1 = winnerId === fight.fighter1_id;
  const winnerFallback = winnerIsFighter1 ? fight.fighter1 : fight.fighter2;
  const otherFallback = winnerIsFighter1 ? fight.fighter2 : fight.fighter1;
  const otherId = winnerIsFighter1 ? fight.fighter2_id : fight.fighter1_id;

  const winnerName = fightersById[winnerId]?.name?.trim() || winnerFallback;
  const otherName = (otherId ? fightersById[otherId]?.name : null)?.trim() || otherFallback;

  return {
    winnerSurname: splitFighterName(winnerName).surname.toUpperCase(),
    otherSurname: splitFighterName(otherName).surname.toUpperCase(),
  };
}

function narrowMethod(rawMethod: string | null | undefined): PickMethod | null {
  return PICK_METHODS.find((candidate) => candidate === rawMethod) ?? null;
}

function summaryProgressLine(pickedCount: number, totalFights: number, hasCaptain: boolean): string {
  if (pickedCount < totalFights) {
    return hasCaptain
      ? `${pickedCount} of ${totalFights} picked · champion set`
      : `${pickedCount} of ${totalFights} picked · no champion yet`;
  }
  return hasCaptain ? `${pickedCount} of ${totalFights} · champion set` : `${pickedCount} of ${totalFights} · pick a champion`;
}

function missingSubmitMessage(pickedCount: number, totalFights: number, hasCaptain: boolean): string {
  const missingPicks = totalFights - pickedCount;
  if (missingPicks > 0 && !hasCaptain) {
    return 'Pick the rest of the card and choose a champion first.';
  }
  if (missingPicks > 0) {
    return `${missingPicks} fight${missingPicks === 1 ? '' : 's'} still ${missingPicks === 1 ? 'needs' : 'need'} a pick.`;
  }
  return 'Choose a champion first.';
}

export function PicksSummaryScreen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const eventQuery = useFeaturedEvent(eventId);
  const summaryQuery = usePicksSummaryData(eventId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function close() {
    router.replace('/(tabs)/fantasy');
  }

  if (eventQuery.isLoading || summaryQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brandRed} />
        </View>
      </Screen>
    );
  }

  if (eventQuery.isError || summaryQuery.isError || !eventQuery.data || !summaryQuery.data) {
    if (eventQuery.isError) {
      logPickError('summary-event', eventQuery.error);
    }
    if (summaryQuery.isError) {
      logPickError('summary-data', summaryQuery.error);
    }
    return (
      <Screen>
        <View style={styles.centered}>
          <Text variant="body" style={styles.centeredText}>
            Could not load your picks.
          </Text>
          <Button variant="outline" label="Back" onPress={close} />
        </View>
      </Screen>
    );
  }

  const { event, fights: stateFights } = eventQuery.data;
  const { fights, fightersById, picksByFightId, entryStatus } = summaryQuery.data;

  const state = deriveEventState(event, stateFights, Date.now());
  const readOnly = state !== 'OPEN';
  const completed = entryStatus === 'completed';

  const pickedCount = fights.filter((fight) => picksByFightId[fight.id]?.picked_fighter_id).length;
  const totalFights = fights.length;
  const captainFight = fights.find((fight) => picksByFightId[fight.id]?.is_captain) ?? null;
  const hasCaptain = captainFight != null;

  function refreshLanding() {
    // The Event landing's four labels and the LOCKED status both read the
    // same queries this summary just changed.
    queryClient.invalidateQueries({ queryKey: ['fantasy'] });
  }

  async function handleSubmit() {
    if (!userId || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      await recomputePickEntry(eventId);
      const status = await fetchPickEntryStatus(userId, eventId);

      if (status === 'completed') {
        setJustSubmitted(true);
        refreshLanding();
        await summaryQuery.refetch();
        setTimeout(() => setJustSubmitted(false), 1400);
      } else {
        setSubmitError(missingSubmitMessage(pickedCount, totalFights, hasCaptain));
      }
    } catch (error) {
      logPickError('submit', error);
      if (isPicksClosedError(error)) {
        Alert.alert('Picks are closed', 'Picks for this event have closed.', [{ text: 'OK', onPress: close }]);
      } else {
        setSubmitError('Could not submit. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openFight(fightId: string) {
    if (readOnly) {
      return;
    }
    router.push(`/picks/${eventId}?fightId=${fightId}`);
  }

  const championDisabled = pickedCount === 0;
  const submitDisabled = submitting || pickedCount < totalFights || !hasCaptain;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="heading">Your picks</Text>
          <Text variant="label" color="textSecondary">
            {shortEventName(event.name)} · {pickedCount} of {totalFights} picked
          </Text>
        </View>
        <Pressable
          onPress={close}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close picks summary"
        >
          <Ionicons name="close" size={CLOSE_ICON_SIZE} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {fights.map((fight) => (
          <SummaryFightRow
            key={fight.id}
            fight={fight}
            pick={picksByFightId[fight.id]}
            fightersById={fightersById}
            isChampion={captainFight?.id === fight.id}
            readOnly={readOnly}
            onPress={() => openFight(fight.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        {readOnly ? (
          <Text variant="body" color={completed ? 'textPrimary' : 'brandRed'}>
            {completed ? 'Submitted' : 'Not submitted · 0 pts'}
          </Text>
        ) : completed ? (
          <>
            <Text variant="label" color="textSecondary" style={styles.progressLine}>
              Submitted · changes save automatically
            </Text>
            <View style={styles.bottomButtons}>
              <Button
                variant="outline"
                label="Change champion"
                onPress={() => setSheetOpen(true)}
                style={styles.bottomButton}
              />
              <Button label="Done" onPress={close} style={styles.bottomButton} />
            </View>
          </>
        ) : (
          <>
            <Text variant="label" color="textSecondary" style={styles.progressLine}>
              {justSubmitted ? 'Picks submitted' : summaryProgressLine(pickedCount, totalFights, hasCaptain)}
            </Text>
            {submitError ? (
              <Text variant="body" color="brandRed" style={styles.submitError}>
                {submitError}
              </Text>
            ) : null}
            <View style={styles.bottomButtons}>
              <Button
                variant="outline"
                label={hasCaptain ? 'Change champion' : 'Pick champion'}
                onPress={() => setSheetOpen(true)}
                disabled={championDisabled}
                style={[styles.bottomButton, championDisabled && styles.bottomButtonDisabled]}
              />
              <Button
                label="Submit picks"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitDisabled}
                style={[styles.bottomButton, submitDisabled && styles.bottomButtonDisabled]}
              />
            </View>
          </>
        )}
      </View>

      <ChampionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        eventId={eventId}
        userId={userId}
        fights={fights}
        fightersById={fightersById}
        picksByFightId={picksByFightId}
        currentCaptainFightId={captainFight?.id ?? null}
        onChanged={() => {
          refreshLanding();
          summaryQuery.refetch();
        }}
        onPicksClosed={close}
      />
    </Screen>
  );
}

function SummaryFightRow({
  fight,
  pick,
  fightersById,
  isChampion,
  readOnly,
  onPress,
}: {
  fight: FlowFight;
  pick: FlowPick | undefined;
  fightersById: Record<string, FlowFighter>;
  isChampion: boolean;
  readOnly: boolean;
  onPress: () => void;
}) {
  const names = winnerAndOther(fight, fightersById, pick?.picked_fighter_id);
  const hasPick = names != null;
  const method = hasPick ? narrowMethod(pick?.picked_method) : null;
  const round = method && method !== 'Decision' ? (pick?.picked_round ?? null) : null;
  const basePoints = hasPick ? pickPoints(true, method, round) : null;
  const displayPoints = basePoints != null ? (isChampion ? basePoints * 2 : basePoints) : null;

  return (
    <Pressable
      onPress={readOnly ? undefined : onPress}
      disabled={readOnly}
      style={[styles.row, isChampion && styles.rowChampion]}
      accessibilityRole={readOnly ? undefined : 'button'}
    >
      <View style={styles.rowPositionWrap}>
        {isChampion ? (
          <Ionicons name="trophy" size={18} color={colors.championGold} />
        ) : (
          <Text variant="body" color="textSecondary">
            {fight.fight_order}
          </Text>
        )}
      </View>

      <View style={styles.rowMiddle}>
        {names ? (
          <>
            <Text variant="body" style={styles.rowMatchup} numberOfLines={1}>
              {names.winnerSurname} def. {names.otherSurname}
            </Text>
            <Text variant="label" color="textSecondary">
              {pickResultLine(method, round)}
            </Text>
          </>
        ) : (
          <Text variant="label" color="textSecondary">
            Not picked
          </Text>
        )}
      </View>

      <View style={styles.rowRight}>
        {displayPoints != null ? (
          <Text variant="label" color={isChampion ? 'championGold' : 'textPrimary'}>
            {displayPoints} pts
          </Text>
        ) : null}
        {!readOnly ? <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} style={styles.rowPencil} /> : null}
      </View>
    </Pressable>
  );
}

function ChampionSheet({
  visible,
  onClose,
  eventId,
  userId,
  fights,
  fightersById,
  picksByFightId,
  currentCaptainFightId,
  onChanged,
  onPicksClosed,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  userId: string | undefined;
  fights: FlowFight[];
  fightersById: Record<string, FlowFighter>;
  picksByFightId: Record<string, FlowPick>;
  currentCaptainFightId: string | null;
  onChanged: () => void;
  onPicksClosed: () => void;
}) {
  const [savingFightId, setSavingFightId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const candidates = fights
    .map((fight) => ({ fight, pick: picksByFightId[fight.id] }))
    .filter(({ pick }) => pick?.picked_fighter_id);

  async function handleSelect(fightId: string) {
    if (!userId || savingFightId) {
      return;
    }
    if (fightId === currentCaptainFightId) {
      onClose();
      return;
    }

    setSavingFightId(fightId);
    setErrorMessage(null);

    try {
      await setChampion({
        userId,
        eventId,
        newCaptainFightId: fightId,
        previousCaptainFightId: currentCaptainFightId,
      });
      onChanged();
      onClose();
    } catch (error) {
      logPickError('champion', error);
      if (isPicksClosedError(error)) {
        onClose();
        Alert.alert('Picks are closed', 'Picks for this event have closed.', [{ text: 'OK', onPress: onPicksClosed }]);
        return;
      }
      setErrorMessage('Could not set your champion. Try again.');
    } finally {
      setSavingFightId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close champion picker"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text variant="heading">Pick your champion</Text>
              <Text variant="body" color="textSecondary">
                Your champion scores double.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close champion picker"
            >
              <Ionicons name="close" size={CLOSE_ICON_SIZE} color={colors.textPrimary} />
            </Pressable>
          </View>

          {errorMessage ? (
            <Text variant="body" color="brandRed" style={styles.sheetError}>
              {errorMessage}
            </Text>
          ) : null}

          <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
            {candidates.length === 0 ? (
              <Text variant="body" color="textSecondary" style={styles.sheetEmpty}>
                Pick a winner in a fight first.
              </Text>
            ) : (
              candidates.map(({ fight, pick }) => (
                <ChampionRow
                  key={fight.id}
                  fight={fight}
                  pick={pick}
                  fightersById={fightersById}
                  selected={fight.id === currentCaptainFightId}
                  saving={savingFightId === fight.id}
                  disabled={savingFightId != null}
                  onPress={() => handleSelect(fight.id)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ChampionRow({
  fight,
  pick,
  fightersById,
  selected,
  saving,
  disabled,
  onPress,
}: {
  fight: FlowFight;
  pick: FlowPick | undefined;
  fightersById: Record<string, FlowFighter>;
  selected: boolean;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const names = winnerAndOther(fight, fightersById, pick?.picked_fighter_id);
  const method = narrowMethod(pick?.picked_method);
  const round = method && method !== 'Decision' ? (pick?.picked_round ?? null) : null;
  const basePoints = pickPoints(true, method, round) ?? 0;
  const doubledPoints = basePoints * 2;

  if (!names) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.championRow, selected && styles.championRowSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <View style={styles.championRowLeft}>
        <Text variant="heading" numberOfLines={1}>
          {names.winnerSurname}
        </Text>
        <Text variant="label" color="textSecondary" numberOfLines={1}>
          {names.winnerSurname} def. {names.otherSurname}
        </Text>
      </View>

      {saving ? (
        <ActivityIndicator color={colors.brandRed} />
      ) : (
        <View style={styles.championRowRight}>
          <Text variant="numeric" color={selected ? 'championGold' : 'textPrimary'}>
            {doubledPoints} pts
          </Text>
          <Text variant="label" color="textSecondary">
            {basePoints} × 2
          </Text>
        </View>
      )}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg - (CLOSE_TARGET - CLOSE_ICON_SIZE) / 2,
    paddingTop: spacing.sm,
  },
  headerText: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  close: {
    width: CLOSE_TARGET,
    height: CLOSE_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  rowChampion: {
    borderLeftWidth: borderWidths.emphasis,
    borderLeftColor: colors.championGold,
    paddingLeft: spacing.sm,
  },
  rowPositionWrap: {
    width: 20,
    alignItems: 'center',
  },
  rowMiddle: {
    flex: 1,
    gap: spacing.xs,
  },
  rowMatchup: {
    textTransform: 'uppercase',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowPencil: {
    marginLeft: spacing.xs,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  progressLine: {
    marginBottom: spacing.xs,
  },
  submitError: {
    marginBottom: spacing.xs,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomButton: {
    flex: 1,
  },
  bottomButtonDisabled: {
    opacity: 0.4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopWidth: borderWidths.structural,
    borderTopColor: colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg - (CLOSE_TARGET - CLOSE_ICON_SIZE) / 2,
    paddingTop: spacing.lg,
  },
  sheetHeaderText: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  sheetError: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetList: {
    marginTop: spacing.sm,
  },
  sheetListContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sheetEmpty: {
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  championRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidths.structural,
    borderBottomColor: colors.border,
  },
  championRowSelected: {
    borderLeftWidth: borderWidths.emphasis,
    borderLeftColor: colors.championGold,
    paddingLeft: spacing.sm,
  },
  championRowLeft: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  championRowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
