const fs = require('fs');
const path = require('path');
const config = require('../config');

const SETTINGS_PATH = path.resolve(config.settingsPath);

const DEFAULTS = {
  providers: {},
  simklStatusFilter: ['plantowatch'],
};

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

function updateFromForm(formData) {
  const settings = loadSettings();

  for (const [key, value] of formData.entries()) {
    if (key === 'simklStatusFilter') {
      settings.simklStatusFilter = Array.isArray(value) ? value : [value];
    } else if (key === 'traktSelectedLists') {
      if (!settings.providers) settings.providers = {};
      if (!settings.providers.trakt) settings.providers.trakt = {};
      settings.providers.trakt.selectedLists = Array.isArray(value) ? value : [value];
    } else if (value === 'true' || value === 'false') {
      const parts = key.split('.');
      let target = settings;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value === 'true';
    } else {
      const parts = key.split('.');
      let target = settings;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    }
  }

  saveSettings(settings);
  return settings;
}

module.exports = { loadSettings, saveSettings, updateFromForm };
