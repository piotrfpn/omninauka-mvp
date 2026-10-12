import darkSymbol from '../../assets/brand/omninauka-symbol-dark.png';
import lightSymbol from '../../assets/brand/omninauka-symbol-light.png';

interface OmniNaukaLogoProps {
  /** Size of the logo icon in pixels. Defaults to 40. */
  size?: number;
  /** Whether to show the "OmniNauka" wordmark next to the icon. Defaults to true. */
  showWordmark?: boolean;
  /** Additional classes applied to the wrapper element. */
  className?: string;
  /** Surface variant: 'auto' (adapts to .dark class), 'dark' (dark surfaces), 'light' (light surfaces). Defaults to 'auto'. */
  variant?: 'auto' | 'dark' | 'light';
}

/**
 * Reusable OmniNauka brand logo.
 * Uses the official brand symbol with dark and light surface variants.
 */
export default function OmniNaukaLogo({
  size = 40,
  showWordmark = true,
  className = '',
  variant = 'auto',
}: OmniNaukaLogoProps) {
  const textColorClass = variant === 'dark' ? 'text-white' : 'text-foreground';

  return (
    <div className={`flex items-center gap-2.5 ${textColorClass} ${className}`}>
      {variant === 'dark' ? (
        <img
          src={darkSymbol}
          alt="OmniNauka"
          width={size}
          height={size}
          className="rounded-full object-contain flex-shrink-0"
          style={{ width: size, height: size }}
          loading="eager"
        />
      ) : variant === 'light' ? (
        <img
          src={lightSymbol}
          alt="OmniNauka"
          width={size}
          height={size}
          className="rounded-full object-contain flex-shrink-0"
          style={{ width: size, height: size }}
          loading="eager"
        />
      ) : (
        <>
          <img
            src={darkSymbol}
            alt="OmniNauka"
            width={size}
            height={size}
            className="hidden dark:block rounded-full object-contain flex-shrink-0"
            style={{ width: size, height: size }}
            loading="eager"
          />
          <img
            src={lightSymbol}
            alt="OmniNauka"
            width={size}
            height={size}
            className="block dark:hidden rounded-full object-contain flex-shrink-0"
            style={{ width: size, height: size }}
            loading="eager"
          />
        </>
      )}
      {showWordmark && (
        <span className="font-bold text-xl leading-none tracking-tight text-inherit">
          OmniNauka
        </span>
      )}
    </div>
  );
}
