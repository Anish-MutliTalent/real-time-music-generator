
export const API_KEY = import.meta.env.VITE_API_KEY || '';

export const SAMPLE_RATE = 44100;

const COLORS = [
  '#4fd1c5', '#9dffc0', '#f6e05e', '#cba6f7', '#f9e2af', 
  '#fab387', '#ebdbb2', '#83a598', '#d3869b', '#8ec07c',
  '#fb4934', '#fe8019', '#b8bb26', '#d3869b', '#458588'
];

const GENRES = [
  'afrobeat', 'synthwave', 'vaporwave', 'phonk', 'death metal', 'bossa nova',
  'g-funk', 'grime', 'lo-fi beats', 'industrial techno', 'math rock', 'shoegaze',
  'city pop', 'liquid dnb', 'dubstep', 'ambient drift', 'garage', 'hardstyle',
  'hyperpop', 'minimal house', 'glitch hop', 'psytrance', 'bluegrass', 'fado',
  'flamenco', 'gospel', 'harsh noise', 'idm', 'jungle', 'k-pop', 'latin jazz',
  'motown', 'neo-soul', 'outrun', 'post-rock', 'qawwali', 'reggaeton', 'ska',
  'trip hop', 'uk drill', 'viking folk', 'witch house', 'yacht rock', 'zydeco',
  'acid jazz', 'baroque', 'chillstep', 'darkwave', 'eurobeat', 'folk horror',
  'gregorian chant', 'honky tonk', 'italo disco', 'kawaii future bass', 'low end theory'
];

const MOODS = [
  'melancholic', 'ethereal', 'aggressive', 'nostalgic', 'cybernetic', 'cosmic',
  'distorted', 'dreamy', 'anxious', 'heroic', 'subterranean', 'underwater',
  'existential', 'euphoric', 'gritty', 'crystalline', 'hazy', 'neon', 'rustic',
  'brutalist', 'whimsical', 'noir', 'spectral', 'cinematic', 'lo-fi', 'hi-fi',
  'organic', 'mechanical', 'stroboscopic', 'liminal', 'ancient', 'futuristic'
];

const INSTRUMENTS = [
  'cello', 'moog synth', '808 bass', 'didgeridoo', 'sitar', 'harpsichord',
  'steel drums', 'theremin', 'mellotron', 'otamatone', 'modular rack', 'stratocaster',
  'pipe organ', 'vinyl crackle', 'kalimba', 'erhu', 'taiko drums', 'rhodes piano',
  'vocoder', 'distorted sax', 'bagpipes', 'accordion', 'banjo', 'clavinova',
  'djembe', 'electric sitar', 'fretless bass', 'glockenspiel', 'harmonica',
  'jaw harp', 'koto', 'lute', 'marimba', 'nyckelharpa', 'oud', 'pan flute'
];

const MODIFIERS = [
  'reverb-drenched', 'bit-crushed', 'heavily compressed', 'syncopated', 
  'minimalist', 'maximalist', 'polyrhythmic', 'detuned', 'saturated',
  'orchestral', 'acoustic', 'unplugged', 'distorted', 'reversed'
];

function shuffle<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export const getRandomSuggestions = (count: number = 8): string[] => {
  return shuffle(GENRES).slice(0, count);
};

export const generateRandomInitialPrompts = (count: number = 3) => {
  const result = [];
  for (let i = 0; i < count; i++) {
    const useCombo = Math.random() > 0.4;
    let text = '';
    
    if (useCombo) {
      const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
      const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
      const inst = INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)];
      
      const pattern = Math.floor(Math.random() * 3);
      if (pattern === 0) text = `${mood} ${genre}`;
      else if (pattern === 1) text = `${genre} with ${inst}`;
      else text = `${mood} ${inst}`;
    } else {
      text = GENRES[Math.floor(Math.random() * GENRES.length)];
    }

    result.push({
      id: Math.random().toString(36).substring(7),
      text: text,
      weight: 0.4 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isActive: true
    });
  }
  return result;
};

export const MUSICAL_KEYS = [
  'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
];
