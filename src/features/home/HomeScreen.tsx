import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { sharedScreenStyles } from '@/src/components/ui/NativePrimitives';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { getNextFantasyEvent } from '@/src/lib/fantasyEvents';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/lib/theme/tokens';

const OWNED_STATUSES = new Set(['owned', 'for_sale', 'not_for_sale', 'for_trade']);
const HOME_BACKGROUND = '#fbfaf7';

const ONE_OF_ONE_PREVIEWS = [
  {
    fighter: 'KHAMZAT CHIMAEV',
    card: 'BLACK FLAG AUTO 1/1',
    time: '23 MINUTES AGO',
  },
  {
    fighter: 'SEAN STRICKLAND',
    card: 'CRIMSON PATCH 1/1',
    time: '1 HOUR AGO',
  },
  {
    fighter: 'ISRAEL ADESANYA',
    card: 'GOLD STANDARD 1/1',
    time: '3 HOURS AGO',
  },
];

const SOCIETY_UPDATES = [
  {
    description:
      'Black Flag Signatures is LIVE. Chase 1-of-1 autographs from the baddest in the game.',
    icon: 'cards-outline',
    time: '2h ago',
    title: 'New Card Set Drop',
  },
  {
    description: 'UFC 327 results are in. Check your leaderboard and claim your rewards.',
    icon: 'trophy-outline',
    time: '5h ago',
    title: 'Fantasy Results Posted',
  },
  {
    description: 'Submit your best 1-of-1 pull for a chance to be featured.',
    icon: 'bullhorn-outline',
    time: '1d ago',
    title: 'Society Challenge',
  },
] as const;

type DashboardProfile = {
  country: string | null;
  created_at: string | null;
  membership_tier: 'free' | 'member' | string | null;
  member_number: number | null;
  username: string | null;
};

type DashboardEvent = {
  event_date: string | null;
  id: string;
  name: string | null;
  picks_close_at: string | null;
  picks_locked: boolean | null;
  starts_at: string | null;
  status: string | null;
};

type CollectionCounts = {
  owned: number;
  wanted: number;
};

// Future PNG shell rule: the image asset provides visuals only.
// React Native will render all labels and values; do not put text in the PNG.
export const SLAB_RATIO = 1400 / 800;

export const slabFields = {
  username: { left: 0.374, top: 0.392, width: 0.335, font: 0.026 },
  tier: { left: 0.36, top: 0.590, width: 0.08, font: 0.0125 },
  memberId: { left: 0.460, top: 0.590, width: 0.080, font: 0.0125 },
  since: { left: 0.575, top: 0.590, width: 0.075, font: 0.0125 },
  owned: { left: 0.715, top: 0.300, width: 0.055, font: 0.032 },
  wanted: { left: 0.835, top: 0.300, width: 0.055, font: 0.032 },
  totalCards: { right: 0.120, top: 0.445, width: 0.050, font: 0.015 },
  oneOfOne: { right: 0.120, top: 0.519, width: 0.050, font: 0.015 },
  completedSets: { right: 0.120, top: 0.589, width: 0.050, font: 0.015 },
  totalValue: { right: 0.117, top: 0.660, width: 0.050, font: 0.015 },
};

export function scaleX(position: number, slabWidth: number) {
  return position * slabWidth;
}

export function scaleFont(size: number, slabWidth: number) {
  return size * slabWidth;
}

