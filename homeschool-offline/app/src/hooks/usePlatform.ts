import { useState, useEffect } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'android' | 'ios' | 'macos' | 'windows' | 'linux';

export function usePlatform() {
  const [platformType, setPlatformType] = useState<Platform | ''>('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const p = platform() as Platform;
    setPlatformType(p);

    // Simple and correct: Trust Tauri's platform detection
    // M5 iPad reports as 'ios', not 'macos' - Tauri gets it right
    setIsMobile(p === 'android' || p === 'ios');
  }, []);

  return {
    platformType,
    isMobile,
    isDesktop: !isMobile
  };
}
