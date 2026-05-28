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

export function HomeScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [counts, setCounts] = useState<CollectionCounts>({ owned: 0, wanted: 0 });
  const [, setNextEvent] = useState<DashboardEvent | null>(null);
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

  const displayName = profile?.username || user?.email?.split('@')[0] || 'Society Member';
  const memberSince = formatMemberSince(profile?.created_at ?? null);
  const membershipTier = formatMembershipTier(profile?.membership_tier);
  const memberNumber = formatMemberNumber(profile?.member_number);
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
                  size={18}
                />
                <Text style={styles.primaryActionText}>Open Collection</Text>
              </View>
              <MaterialCommunityIcons color={colors.textInverse} name="chevron-right" size={19} />
            </Pressable>
            <Pressable
              onPress={openSets}
              style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
            >
              <View style={styles.actionContent}>
                <MaterialCommunityIcons color={colors.ink} name="cards-outline" size={18} />
                <Text style={styles.secondaryActionText}>Browse Sets</Text>
              </View>
              <MaterialCommunityIcons color={colors.ink} name="chevron-right" size={19} />
            </Pressable>
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
  actionContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
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
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
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
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
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
