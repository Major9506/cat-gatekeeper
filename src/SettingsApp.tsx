import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
import {
  AppSettings,
  TimerStatus,
  getSettings,
  saveSettings,
  getTimerStatus,
  pauseTimer,
  resumeTimer,
  selectVideo,
  setLanguage,
  onTimerTick,
} from './tauri';

export const SettingsApp: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState('zh');

  const [settings, setSettings] = useState<AppSettings>({
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
  });

  const [timerStatus, setTimerStatus] = useState<TimerStatus>({
    work_seconds_remaining: 3000,
    break_seconds_remaining: 300,
    break_seconds_total: 300,
    is_break_active: false,
    is_paused: false,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  // Load settings on mount
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      if (s.language) {
        i18n.changeLanguage(s.language);
        setCurrentLang(s.language);
      }
    });
    getTimerStatus().then(setTimerStatus);
  }, []);

  // Setup event listeners
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    onTimerTick((data) => {
      setTimerStatus(data);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Toggle language
  const toggleLanguage = () => {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    setCurrentLang(newLang);
    setSettings((prev) => ({ ...prev, language: newLang }));
    setLanguage(newLang);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Get status text
  const getStatusText = () => {
    if (timerStatus.is_break_active) {
      return `${t('settings.breakEndsIn')} ${formatTime(timerStatus.break_seconds_remaining)}`;
    }
    if (timerStatus.is_paused) {
      return t('settings.paused');
    }
    return `${t('settings.nextBreakIn')} ${formatTime(timerStatus.work_seconds_remaining)}`;
  };

  // Handle pause/resume
  const handlePauseResume = async () => {
    if (timerStatus.is_paused) {
      await resumeTimer();
    } else {
      await pauseTimer();
    }
  };

  // Check for changes
  const checkChanges = useCallback((newSettings: AppSettings, original: AppSettings) => {
    return (
      newSettings.work_interval !== original.work_interval ||
      newSettings.break_duration !== original.break_duration ||
      newSettings.snooze_duration !== original.snooze_duration ||
      newSettings.sound_enabled !== original.sound_enabled ||
      newSettings.multi_monitor !== original.multi_monitor ||
      newSettings.video_path !== original.video_path ||
      newSettings.chroma_key_enabled !== original.chroma_key_enabled ||
      newSettings.chroma_key_color !== original.chroma_key_color
    );
  }, []);

  // Handle setting change
  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    // Check if there are actual changes from the original settings
    getSettings().then((original) => {
      setHasChanges(checkChanges(newSettings, original));
    });
  };

  // Handle video browse
  const handleVideoBrowse = async () => {
    const path = await selectVideo();
    if (path) {
      handleChange('video_path', path);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      await saveSettings(settings);
      setHasChanges(false);
      setSaveFeedback(t('settings.saved'));
      setTimeout(() => setSaveFeedback(''), 2000);
    } catch (error) {
      setSaveFeedback(t('settings.saveFailed'));
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
      if (e.key === 'Escape') {
        window.close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, settings]);

  return (
    <div className="settings-container">
      <div className="header">
        <h1>Cat Gatekeeper</h1>
        <p className="subtitle">{t('settings.subtitle')}</p>
        <button onClick={toggleLanguage} className="lang-btn">
          {currentLang === 'zh' ? 'English' : '中文'}
        </button>
      </div>

      {/* Timer Status */}
      <div className="status-card">
        <div className="status-label">{t('settings.timerStatus')}</div>
        <div
          className="status-value"
          style={{
            color: timerStatus.is_break_active
              ? '#d4a373'
              : timerStatus.is_paused
                ? '#e74c3c'
                : '#2ecc71',
          }}
        >
          {getStatusText()}
        </div>
        <div className="status-actions">
          <button className="btn btn-sm" onClick={handlePauseResume}>
            {timerStatus.is_paused ? t('settings.resume') : t('settings.pause')}
          </button>
        </div>
      </div>

      {/* Work Interval */}
      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.workInterval.label')}</span>
          <span className="label-desc">{t('settings.workInterval.desc')}</span>
        </div>
        <div className="setting-control">
          <input
            type="range"
            min="5"
            max="120"
            value={settings.work_interval}
            onChange={(e) => handleChange('work_interval', parseInt(e.target.value))}
          />
          <span className="range-value">{settings.work_interval} min</span>
        </div>
      </div>

      {/* Break Duration */}
      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.breakDuration.label')}</span>
          <span className="label-desc">{t('settings.breakDuration.desc')}</span>
        </div>
        <div className="setting-control">
          <input
            type="range"
            min="60"
            max="600"
            step="30"
            value={settings.break_duration}
            onChange={(e) => handleChange('break_duration', parseInt(e.target.value))}
          />
          <span className="range-value">{Math.round(settings.break_duration / 60)} min</span>
        </div>
      </div>

      {/* Snooze Duration */}
      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.snoozeDuration.label')}</span>
          <span className="label-desc">{t('settings.snoozeDuration.desc')}</span>
        </div>
        <div className="setting-control">
          <input
            type="range"
            min="60"
            max="600"
            step="60"
            value={settings.snooze_duration}
            onChange={(e) => handleChange('snooze_duration', parseInt(e.target.value))}
          />
          <span className="range-value">{Math.round(settings.snooze_duration / 60)} min</span>
        </div>
      </div>

      {/* Sound */}
      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.soundEnabled.label')}</span>
          <span className="label-desc">{t('settings.soundEnabled.desc')}</span>
        </div>
        <div className="setting-control">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.sound_enabled}
              onChange={(e) => handleChange('sound_enabled', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Multi-monitor */}
      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.multiMonitor.label')}</span>
          <span className="label-desc">{t('settings.multiMonitor.desc')}</span>
        </div>
        <div className="setting-control">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.multi_monitor}
              onChange={(e) => handleChange('multi_monitor', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Custom Video */}
      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.videoPath.label')}</span>
          <span className="label-desc">{t('settings.videoPath.desc')}</span>
        </div>
        <div className="setting-control">
          <button className="btn btn-outline" onClick={handleVideoBrowse}>
            {t('settings.videoPath.browse')}
          </button>
          <span className="file-name">
            {settings.video_path
              ? settings.video_path.split(/[/\\]/).pop()
              : t('settings.videoPath.default')}
          </span>
        </div>
      </div>

      {/* Chroma Key */}
      <div className="setting-group-header">{t('settings.chromaKey.title')}</div>
      <p className="setting-group-desc">{t('settings.chromaKey.desc')}</p>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label-text">{t('settings.chromaKey.enabled')}</span>
          <span className="label-desc">{t('settings.chromaKey.enabledDesc')}</span>
        </div>
        <div className="setting-control">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.chroma_key_enabled}
              onChange={(e) => handleChange('chroma_key_enabled', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div
        className="setting-row"
        style={{ opacity: settings.chroma_key_enabled ? 1 : 0.35 }}
      >
        <div className="setting-label">
          <span className="label-text">{t('settings.chromaKey.color')}</span>
          <span className="label-desc">{t('settings.chromaKey.colorDesc')}</span>
        </div>
        <div className="setting-control">
          <div className="color-picker-wrapper">
            <input
              type="color"
              value={settings.chroma_key_color.toLowerCase()}
              onChange={(e) => handleChange('chroma_key_color', e.target.value.toUpperCase())}
            />
            <span className="color-value">{settings.chroma_key_color}</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="footer">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          {t('settings.save')}
        </button>
        <span className={`save-feedback ${saveFeedback ? 'visible' : ''}`}>
          {saveFeedback}
        </span>
      </div>

      {/* Credit */}
      <div className="credit">
       Powered by{' '}
        <a
          href="https://m2.auto-make.cn/"
          onClick={(e) => {
            e.preventDefault();
            open('https://m2.auto-make.cn/');
          }}
        >
          平方咪🐱
        </a>
      </div>
    </div>
  );
};
