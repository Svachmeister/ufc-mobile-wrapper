import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <WebView
        source={{ uri: 'https://ufc-collector.vercel.app' }}
        style={styles.webview}
      />
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
  },
})