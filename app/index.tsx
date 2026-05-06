import { StatusBar } from 'expo-status-bar'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { WebView } from 'react-native-webview'

const APP_URL = 'https://ufc-collector.vercel.app'

export default function HomeScreen() {
  const webViewRef = useRef<WebView>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const reload = () => {
    setHasError(false)
    setIsLoading(true)
    webViewRef.current?.reload()
  }

  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.center}>
          <Text style={styles.logo}>UFC Collector</Text>
          <Text style={styles.title}>Connection problem</Text>
          <Text style={styles.text}>
            The app could not load. Check your internet connection and try again.
          </Text>

          <Pressable style={styles.button} onPress={reload}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        startInLoadingState={false}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        bounces={false}
        overScrollMode="never"
        onLoadStart={() => {
          setHasError(false)
          setIsLoading(true)
        }}
        onLoadEnd={() => {
          setIsLoading(false)
        }}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) {
            setHasError(true)
          }
        }}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.logo}>UFC Collector</Text>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading your collection...</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070707',
  },
  webview: {
    flex: 1,
    backgroundColor: '#070707',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070707',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logo: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  loadingText: {
    color: '#a3a3a3',
    fontSize: 14,
    marginTop: 2,
  },
  center: {
    flex: 1,
    backgroundColor: '#070707',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 22,
    marginBottom: 8,
  },
  text: {
    color: '#a3a3a3',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    minHeight: 48,
    minWidth: 140,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  buttonText: {
    color: '#070707',
    fontSize: 15,
    fontWeight: '800',
  },
})
