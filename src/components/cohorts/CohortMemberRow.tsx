import { Building2, User, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface CohortMemberRowProps {
  member: {
    _id: string
    name: string
    attioObjectType: 'company' | 'person' | 'list_entry'
  }
  onRemove: () => void
}

export function CohortMemberRow({ member, onRemove }: CohortMemberRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        {member.attioObjectType === 'company' ? (
          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <User className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm">{member.name}</span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {member.attioObjectType}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={onRemove}
      >
        <X className="size-3" />
      </Button>
    </div>
  )
}
