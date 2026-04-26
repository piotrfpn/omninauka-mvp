import omniLogo from '../../assets/omninauka_logo3.png';

interface OmniNaukaLogoProps {
  /** Size of the logo icon in pixels. Defaults to 40. */
  size?: number;
  /** Whether to show the "OmniNauka" wordmark next to the icon. Defaults to true. */
  showWordmark?: boolean;
  /** Additional classes applied to the wrapper element. */
  className?: string;
}

/**
 * Reusable OmniNauka brand logo.
 * Uses the approved brain-icon PNG asset with optional wordmark.
 */
export default function OmniNaukaLogo({
  size = 40,
  showWordmark = true,
  className = '',
}: OmniNaukaLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={omniLogo}
        alt="OmniNauka logo"
        width={size}
        height={size}
        className="rounded-xl object-contain flex-shrink-0"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span className="font-semibold text-xl leading-none">
          OmniNauka
        </span>
      )}
    </div>
  );
}
