import { StudioView } from '@/features/studio/components/StudioView'
import { useStudioController } from '@/features/studio/useStudioController'
import { StudioLanguageProvider } from '@/i18n'

const hasLmsgenSession = () => {
  if (import.meta.env.VITE_LMSGEN_PAID_EXPORTS !== '1') return true
  try {
    return Boolean(
      window.localStorage.getItem('token') &&
      (window.localStorage.getItem('scormPlatformAccess') === '1' ||
        window.localStorage.getItem('scormAccessGranted') === '1')
    )
  } catch {
    return false
  }
}

function StudioApp() {
  const controller = useStudioController()
  return <StudioView {...controller} />
}

export default function App() {
  if (!hasLmsgenSession()) {
    window.top?.location.replace('/login')
    return null
  }
  return (
    <StudioLanguageProvider>
      <StudioApp />
    </StudioLanguageProvider>
  )
}
