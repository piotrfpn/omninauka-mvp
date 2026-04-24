import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Pencil, Check, X } from 'lucide-react';

interface LessonTitleEditorProps {
  sessionId: string;
  initialTitle: string;
  onSaved: (newTitle: string) => void;
  isDemoMode?: boolean;
  className?: string;
}

export function LessonTitleEditor({
  sessionId,
  initialTitle,
  onSaved,
  isDemoMode = false,
  className = '',
}: LessonTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Sync state if initialTitle changes (e.g. after refresh)
  useEffect(() => {
    setValue(initialTitle);
  }, [initialTitle]);

  const handleSave = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (saving || isDemoMode) return;
    
    const trimmed = value.trim();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({ lesson_title: trimmed || null })
        .eq('id', sessionId);
      if (error) throw error;
      onSaved(trimmed);
      setEditing(false);
    } catch (err) {
      console.error('Lesson title save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { 
      setValue(initialTitle); 
      setEditing(false); 
    }
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-2 ${className}`} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={80}
          placeholder="Nazwa lekcji..."
          className="flex-1 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-[var(--omni-text)]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors disabled:opacity-50"
          title="Zapisz"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setValue(initialTitle); setEditing(false); }}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          title="Anuluj"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className={`text-sm font-medium ${value ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--omni-text-muted)] italic'}`}>
        {value || (isDemoMode ? initialTitle : 'Bez nazwy')}
      </span>
      {!isDemoMode && (
        <button
          onClick={e => { e.stopPropagation(); setEditing(true); }}
          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-[var(--omni-text-muted)] hover:text-indigo-600 transition-colors"
          title="Kliknij, aby edytować nazwę lekcji"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
