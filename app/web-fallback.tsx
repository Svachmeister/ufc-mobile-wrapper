import { StatusBar } from 'expo-status-bar'
import { useRef, useState } from 'react'
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { WebView } from 'react-native-webview'

const APP_URL = 'https://ufc-collector.vercel.app'

export default function WebFallbackScreen() {
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
          <Image
            source={require('../assets/images/logo-fight-card-society.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
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
          <Image
            source={require('../assets/images/logo-fight-card-society.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
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
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 168,
    height: 168,
  },
  logoImage: {
    width: 132,
    height: 132,
    marginBottom: 8,
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
