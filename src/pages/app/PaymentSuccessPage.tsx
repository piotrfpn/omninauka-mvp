import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccessPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
      <div className="omni-card p-8 md:p-12 text-center flex flex-col items-center max-w-2xl w-full animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        
        <h1 className="omni-heading-2 text-[var(--omni-text)] mb-4">
          {t('paymentSuccess.title', 'Płatność została rozpoczęta lub zakończona')}
        </h1>
        
        <div className="space-y-4 text-[var(--omni-text-muted)] text-lg mb-8">
          <p>
            {t('paymentSuccess.desc1', 'Jeśli płatność została poprawnie opłacona, aktywujemy plan ręcznie po potwierdzeniu płatności. Aktywacja planu może potrwać do 24 godzin.')}
          </p>
          <p className="text-sm">
            {t('paymentSuccess.desc2', 'Jeżeli płatność została wykonana innym adresem e-mail niż konto w OmniNauka, skontaktuj się z nami, abyśmy mogli przypisać płatność do właściwego konta.')}
          </p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 w-full text-left mb-10">
          <p className="italic">
            {t('paymentSuccess.mvpNote', 'To tymczasowy proces MVP. Pełna automatyczna aktywacja planu zostanie wdrożona w kolejnym etapie.')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link 
            to="/app/dashboard" 
            className="omni-btn-primary flex items-center justify-center gap-2"
          >
            {t('paymentSuccess.backToDashboard', 'Wróć do dashboardu')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link 
            to="/app/payments" 
            className="px-6 py-3 border border-gray-200 text-[var(--omni-text-muted)] rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {t('paymentSuccess.goToSettings', 'Zobacz płatności i plan')}
          </Link>
        </div>
      </div>
    </div>
  );
}
