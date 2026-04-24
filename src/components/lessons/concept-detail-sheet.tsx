import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "../ui/sheet"
import { Button } from "../ui/button"
import { MessageCircle, Sparkles, ArrowRight, Lightbulb } from "lucide-react"
import type { KeyConcept } from "../../types"
import { useNavigate } from "react-router-dom"

interface ConceptDetailSheetProps {
  concept: KeyConcept | null
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

export function ConceptDetailSheet({ concept, isOpen, onClose, sessionId }: ConceptDetailSheetProps) {
  const navigate = useNavigate();

  if (!concept) return null;

  const handleStartTutor = () => {
    onClose();
    // Navigate to tutor with a pre-filled context if needed
    // For now just navigate to the tutor page for this session
    navigate(`/app/lesson/${sessionId}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-indigo-100 p-0 sm:max-w-xl sm:mx-auto">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
        
        <SheetHeader className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="omni-chip bg-indigo-50 text-indigo-600 text-[10px] uppercase tracking-wider font-bold">
              Kluczowe pojęcie
            </span>
          </div>
          <SheetTitle className="text-2xl font-bold text-[var(--omni-text)] flex items-center gap-2">
            {concept.term}
          </SheetTitle>
          <SheetDescription className="text-sm text-[var(--omni-text-muted)]">
            Kategoria: {concept.category}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4 space-y-6">
          <div className="bg-[var(--omni-lavender)]/50 p-5 rounded-2xl border border-indigo-50">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              Wyjaśnienie AI
            </h4>
            <p className="text-[var(--omni-text)] leading-relaxed">
              {concept.definition}
            </p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-800 font-medium">
              Chcesz dowiedzieć się więcej? AI Tutor może wyjaśnić to pojęcie na przykładach lub w szerszym kontekście.
            </p>
          </div>
        </div>

        <SheetFooter className="p-6 pt-2 pb-8 sm:pb-6">
          <Button 
            onClick={handleStartTutor}
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Porozmawiaj o tym z AI
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="w-full h-10 text-[var(--omni-text-muted)] hover:bg-gray-50"
          >
            Zamknij
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
