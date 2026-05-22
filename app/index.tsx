import { Redirect } from 'expo-router'
import { useState } from 'react'

import { LoadingScreen } from '@/src/components/ui/ScreenState'
import { useAuth } from '@/src/features/auth/AuthProvider'
import { LoginScreen } from '@/src/features/auth/components/LoginScreen'
import { RegisterScreen } from '@/src/features/auth/components/RegisterScreen'

export default function HomeScreen() {
  const { isAuthenticated, isLoading } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  if (isLoading) {
    return <LoadingScreen label="Loading session" />
  }

  if (!isAuthenticated) {
    return authMode === 'login' ? (
      <LoginScreen onShowRegister={() => setAuthMode('register')} />
    ) : (
      <RegisterScreen onShowLogin={() => setAuthMode('login')} />
    )
  }

  return <Redirect href={'/(app)/home' as never} />
}
