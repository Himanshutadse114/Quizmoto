import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StudioController } from '@/features/studio/useStudioController'
import { type StudioLanguage } from '@/i18n'

type StudioIdentityProps = Pick<StudioController, 'language' | 'setLanguage' | 't'> & {
  className?: string
}

export function StudioIdentity({ className = '', language, setLanguage, t }: StudioIdentityProps) {
  return (
    <div className={`studio-identity ${className}`.trim()}>
      <div className="brand">
        <span className="brand-mark" />
        LMSGEN <em>Avatar Studio</em>
      </div>
      <div className="language-picker">
        <Select
          value={language}
          items={[
            { value: 'en', label: '🇬🇧' },
            { value: 'fr', label: '🇫🇷' },
            { value: 'zh-CN', label: '🇨🇳' },
          ]}
          onValueChange={next => next && setLanguage(next as StudioLanguage)}
        >
          <SelectTrigger aria-label={t('Langue de l’interface')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">🇬🇧</SelectItem>
            <SelectItem value="fr">🇫🇷</SelectItem>
            <SelectItem value="zh-CN">🇨🇳</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
