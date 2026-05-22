import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useAuth } from '@/src/features/auth/AuthProvider'
import { LoginScreen } from '@/src/features/auth/components/LoginScreen'
import { RegisterScreen } from '@/src/features/auth/components/RegisterScreen'

export default function HomeScreen() {
  const { isAuthenticated, isLoading, signOut, user } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingScreen}>
          <Image
            source={require('../assets/images/logo-fight-card-society.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <ActivityIndicator color="#ffffff" size="small" />
        </View>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
    return authMode === 'login' ? (
      <LoginScreen onShowRegister={() => setAuthMode('register')} />
    ) : (
      <RegisterScreen onShowLogin={() => setAuthMode('login')} />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <Image
          source={require('../assets/images/logo-fight-card-society.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.panel}>
          <Text style={styles.kicker}>Native app</Text>
          <Text style={styles.title}>Fight Card Society</Text>
          <Text style={styles.text}>
            Home is ready for the first native product screens. The WebView fallback remains available while dashboard, fantasy, and collection move over.
          </Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Signed in</Text>
            <Text style={styles.statusText}>{user?.email || 'Member'}</Text>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/web-fallback' as never)}
          >
            <Text style={styles.primaryButtonText}>Open WebView fallback</Text>
          </Pressable>

          {isAuthenticated && (
            <Pressable style={styles.secondaryButton} onPress={signOut}>
              <Text style={styles.secondaryButtonText}>Sign out native session</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070707',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  loadingLogo: {
    alignSelf: 'center',
    height: 104,
    marginBottom: 18,
    width: 104,
  },
  loadingScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'center',
    height: 118,
    marginBottom: 18,
    width: 118,
  },
  panel: {
    backgroundColor: '#101011',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    padding: 20,
  },
  kicker: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  text: {
    color: '#b5b5b5',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  statusBox: {
    backgroundColor: '#070707',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  statusLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#d5d5d5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
})
