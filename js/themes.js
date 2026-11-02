// Eight colour themes. Each one is just eight colours; style.css reads them as CSS variables,
// so adding a theme means adding one line here.
window.TT = window.TT || { views: {} };

TT.themes = [
  { key: 'matcha', name: 'Matcha', note: 'Soft green tea', bg: '#E9EEDB', surface: '#F5F8EC', text: '#2C3822', muted: '#6A7656', border: '#D1D9BC', accent: '#5F8030', soft: '#DCE6C0', on: '#FFFFFF' },
  { key: 'milk', name: 'Milk', note: 'Clean and creamy', bg: '#F6F3EE', surface: '#FFFFFF', text: '#2D2A27', muted: '#86807A', border: '#E8E3DB', accent: '#5E7292', soft: '#E3E8F0', on: '#FFFFFF' },
  { key: 'almond', name: 'Almond', note: 'Warm beige', bg: '#F1E6D6', surface: '#F9F2E7', text: '#3B2D21', muted: '#86705B', border: '#E0D0B8', accent: '#A06A3B', soft: '#EBD5B8', on: '#FFFFFF' },
  { key: 'leaves', name: 'Leaves', note: 'Deep forest green', bg: '#DCE8D6', surface: '#EDF4E9', text: '#1D3222', muted: '#52705A', border: '#BFD3BA', accent: '#2D7347', soft: '#BBDCC4', on: '#FFFFFF' },
  { key: 'seaglass', name: 'Sea glass', note: 'Cool and calm', bg: '#E1EFED', surface: '#F0F8F7', text: '#1D3432', muted: '#5A7B77', border: '#C3DBD7', accent: '#347F78', soft: '#BFE0DB', on: '#FFFFFF' },
  { key: 'lavender', name: 'Lavender haze', note: 'Quiet purple', bg: '#ECE8F5', surface: '#F7F5FC', text: '#2B2540', muted: '#756B90', border: '#D9D2EA', accent: '#7459B5', soft: '#D9D0F0', on: '#FFFFFF' },
  { key: 'chai', name: 'Chai', note: 'Dark and warm', bg: '#261F1A', surface: '#332A23', text: '#F0E4D7', muted: '#B3A08E', border: '#473A30', accent: '#D69A5C', soft: '#4A3A2B', on: '#26190F' },
  { key: 'inkwell', name: 'Inkwell', note: 'Dark and blue', bg: '#131A26', surface: '#1B2434', text: '#E4E9F2', muted: '#93A0B8', border: '#2A3650', accent: '#7DA4E6', soft: '#25344F', on: '#0F1724' }
];

TT.applyTheme = key => {
  const t = TT.themes.find(x => x.key === key) || TT.themes[0];
  const style = document.documentElement.style;
  for (const k of ['bg', 'surface', 'text', 'muted', 'border', 'accent', 'soft', 'on']) style.setProperty('--' + k, t[k]);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = t.bg;
  return t.key;
};

// The chosen theme is remembered per device, so a phone can be dark while the laptop stays light.
TT.currentTheme = () => { try { return localStorage.getItem('tt:theme'); } catch (e) { return null; } };
TT.applyTheme(TT.currentTheme());
