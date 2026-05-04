// Tauri API utilities
import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export { convertFileSrc };

export const isTauri = () => window.__TAURI__ !== undefined;

// Settings types
export interface AppSettings {
  version: number;
  work_interval: number;
  break_duration: number;
  snooze_duration: number;
  sound_enabled: boolean;
  multi_monitor: boolean;
  video_path: string;
  chroma_key_enabled: boolean;
  chroma_key_color: string;
  language: string;
}

// Timer status type
export interface TimerStatus {
  work_seconds_remaining: number;
  break_seconds_remaining: number;
  break_seconds_total: number;
  is_break_active: boolean;
  is_paused: boolean;
}

// Settings API
export const getSettings = async (): Promise<AppSettings> => {
  if (isTauri()) {
    return await invoke<AppSettings>('get_settings');
  }
  return {
    version: 4,
    work_interval: 50,
    break_duration: 300,
    snooze_duration: 300,
    sound_enabled: false,
    multi_monitor: true,
    video_path: '',
    chroma_key_enabled: false,
    chroma_key_color: '#00FF00',
    language: 'zh',
  };
};

export const saveSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  if (isTauri()) {
    return await invoke<AppSettings>('save_settings', { settings });
  }
  return settings as AppSettings;
};

export const setLanguage = async (language: string): Promise<void> => {
  if (isTauri()) {
    await invoke('set_language', { language });
  }
};

// Timer API
export const getTimerStatus = async (): Promise<TimerStatus> => {
  if (isTauri()) {
    return await invoke<TimerStatus>('get_timer_status');
  }
  return {
    work_seconds_remaining: 3000,
    break_seconds_remaining: 300,
    break_seconds_total: 300,
    is_break_active: false,
    is_paused: false,
  };
};

export const pauseTimer = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('pause_timer');
  }
};

export const resumeTimer = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('resume_timer');
  }
};

// Break actions
export const dismissBreak = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('dismiss_break');
  }
};

export const snoozeBreak = async (): Promise<void> => {
  if (isTauri()) {
    await invoke('snooze_break');
  }
};

// File dialog
export const selectVideo = async (): Promise<string | null> => {
  if (isTauri()) {
    const result = await invoke<string | null>('select_video');
    return result;
  }
  return null;
};

// Resource paths
export const getResourcePath = async (resource: string): Promise<string | null> => {
  if (isTauri()) {
    return await invoke<string | null>('get_resource_path', { resource });
  }
  return null;
};

// Event listeners
export const onTimerTick = (callback: (data: TimerStatus) => void): Promise<UnlistenFn> => {
  if (isTauri()) {
    return listen<TimerStatus>('timer-tick', (event) => callback(event.payload));
  }
  return Promise.resolve(() => {});
};

export const onBreakStart = (callback: (duration: number) => void): Promise<UnlistenFn> => {
  if (isTauri()) {
    return listen<number>('break-start', (event) => callback(event.payload));
  }
  return Promise.resolve(() => {});
};

export const onBreakEnd = (callback: () => void): Promise<UnlistenFn> => {
  if (isTauri()) {
    return listen('break-end', () => callback());
  }
  return Promise.resolve(() => {});
};

export const onSettingsChanged = (callback: (settings: AppSettings) => void): Promise<UnlistenFn> => {
  if (isTauri()) {
    return listen<AppSettings>('settings-changed', (event) => callback(event.payload));
  }
  return Promise.resolve(() => {});
};
