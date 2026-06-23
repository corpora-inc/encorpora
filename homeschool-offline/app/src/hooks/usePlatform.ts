import { useState, useEffect } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'android' | 'ios' | 'macos' | 'windows' | 'linux';

export function usePlatform() {
  const [platformType, setPlatformType] = useState<Platform | ''>('');
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const p = platform() as Platform;
    setPlatformType(p);

    // Simple and correct: Trust Tauri's platform detection
    // M5 iPad reports as 'ios', not 'macos' - Tauri gets it right
    const isiOS = p === 'ios';
    setIsIOS(isiOS);
    setIsMobile(p === 'android' || isiOS);
  }, []);

  return {
    platformType,
    isMobile,
    isDesktop: !isMobile,
    isIOS
  };
}
