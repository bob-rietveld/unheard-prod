import { useTranslation } from 'react-i18next'
import { FileText, FileSpreadsheet, Table } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ContextFileCardProps {
  originalFilename: string
  storedFilename: string
  fileType: string
  detectedType?: string
  rows?: number
  columns?: string[]
  pages?: number
  sizeBytes: number
  isLFS: boolean
  uploadedAt: number
  syncStatus: 'synced' | 'pending' | 'error'
}

export function ContextFileCard({
  originalFilename,
  fileType,
  detectedType,
  rows,
  columns,
  pages,
  isLFS,
  uploadedAt,
  syncStatus,
}: ContextFileCardProps) {
  const { t } = useTranslation()

  // Format metadata line
  const metadata = formatMetadata(fileType, rows, columns, pages)

  // Format upload timestamp
  const uploadDate = formatUploadDate(uploadedAt)

  // Render appropriate icon
  const renderIcon = () => {
    const lowerType = fileType.toLowerCase()
    const iconClass = 'size-5 text-muted-foreground shrink-0'
    if (lowerType.includes('csv')) return <Table className={iconClass} />
    if (lowerType.includes('pdf')) return <FileText className={iconClass} />
    if (lowerType.includes('excel') || lowerType.includes('xls'))
      return <FileSpreadsheet className={iconClass} />
    return <FileText className={iconClass} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          {renderIcon()}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {originalFilename}
            </CardTitle>
            {metadata && (
              <p className="text-muted-foreground text-sm mt-1">{metadata}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {detectedType && <Badge variant="secondary">{detectedType}</Badge>}
          {isLFS && (
            <Badge variant="secondary">{t('context.library.lfs')}</Badge>
          )}
          {syncStatus !== 'synced' && (
            <Badge
              variant={syncStatus === 'error' ? 'destructive' : 'secondary'}
            >
              {t(`context.library.syncStatus.${syncStatus}`)}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {t('context.library.uploadedAt', { date: uploadDate })}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Format metadata based on file type
 */
function formatMetadata(
  fileType: string,
  rows?: number,
  columns?: string[],
  pages?: number
): string | null {
  const lowerType = fileType.toLowerCase()

  // CSV/Excel: show rows and columns
  if (
    (lowerType.includes('csv') ||
      lowerType.includes('excel') ||
      lowerType.includes('xls')) &&
    rows !== undefined &&
    columns !== undefined
  ) {
    return `${rows.toLocaleString()} rows • ${columns.length} columns`
  }

  // PDF: show pages
  if (lowerType.includes('pdf') && pages !== undefined) {
    return `${pages} ${pages === 1 ? 'page' : 'pages'}`
  }

  return null
}

/**
 * Format upload timestamp as relative or absolute date
 */
function formatUploadDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Less than 1 day: show relative time
  if (diffDays < 1) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      if (diffMinutes < 1) return 'Just now'
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
    }
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  }

  // Less than 7 days: show days ago
  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  }

  // Otherwise: show absolute date
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