function formatMemberSince(createdAt: string | null) {
  if (!createdAt) return '—';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';

  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatMembershipTier(tier: string | null | undefined) {
  return tier === 'member' ? 'MEMBER' : 'FREE';
}

function formatMemberNumber(memberNumber: number | null | undefined) {
  if (typeof memberNumber !== 'number' || !Number.isFinite(memberNumber)) return '—';

  return String(memberNumber).padStart(5, '0');
}

function formatEventDate(event: DashboardEvent | null) {
  const value = event?.starts_at || event?.event_date;
  if (!value) return 'DATE TBA';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'DATE TBA';

  return date
    .toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
}

function getFantasyStatusLabel(event: DashboardEvent | null) {
  const status = event?.status?.toLowerCase();

  if (event?.picks_locked === true || status === 'completed' || status === 'closed') {
    return 'PICKS CLOSED';
  }

  return 'PICKS OPEN';
}

export function HomeScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [counts, setCounts] = useState<CollectionCounts>({ owned: 0, wanted: 0 });
  const [nextEvent, setNextEvent] = useState<DashboardEvent | null>(null);
  const [, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [slabWidth, setSlabWidth] = useState(0);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return;

    setError(null);

    const [profileResult, userCardsResult, eventsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('username,country,created_at,membership_tier,member_number')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_cards')
        .select('status')
        .eq('user_id', user.id),
      supabase
        .from('events')
        .select('id,name,status,event_date,starts_at,picks_close_at,picks_locked')
        .or('status.eq.upcoming,starts_at.not.is.null,event_date.not.is.null')
        .order('starts_at', { ascending: true, nullsFirst: false })
        .order('event_date', { ascending: true })
        .limit(20),
    ]);

    if (profileResult.error || userCardsResult.error || eventsResult.error) {
      setError('Could not load your Society home.');
    }

    setProfile((profileResult.data as DashboardProfile | null) ?? null);

    const cards = (userCardsResult.data ?? []) as { status: string | null }[];
    setCounts({
      owned: cards.filter((card) => card.status && OWNED_STATUSES.has(card.status)).length,
      wanted: cards.filter((card) => card.status === 'wanted').length,
    });

    setNextEvent(getNextFantasyEvent((eventsResult.data ?? []) as DashboardEvent[]));
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await loadDashboard();
      if (mounted) setIsLoading(false);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadDashboard]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadDashboard();
    setIsRefreshing(false);
  };

  const openCollection = () => {
    router.push('/collection' as never);
  };

  const openSets = () => {
    router.push('/sets' as never);
  };

  const openFantasy = () => {
    router.push('/fantasy' as never);
  };

  const displayName = profile?.username || user?.email?.split('@')[0] || 'Society Member';
  const memberSince = formatMemberSince(profile?.created_at ?? null);
  const membershipTier = formatMembershipTier(profile?.membership_tier);
  const memberNumber = formatMemberNumber(profile?.member_number);
  const fantasyDate = formatEventDate(nextEvent);
  const fantasyStatus = getFantasyStatusLabel(nextEvent);
  const fantasyIsOpen = fantasyStatus === 'PICKS OPEN';
  const slabHeight = slabWidth / SLAB_RATIO;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.text}
            onRefresh={refresh}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Image
            source={require('../../../assets/images/logo_fightcardsociety.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Pressable
            accessibilityLabel="Search"
            hitSlop={10}
            style={({ pressed }) => [
              styles.searchButton,
              pressed ? styles.searchButtonPressed : null,
            ]}
          >
            <MaterialCommunityIcons color={colors.ink} name="magnify" size={22} />
          </Pressable>
        </View>

        <View style={styles.slabSection}>
          <ImageBackground
            source={require('../../../assets/images/member_slab_frame.png')}
            style={styles.slabShell}
            imageStyle={styles.slabShellImage}
            onLayout={(event) => setSlabWidth(event.nativeEvent.layout.width)}
            resizeMode="contain"
          >
            {slabWidth ? (
              <>
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={[
                    styles.usernameOverlay,
                    {
                      fontSize: scaleFont(slabFields.username.font, slabWidth),
                      left: scaleX(slabFields.username.left, slabWidth),
                      lineHeight: scaleFont(slabFields.username.font, slabWidth) * 1.05,
                      top: slabFields.username.top * slabHeight,
                      width: scaleX(slabFields.username.width, slabWidth),
                    },
                  ]}
                >
                  {displayName.toUpperCase()}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tierOverlay,
                    {
                      fontSize: scaleFont(slabFields.tier.font, slabWidth),
                      left: scaleX(slabFields.tier.left, slabWidth),
                      lineHeight: scaleFont(slabFields.tier.font, slabWidth) * 1.05,
                      top: slabFields.tier.top * slabHeight,
                      width: scaleX(slabFields.tier.width, slabWidth),
                    },
                  ]}
                >
                  {membershipTier}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.memberIdOverlay,
                    {
                      fontSize: scaleFont(slabFields.memberId.font, slabWidth),
                      left: scaleX(slabFields.memberId.left, slabWidth),
                      lineHeight: scaleFont(slabFields.memberId.font, slabWidth) * 1.05,
                      top: slabFields.memberId.top * slabHeight,
                      width: scaleX(slabFields.memberId.width, slabWidth),
                    },
                  ]}
                >
                  {memberNumber}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.sinceOverlay,
                    {
                      fontSize: scaleFont(slabFields.since.font, slabWidth),
                      left: scaleX(slabFields.since.left, slabWidth),
                      lineHeight: scaleFont(slabFields.since.font, slabWidth) * 1.05,
                      top: slabFields.since.top * slabHeight,
                      width: scaleX(slabFields.since.width, slabWidth),
                    },
                  ]}
                >
                  {memberSince}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.ownedOverlay,
                    {
                      fontSize: scaleFont(slabFields.owned.font, slabWidth),
                      left: scaleX(slabFields.owned.left, slabWidth),
                      lineHeight: scaleFont(slabFields.owned.font, slabWidth) * 1.05,
                      top: slabFields.owned.top * slabHeight,
                      width: scaleX(slabFields.owned.width, slabWidth),
                    },
                  ]}
                >
                  {counts.owned}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.oneOfOneOverlay,
                    {
                      fontSize: scaleFont(slabFields.oneOfOne.font, slabWidth),
                      lineHeight: scaleFont(slabFields.oneOfOne.font, slabWidth) * 1.05,
                      right: scaleX(slabFields.oneOfOne.right, slabWidth),
                      top: slabFields.oneOfOne.top * slabHeight,
                      width: scaleX(slabFields.oneOfOne.width, slabWidth),
                    },
                  ]}
                >
                  0
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.completedSetsOverlay,
                    {
                      fontSize: scaleFont(slabFields.completedSets.font, slabWidth),
                      lineHeight: scaleFont(slabFields.completedSets.font, slabWidth) * 1.05,
                      right: scaleX(slabFields.completedSets.right, slabWidth),
                      top: slabFields.completedSets.top * slabHeight,
                      width: scaleX(slabFields.completedSets.width, slabWidth),
                    },
                  ]}
                >
                  0
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.wantedOverlay,
                    {
                      fontSize: scaleFont(slabFields.wanted.font, slabWidth),
                      left: scaleX(slabFields.wanted.left, slabWidth),
                      lineHeight: scaleFont(slabFields.wanted.font, slabWidth) * 1.05,
                      top: slabFields.wanted.top * slabHeight,
                      width: scaleX(slabFields.wanted.width, slabWidth),
                    },
                  ]}
                >
                  {counts.wanted}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.totalCardsOverlay,
                    {
                      fontSize: scaleFont(slabFields.totalCards.font, slabWidth),
                      lineHeight: scaleFont(slabFields.totalCards.font, slabWidth) * 1.05,
                      right: scaleX(slabFields.totalCards.right, slabWidth),
                      top: slabFields.totalCards.top * slabHeight,
                      width: scaleX(slabFields.totalCards.width, slabWidth),
                    },
                  ]}
                >
                  {counts.owned}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.totalValueOverlay,
                    {
                      fontSize: scaleFont(slabFields.totalValue.font, slabWidth),
                      lineHeight: scaleFont(slabFields.totalValue.font, slabWidth) * 1.05,
                      right: scaleX(slabFields.totalValue.right, slabWidth),
                      top: slabFields.totalValue.top * slabHeight,
                      width: scaleX(slabFields.totalValue.width, slabWidth),
                    },
                  ]}
                >
                  —
                </Text>
              </>
            ) : null}
          </ImageBackground>

          <View style={styles.slabActions}>
            <Pressable
              onPress={openCollection}
              style={({ pressed }) => [styles.primaryAction, pressed ? styles.pressed : null]}
            >
              <View style={styles.actionContent}>
                <MaterialCommunityIcons
                  color={colors.textInverse}
                  name="package-variant-closed"
                  size={16}
                />
                <Text style={styles.primaryActionText}>Open Collection</Text>
              </View>
              <MaterialCommunityIcons color={colors.textInverse} name="chevron-right" size={18} />
            </Pressable>
            <Pressable
              onPress={openSets}
              style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
            >
              <View style={styles.actionContent}>
                <MaterialCommunityIcons color={colors.ink} name="cards-outline" size={16} />
                <Text style={styles.secondaryActionText}>Browse Sets</Text>
              </View>
              <MaterialCommunityIcons color={colors.ink} name="chevron-right" size={18} />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={openFantasy}
          style={({ pressed }) => [styles.fantasyPanel, pressed ? styles.pressed : null]}
        >
          <View style={styles.fantasyIconBlock}>
            <MaterialCommunityIcons color={colors.textInverse} name="trophy-outline" size={26} />
          </View>

          <View style={styles.fantasyInfo}>
            <Text style={styles.fantasyKicker}>Fantasy League</Text>
            <Text numberOfLines={2} style={styles.fantasyTitle}>
              {(nextEvent?.name || 'Next Fantasy Event').toUpperCase()}
            </Text>
            <View style={styles.fantasyMetaRow}>
              <Text style={styles.fantasyDate}>{fantasyDate}</Text>
              <View style={[styles.statusPill, fantasyIsOpen ? styles.statusPillOpen : null]}>
                <Text style={[styles.statusText, fantasyIsOpen ? styles.statusTextOpen : null]}>
                  {fantasyStatus}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.rankBlock}>
            <Text style={styles.rankLabel}>Your Rank</Text>
            <Text style={styles.rankValue}>#7</Text>
            <Text style={styles.rankTotal}>/ 512</Text>
          </View>

          <MaterialCommunityIcons color={colors.ink} name="chevron-right" size={22} />
        </Pressable>

        <View style={styles.trackerSection}>
          <View style={styles.trackerHeader}>
            <View style={styles.trackerTitleGroup}>
              <View style={styles.trackerDot} />
              <Text style={styles.trackerTitle}>1-of-1 Tracker</Text>
            </View>
            <View style={styles.trackerViewAll}>
              <Text style={styles.trackerViewAllText}>View All</Text>
              <MaterialCommunityIcons color={colors.red} name="chevron-right" size={16} />
            </View>
          </View>

          <Text style={styles.trackerSubtitle}>Community-submitted first sightings</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trackerCardRow}
          >
            {ONE_OF_ONE_PREVIEWS.map((item) => (
              <View key={item.fighter} style={styles.trackerCard}>
                <View style={styles.trackerImageArea}>
                  <View style={styles.trackerBadgeRow}>
                    <Text style={styles.trackerBadgeNew}>New</Text>
                    <Text style={styles.trackerBadgeOne}>1-of-1</Text>
                  </View>
                  <View style={styles.trackerCardArt}>
                    <Text style={styles.trackerCardArtBrand}>FCS</Text>
                    <View style={styles.trackerCardArtRule} />
                    <MaterialCommunityIcons color={colors.red} name="cards-outline" size={24} />
                  </View>
                </View>
                <View style={styles.trackerCardBody}>
                  <Text numberOfLines={2} style={styles.trackerFighter}>
                    {item.fighter}
                  </Text>
                  <Text numberOfLines={2} style={styles.trackerCardName}>
                    {item.card}
                  </Text>
                  <Text style={styles.trackerTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.updatesSection}>
          <View style={styles.updatesHeader}>
            <Text style={styles.updatesTitle}>Society Updates</Text>
            <View style={styles.updatesViewAll}>
              <Text style={styles.updatesViewAllText}>View All</Text>
              <MaterialCommunityIcons color={colors.red} name="chevron-right" size={16} />
            </View>
          </View>

          <View style={styles.updateRows}>
            {SOCIETY_UPDATES.map((update, index) => (
              <View
                key={update.title}
                style={[
                  styles.updateRow,
                  index === SOCIETY_UPDATES.length - 1 ? styles.updateRowLast : null,
                ]}
              >
                <View style={styles.updateIconBadge}>
                  <MaterialCommunityIcons
                    color={colors.textInverse}
                    name={update.icon}
                    size={18}
                  />
                </View>

                <View style={styles.updateTextBlock}>
                  <View style={styles.updateTitleRow}>
                    <Text numberOfLines={1} style={styles.updateTitle}>
                      {update.title}
                    </Text>
                    <Text style={styles.updateTime}>{update.time}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.updateDescription}>
                    {update.description}
                  </Text>
                </View>

                <MaterialCommunityIcons color={colors.ink} name="chevron-right" size={18} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandLogo: {
    height: 50,
    width: 164,
  },
  container: {
    backgroundColor: HOME_BACKGROUND,
    flex: 1,
  },
  fantasyDate: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fantasyIconBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.red,
    borderRadius: 5,
    justifyContent: 'center',
    width: 46,
  },
  fantasyInfo: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  fantasyKicker: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fantasyMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 1,
  },
  fantasyPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 17,
    minHeight: 110,
    padding: 12,
  },
  fantasyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingTop: 4,
  },
  headerSpacer: {
    width: 44,
  },
  pressed: {
    opacity: 0.62,
  },
  rankBlock: {
    alignItems: 'center',
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    gap: 1,
    justifyContent: 'center',
    minHeight: 74,
    paddingLeft: 10,
    width: 88,
  },
  rankLabel: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rankTotal: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  rankValue: {
    color: colors.red,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  actionContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    minWidth: 0,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 10,
  },
  primaryActionText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  searchButtonPressed: {
    opacity: 0.62,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  scrollContent: {
    ...sharedScreenStyles.scrollContent,
    backgroundColor: HOME_BACKGROUND,
    gap: 0,
  },
  slabActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 9,
  },
  slabShell: {
    aspectRatio: SLAB_RATIO,
    width: '100%',
  },
  slabShellImage: {
    height: '100%',
    width: '100%',
  },
  slabSection: {
    marginTop: 22,
  },
  statusPill: {
    backgroundColor: colors.red,
    borderColor: colors.red,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  statusPillOpen: {
    backgroundColor: colors.surface,
    borderColor: colors.red,
  },
  statusText: {
    color: colors.textInverse,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusTextOpen: {
    color: colors.red,
  },
  trackerBadgeNew: {
    backgroundColor: colors.red,
    borderRadius: 3,
    color: colors.textInverse,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.4,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 2,
    textTransform: 'uppercase',
  },
  trackerBadgeOne: {
    backgroundColor: colors.surface,
    borderColor: colors.red,
    borderRadius: 3,
    borderWidth: 1,
    color: colors.red,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.4,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 1,
    textTransform: 'uppercase',
  },
  trackerBadgeRow: {
    flexDirection: 'row',
    gap: 4,
    left: 8,
    position: 'absolute',
    top: 8,
  },
  trackerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    width: 132,
  },
  trackerCardArt: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderColor: colors.red,
    borderRadius: 5,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 50,
  },
  trackerCardArtBrand: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  trackerCardArtRule: {
    backgroundColor: colors.red,
    height: 2,
    marginVertical: 5,
    width: 22,
  },
  trackerCardBody: {
    gap: 6,
    minHeight: 92,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  trackerCardName: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  trackerCardRow: {
    gap: 9,
    paddingRight: 2,
  },
  trackerDot: {
    backgroundColor: colors.red,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  trackerFighter: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.1,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  trackerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  trackerImageArea: {
    alignItems: 'center',
    backgroundColor: '#f4f2ed',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    height: 108,
    justifyContent: 'center',
  },
  trackerSection: {
    marginTop: 22,
    paddingBottom: 14,
  },
  trackerSubtitle: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 5,
  },
  trackerTime: {
    color: colors.red,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  trackerTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  trackerTitleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  trackerViewAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  trackerViewAllText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  updateDescription: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  updateIconBadge: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  updateRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 13,
  },
  updateRowLast: {
    borderBottomWidth: 0,
  },
  updateRows: {
    backgroundColor: 'transparent',
  },
  updatesHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  updatesSection: {
    marginTop: 22,
    paddingBottom: 26,
  },
  updatesTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  updatesViewAll: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  updatesViewAllText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  updateTextBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  updateTime: {
    color: colors.textSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  updateTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  updateTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  usernameOverlay: {
    color: '#f4f1ea',
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 1,
  },
  tierOverlay: {
    color: colors.red,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'center',
  },
  memberIdOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'center',
  },
  sinceOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'center',
  },
  ownedOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'center',
  },
  wantedOverlay: {
    color: colors.red,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'center',
  },
  totalCardsOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'right',
  },
  oneOfOneOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'right',
  },
  completedSetsOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'right',
  },
  totalValueOverlay: {
    color: colors.ink,
    fontFamily: Platform.select({
      android: 'sans-serif-condensed',
      default: undefined,
      ios: 'Arial Condensed',
      web: 'Arial Black',
    }),
    fontWeight: '900',
    letterSpacing: 0,
    position: 'absolute',
    textAlign: 'right',
  },
});
