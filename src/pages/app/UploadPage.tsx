import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import type { UploadedFile } from '../../types';
import {
  Upload,
  X,
  Image as ImageIcon,
  Check,
  Crop,
  ArrowRight,
  AlertCircle,
  Camera
} from 'lucide-react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { user, isDemoMode } = useAuth();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) return;

    const uploadedFile = acceptedFiles[0];
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(uploadedFile.type)) {
      setError('Nieprawidłowy format pliku. Akceptowane: JPG, PNG, WEBP');
      return;
    }

    // Validate initial file size (max 10MB to prevent memory crashes on initial preview)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      setError('Plik jest za duży do przetworzenia. Maksymalny rozmiar początkowy: 10MB');
      return;
    }

    const previewUrl = URL.createObjectURL(uploadedFile);
    
    setFile({
      id: `file-${Date.now()}`,
      file: uploadedFile,
      previewUrl,
      name: uploadedFile.name,
      size: uploadedFile.size,
      type: uploadedFile.type,
      uploadedAt: new Date(),
    });
    setIsCropping(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onDrop(Array.from(event.target.files));
    }
  };

  const onCropComplete = useCallback((_: unknown, croppedAreaPixels: CropArea) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const processAndCompress = async (imageUrl: string, area?: CropArea) => {
    setIsCompressing(true);
    setError(null);
    try {
      const image = new Image();
      image.src = imageUrl;
      await new Promise(resolve => { image.onload = resolve; });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Brak wsparcia dla Canvas - użyj innej przeglądarki.");

      if (area) {
        canvas.width = area.width;
        canvas.height = area.height;
        ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
      } else {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError("Błąd konwersji zdjęcia. Spróbuj jeszcze raz.");
          setIsCompressing(false);
          return;
        }

        try {
          // Compress the cropped image to ensure it easily fits in sessionStorage (max ~5MB base64)
          const compressedBlob = await imageCompression(blob as File, {
            maxSizeMB: 0.5, // 500KB mathematically ensures a base64 string < 1MB
            maxWidthOrHeight: 1600, // Large enough to preserve OCR text readability
            useWebWorker: true,
          });

          const reader = new FileReader();
          reader.readAsDataURL(compressedBlob);
          reader.onloadend = () => {
            const resultBase64 = reader.result as string;
            
            // Final safety check for sessionStorage limits (typically ~5MB = ~5 million chars)
            if (resultBase64.length > 4500000) {
              setError("Niestety zdjęcie jest nadal zbyt duże po kompresji (Limit). Spróbuj zrobić mniejsze ujęcie.");
              setIsCompressing(false);
              return;
            }

            setCroppedImage(resultBase64);
            setIsCropping(false);
            setIsCompressing(false);
          };
        } catch (compressionError) {
          console.error(compressionError);
          setError("Wystąpił błąd podczas kompresji zdjęcia.");
          setIsCompressing(false);
        }
      }, 'image/jpeg', 0.95);
    } catch (e) {
      console.error(e);
      setError("Wystąpił nieoczekiwany błąd podczas przetwarzania pliku.");
      setIsCompressing(false);
    }
  };

  const getCroppedImage = () => {
    if (!file || !croppedArea) return;
    processAndCompress(file.previewUrl, croppedArea);
  };

  const handleSkipCrop = () => {
    if (!file) return;
    processAndCompress(file.previewUrl);
  };

  const handleAnalyze = async () => {
    if (!croppedImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    // DEMO MODE BYPASS (since anonymous users might not have storage RLS access)
    // Avoids cloud uploads entirely if user is in demo mode
    if (!user || isDemoMode) {
      sessionStorage.setItem('demoImageBase64', croppedImage);
      sessionStorage.setItem('currentSessionId', 'demo-session');
      await new Promise(resolve => setTimeout(resolve, 2000));
      navigate('/app/analysis');
      return;
    }
    
    try {
      // 1. Convert base64 cropped image back to a Blob for uploading
      const res = await fetch(croppedImage);
      const blob = await res.blob();
      
      // 2. Generate a secure unique filename
      const fileExt = blob.type.split('/')[1] || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;
      
      // 3. Upload to Private Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('study-materials')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload fail: ${uploadError.message}`);
      }
      
      // 4. Record the upload path securely into the user's DB Study Session
      // Note: subject and topic are blank until OCR/AI generates them
      const { data: sessionData, error: dbError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          image_url: uploadData.path, 
        })
        .select()
        .single();
        
      if (dbError || !sessionData) {
        throw new Error(`DB Insert fail: ${dbError?.message}`);
      }
        
      // 5. Securely pass only the Session UUID forward, bypassing all memory quotas
      sessionStorage.setItem('currentSessionId', sessionData.id);
      
      // 6. Simulate analysis delay since OCR is not connected yet (Sprint 2B Prep)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      navigate('/app/analysis');
    } catch (err) {
      console.error("Storage upload error:", err);
      setError("Wystąpił błąd podczas zapisywania obrazu w chmurze.");
      setIsAnalyzing(false);
    }
  };

  const resetUpload = () => {
    if (file) {
      URL.revokeObjectURL(file.previewUrl);
    }
    setFile(null);
    setIsCropping(false);
    setCroppedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
    if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Upload notatek
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          Zeskanuj swoje notatki, a AI przygotuje materiał do nauki.
        </p>
        {isDemoMode && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-3 text-sm border border-blue-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">Jesteś w trybie demo (tylko podgląd). Zdjęcie zostanie przetworzone tylko u Ciebie i nie trafi do chmury.</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Upload Area - Initial State */}
      {!file && (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-[var(--omni-accent)] bg-[var(--omni-accent)]/5'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-[var(--omni-text)]" />
            </div>
            <p className="font-medium text-[var(--omni-text)] mb-2">
              {isDragActive
                ? 'Upuść plik tutaj...'
                : 'Przeciągnij i upuść plik lub kliknij (Galeria)'}
            </p>
            <p className="text-sm text-[var(--omni-text-muted)]">
              JPG, PNG, WEBP (max 10MB)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-gray-400 font-medium">albo</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full omni-btn-primary flex items-center justify-center gap-2 py-4 text-lg"
          >
            <Camera className="w-6 h-6" />
            Zrób zdjęcie teraz
          </button>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={cameraInputRef}
            onChange={handleCameraCapture}
            className="hidden" 
          />
        </div>
      )}

      {/* Cropping Interface */}
      {file && isCropping && (
        <div className="omni-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
              <Crop className="w-5 h-5" />
              Przytnij zdjęcie
            </h3>
            <button
              onClick={resetUpload}
              disabled={isCompressing}
              className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div 
            className="relative w-full h-[40vh] lg:h-[400px] bg-gray-900 rounded-xl overflow-hidden mb-4"
            style={{ touchAction: 'none' }}
          >
            <Cropper
              image={file.previewUrl}
              crop={crop}
              zoom={zoom}
              aspect={4 / 3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-[var(--omni-text-muted)]">Zoom:</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={isCompressing}
              className="flex-1"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={getCroppedImage}
              disabled={isCompressing}
              className="flex-1 omni-btn-primary disabled:opacity-50 disabled:cursor-wait"
            >
              {isCompressing ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
              ) : (
                 <Check className="w-5 h-5 flex-shrink-0" />
              )}
              {isCompressing ? 'Zapisywanie...' : 'Potwierdź wycięcie'}
            </button>
            <button
              onClick={handleSkipCrop}
              disabled={isCompressing}
              className="omni-btn-secondary disabled:opacity-50 disabled:cursor-wait"
            >
              Pomiń przycinanie
            </button>
          </div>
        </div>
      )}

      {/* Preview & Analyze */}
      {file && !isCropping && croppedImage && (
        <div className="omni-card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Podgląd
            </h3>
            <button
              onClick={resetUpload}
              disabled={isAnalyzing}
              className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden mb-4 bg-gray-100 flex items-center justify-center min-h-[200px]">
            <img
              src={croppedImage}
              alt="Uploaded preview"
              className="w-full max-h-[400px] object-contain"
            />
          </div>

          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <p className="font-medium text-[var(--omni-text)] text-sm break-all">
                {file.name}
              </p>
              <p className="text-xs text-[var(--omni-text-muted)] mt-0.5">
                Gotowe do analizy
              </p>
            </div>
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 ml-2" />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full omni-btn-primary disabled:opacity-50"
          >
            {isAnalyzing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analizowanie...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Analizuj zdjęcie</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            )}
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="omni-card p-4 lg:p-6 bg-[var(--omni-lavender)]/30 border-none">
        <h4 className="font-semibold text-[var(--omni-text)] mb-3">
          Wskazówki dla lepszych wyników:
        </h4>
        <ul className="space-y-2 text-sm text-[var(--omni-text-muted)]">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">Upewnij się, że tekst jest czytelny i dobrze oświetlony</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">Unikaj zdjęć pod kątem - rób je poziomo z góry</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">Zrób ostre zdjęcie, a AI dostarczy idealne fiszki</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
