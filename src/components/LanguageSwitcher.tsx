import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

const languages = [
  { code: 'pl', name: 'Polski' },
  { code: 'en', name: 'English' },
  { code: 'uk', name: 'Українська' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#121A2B] active:bg-[#121A2B] rounded-full"
          title="Wybierz język / Choose language"
        >
          <Globe className="h-5 w-5" />
          <span className="sr-only">Wybierz język</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-[#121A2B] border-[#1e293b] text-[#F8FAFC] min-w-[150px] z-50"
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`cursor-pointer hover:bg-[#1e293b] hover:text-[#F8FAFC] focus:bg-[#1e293b] focus:text-[#F8FAFC] ${
              i18n.resolvedLanguage === lang.code ? 'text-[#2EE6A6] font-medium' : 'text-[#94A3B8]'
            }`}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
