import type { CacheCostSnapshot, CacheUsageSnapshot, PricingSnapshot } from './types';
import { getUsdToCnyRate } from './exchange-rate';

type PricingProvider = PricingSnapshot['provider'];

type PricingRateSet = {
  inputHitUsdPerMillion: number;
  inputMissUsdPerMillion: number;
  outputUsdPerMillion: number;
  inputHitCnyPerMillion?: number;
  inputMissCnyPerMillion?: number;
  outputCnyPerMillion?: number;
  note: string | null;
};

type PricingRule = {
  id: string;
  provider: PricingProvider;
  label: string;
  sourceUrl: string;
  sourceDate: string;
  matches: (model: string) => boolean;
  rates: (usage: CacheUsageSnapshot, timestamp: number) => PricingRateSet;
};

const SOURCE_DATE = '2026-10-10';
const OPENAI_LONG_CONTEXT_THRESHOLD = 272_000;
const ANTHROPIC_HAIKU_LONG_CONTEXT_THRESHOLD = 100_000;
const GEMINI_FLASH_INTRO_END = Date.UTC(2027, 0, 1);

// 2026 Chinese public-holiday dates from 国办发明电〔2025〕7号.
// DeepSeek explicitly treats Chinese public holidays as off-peak for the full day.
const DEEPSEEK_CHINA_PUBLIC_HOLIDAYS_2026 = new Set([
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-02-15',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-02-21',
  '2026-02-22',
  '2026-02-23',
  '2026-04-04',
  '2026-04-05',
  '2026-04-06',
  '2026-05-01',
  '2026-05-02',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  '2026-06-19',
  '2026-06-20',
  '2026-06-21',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
]);

const PRICING_RULES: PricingRule[] = [
  {
    id: 'deepseek-v4-pro',
    provider: 'deepseek',
    label: 'DeepSeek V4 Pro',
    sourceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    sourceDate: '2026-10-14',
    matches: model =>
      includesAny(model, ['deepseek-v4-pro', 'deepseek_v4_pro', 'deepseek v4 pro', 'deepseek-v4-pro-0813']),
    rates: (_usage, timestamp) => deepSeekTimeOfUseRates(timestamp, {
      offPeak: [0.022, 0.66, 1.98],
      peak: [0.044, 1.32, 3.96],
      offPeakCny: [0.15, 4.5, 13.5],
      peakCny: [0.3, 9, 27],
    }),
  },
  {
    id: 'deepseek-v4.1-flash',
    provider: 'deepseek',
    label: 'DeepSeek V4.1 Flash',
    sourceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    sourceDate: '2026-10-14',
    matches: model =>
      includesAny(model, [
        'deepseek-flash',
        'deepseek-v4.1-flash',
        'deepseek_v4.1_flash',
        'deepseek-v4-flash',
        'deepseek_v4_flash',
        'deepseek-v4-flash-vision-exp',
        'deepseek flash',
        'deepseek-chat',
        'deepseek-reasoner',
      ]),
    rates: (_usage, timestamp) => deepSeekTimeOfUseRates(timestamp, {
      offPeak: [0.003, 0.15, 0.6],
      peak: [0.006, 0.3, 1.2],
      offPeakCny: [0.02, 1, 4],
      peakCny: [0.04, 2, 8],
    }),
  },
  {
    id: 'gemini-3.8-flash',
    provider: 'gemini',
    label: 'Gemini 3.8 Flash',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gemini-3.8-flash', 'gemini 3.8 flash']),
    rates: (_usage, timestamp) => geminiFlashIntroRates(timestamp, 'Gemini 3.8 Flash'),
  },
  {
    id: 'gemini-3.7-flash',
    provider: 'gemini',
    label: 'Gemini 3.7 Flash',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gemini-3.7-flash', 'gemini 3.7 flash']),
    rates: (_usage, timestamp) => geminiFlashIntroRates(timestamp, 'Gemini 3.7 Flash'),
  },
  {
    id: 'gemini-3.5-flash',
    provider: 'gemini',
    label: 'Gemini 3.5 Flash',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gemini-3.5-flash', 'gemini 3.5 flash']),
    rates: () => ({
      inputHitUsdPerMillion: 0.15,
      inputMissUsdPerMillion: 1.5,
      outputUsdPerMillion: 9,
      note: 'Gemini 3.5 Flash standard text rate.',
    }),
  },
  {
    id: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    label: 'Gemini 3.1 Flash-Lite',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model =>
      includesAny(model, [
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini 3.1 flash-lite',
        'gemini 3.1 flash lite',
      ]),
    rates: () => ({
      inputHitUsdPerMillion: 0.025,
      inputMissUsdPerMillion: 0.25,
      outputUsdPerMillion: 1.5,
      note: 'Gemini 3.1 Flash-Lite standard text/image/video rate.',
    }),
  },
  {
    id: 'gemini-3.1-pro-preview',
    provider: 'gemini',
    label: 'Gemini 3.1 Pro Preview',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model =>
      includesAny(model, [
        'gemini-3.1-pro-preview',
        'gemini-3.1-pro-preview-customtools',
        'gemini-3.1-pro',
        'gemini 3.1 pro',
      ]),
    rates: usage => {
      const largePrompt = usage.totalCacheTokens > 200_000;
      return {
        inputHitUsdPerMillion: largePrompt ? 0.4 : 0.2,
        inputMissUsdPerMillion: largePrompt ? 4 : 2,
        outputUsdPerMillion: largePrompt ? 18 : 12,
        note: largePrompt
          ? 'Gemini 3.1 Pro Preview standard prompts > 200k tier.'
          : 'Gemini 3.1 Pro Preview standard prompts <= 200k tier.',
      };
    },
  },
  {
    id: 'gemini-3-flash-preview',
    provider: 'gemini',
    label: 'Gemini 3 Flash Preview',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gemini-3-flash-preview', 'gemini 3 flash preview']),
    rates: () => ({
      inputHitUsdPerMillion: 0.05,
      inputMissUsdPerMillion: 0.5,
      outputUsdPerMillion: 3,
      note: 'Gemini 3 Flash Preview standard text/image/video rate.',
    }),
  },
  {
    id: 'gpt-6-astra',
    provider: 'openai',
    label: 'GPT-6 Astra',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-6-astra', 'gpt 6 astra']),
    rates: usage => openAiLongContextRates(usage, [1, 10, 50], 'GPT-6 Astra'),
  },
  {
    id: 'gpt-6.1-sol',
    provider: 'openai',
    label: 'GPT-6.1 Sol',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-6.1-sol', 'gpt 6.1 sol']),
    rates: usage => openAiLongContextRates(usage, [0.1, 2, 10], 'GPT-6.1 Sol'),
  },
  {
    id: 'gpt-6-sol',
    provider: 'openai',
    label: 'GPT-6 Sol',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-6-sol', 'gpt 6 sol']),
    rates: usage => openAiLongContextRates(usage, [0.2, 2, 10], 'GPT-6 Sol'),
  },
  {
    id: 'gpt-6-luna',
    provider: 'openai',
    label: 'GPT-6 Luna',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-6-luna', 'gpt 6 luna']),
    rates: usage => openAiLongContextRates(usage, [0.01, 0.1, 0.5], 'GPT-6 Luna'),
  },
  {
    id: 'gpt-5.6-sol',
    provider: 'openai',
    label: 'GPT-5.6 Sol',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-5.6-sol', 'gpt 5.6 sol']) || normalizedModel(model) === 'gpt-5.6',
    rates: usage => {
      const rates = openAiLongContextRates(usage, [0.4, 4, 20], 'GPT-5.6 Sol');
      rates.note = `${rates.note ?? ''} Promotional pricing is listed as available at least through 2026-11-21.`.trim();
      return rates;
    },
  },
  {
    id: 'gpt-5.6-terra',
    provider: 'openai',
    label: 'GPT-5.6 Terra',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-terra',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-5.6-terra', 'gpt 5.6 terra']),
    rates: usage => openAiLongContextRates(usage, [0.2, 2, 12], 'GPT-5.6 Terra'),
  },
  {
    id: 'gpt-5.6-luna',
    provider: 'openai',
    label: 'GPT-5.6 Luna',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-5.6-luna', 'gpt 5.6 luna']),
    rates: usage => openAiLongContextRates(usage, [0.02, 0.2, 1.2], 'GPT-5.6 Luna'),
  },
  {
    id: 'gpt-5.5',
    provider: 'openai',
    label: 'GPT-5.5',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => normalizedModel(model).includes('gpt-5.5'),
    rates: () => ({
      inputHitUsdPerMillion: 0.5,
      inputMissUsdPerMillion: 5,
      outputUsdPerMillion: 30,
      note: 'OpenAI standard processing price.',
    }),
  },
  {
    id: 'gpt-5.4-mini',
    provider: 'openai',
    label: 'GPT-5.4 mini',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['gpt-5.4-mini', 'gpt-5.4 mini']),
    rates: () => ({
      inputHitUsdPerMillion: 0.075,
      inputMissUsdPerMillion: 0.75,
      outputUsdPerMillion: 4.5,
      note: 'OpenAI standard processing price.',
    }),
  },
  {
    id: 'gpt-5.4',
    provider: 'openai',
    label: 'GPT-5.4',
    sourceUrl: 'https://developers.openai.com/api/docs/pricing',
    sourceDate: SOURCE_DATE,
    matches: model => normalizedModel(model).includes('gpt-5.4'),
    rates: () => ({
      inputHitUsdPerMillion: 0.25,
      inputMissUsdPerMillion: 2.5,
      outputUsdPerMillion: 15,
      note: 'OpenAI standard processing price.',
    }),
  },
  {
    id: 'claude-fable-5.1',
    provider: 'anthropic',
    label: 'Claude Fable 5.1',
    sourceUrl: 'https://platform.claude.com/docs/en/models/fable-5-1/overview',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['claude-fable-5-1', 'claude fable 5.1', 'claude-fable-5.1']),
    rates: () => anthropicRates([0.25, 10, 50], 'Claude Fable 5.1'),
  },
  {
    id: 'claude-opus-5.5',
    provider: 'anthropic',
    label: 'Claude Opus 5.5',
    sourceUrl: 'https://platform.claude.com/docs/en/models/opus-5-5/overview',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['claude-opus-5-5', 'claude opus 5.5', 'claude-opus-5.5']),
    rates: () => anthropicRates([0.2, 4, 20], 'Claude Opus 5.5'),
  },
  {
    id: 'claude-sonnet-5.5',
    provider: 'anthropic',
    label: 'Claude Sonnet 5.5',
    sourceUrl: 'https://platform.claude.com/docs/en/models/sonnet-5-5/overview',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['claude-sonnet-5-5', 'claude sonnet 5.5', 'claude-sonnet-5.5']),
    rates: () => anthropicRates([0.1, 2, 10], 'Claude Sonnet 5.5'),
  },
  {
    id: 'claude-haiku-5.5',
    provider: 'anthropic',
    label: 'Claude Haiku 5.5',
    sourceUrl: 'https://platform.claude.com/docs/en/models/haiku-5-5/overview',
    sourceDate: SOURCE_DATE,
    matches: model => includesAny(model, ['claude-haiku-5-5', 'claude haiku 5.5', 'claude-haiku-5.5']),
    rates: usage => {
      const largePrompt = usage.totalCacheTokens > ANTHROPIC_HAIKU_LONG_CONTEXT_THRESHOLD;
      return anthropicRates(
        largePrompt ? [0.05, 0.5, 2.5] : [0.01, 0.1, 0.5],
        `Claude Haiku 5.5 ${largePrompt ? '>100k' : '<=100k'} prompt tier`,
      );
    },
  },
];

export function estimateCacheCost(
  model: string,
  usage: CacheUsageSnapshot,
  timestamp: number = Date.now(),
): {
  pricingSnapshot: PricingSnapshot | null;
  costSnapshot: CacheCostSnapshot | null;
} {
  const rule = PRICING_RULES.find(candidate => candidate.matches(model));
  if (!rule) {
    return {
      pricingSnapshot: null,
      costSnapshot: null,
    };
  }

  const rates = rule.rates(usage, timestamp);
  const usdToCnyRate = getUsdToCnyRate();
  const inputHitCnyPerMillion = rates.inputHitCnyPerMillion ?? rates.inputHitUsdPerMillion * usdToCnyRate;
  const inputMissCnyPerMillion = rates.inputMissCnyPerMillion ?? rates.inputMissUsdPerMillion * usdToCnyRate;
  const outputCnyPerMillion = rates.outputCnyPerMillion ?? rates.outputUsdPerMillion * usdToCnyRate;
  const pricingSnapshot: PricingSnapshot = {
    id: rule.id,
    provider: rule.provider,
    label: rule.label,
    sourceUrl: rule.sourceUrl,
    sourceDate: rule.sourceDate,
    currency: 'CNY',
    usdToCnyRate,
    inputHitUsdPerMillion: rates.inputHitUsdPerMillion,
    inputMissUsdPerMillion: rates.inputMissUsdPerMillion,
    outputUsdPerMillion: rates.outputUsdPerMillion,
    inputHitCnyPerMillion,
    inputMissCnyPerMillion,
    outputCnyPerMillion,
    note: rates.note,
  };

  const hasBillableTokens = usage.hitTokens > 0 || usage.missTokens > 0 || usage.outputTokens > 0;
  if (!hasBillableTokens) {
    return {
      pricingSnapshot,
      costSnapshot: null,
    };
  }

  const inputHitCny = priceTokens(usage.hitTokens, inputHitCnyPerMillion);
  const inputMissCny = priceTokens(usage.missTokens, inputMissCnyPerMillion);
  const outputCny = priceTokens(usage.outputTokens, outputCnyPerMillion);
  const savedCny = Math.max(0, priceTokens(usage.hitTokens, inputMissCnyPerMillion - inputHitCnyPerMillion));

  return {
    pricingSnapshot,
    costSnapshot: {
      currency: 'CNY',
      inputHitCny,
      inputMissCny,
      outputCny,
      totalCny: inputHitCny + inputMissCny + outputCny,
      savedCny,
    },
  };
}

function deepSeekTimeOfUseRates(
  timestamp: number,
  rateTable: {
    offPeak: [number, number, number];
    peak: [number, number, number];
    offPeakCny: [number, number, number];
    peakCny: [number, number, number];
  },
): PricingRateSet {
  const peak = isDeepSeekPeakTime(timestamp);
  const [hit, miss, output] = peak ? rateTable.peak : rateTable.offPeak;
  const [hitCny, missCny, outputCny] = peak ? rateTable.peakCny : rateTable.offPeakCny;
  return {
    inputHitUsdPerMillion: hit,
    inputMissUsdPerMillion: miss,
    outputUsdPerMillion: output,
    inputHitCnyPerMillion: hitCny,
    inputMissCnyPerMillion: missCny,
    outputCnyPerMillion: outputCny,
    note: peak
      ? 'DeepSeek peak rate. Cost uses the official CNY price directly; USD price is reference only.'
      : 'DeepSeek off-peak rate. Cost uses the official CNY price directly; USD price is reference only.',
  };
}

export function isDeepSeekPeakTime(timestamp: number): boolean {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return false;

  const utcDay = date.getUTCDay();
  if (utcDay === 0 || utcDay === 6) return false;
  if (isDeepSeekChinesePublicHoliday(timestamp)) return false;

  const utcHour = date.getUTCHours();
  return (utcHour >= 1 && utcHour < 4) || (utcHour >= 6 && utcHour < 10);
}

function isDeepSeekChinesePublicHoliday(timestamp: number): boolean {
  const chinaDate = new Date(timestamp + 8 * 60 * 60 * 1000);
  const year = chinaDate.getUTCFullYear();
  if (year !== 2026) return false;
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaDate.getUTCDate()).padStart(2, '0');
  return DEEPSEEK_CHINA_PUBLIC_HOLIDAYS_2026.has(`${year}-${month}-${day}`);
}

function geminiFlashIntroRates(timestamp: number, label: string): PricingRateSet {
  const introductory = timestamp < GEMINI_FLASH_INTRO_END;
  return {
    inputHitUsdPerMillion: introductory ? 0.075 : 0.15,
    inputMissUsdPerMillion: introductory ? 0.75 : 1.5,
    outputUsdPerMillion: introductory ? 3.75 : 7.5,
    note: introductory
      ? `${label} introductory standard rate through 2026-12-31.`
      : `${label} standard rate from 2027-01-01.`,
  };
}

function openAiLongContextRates(
  usage: CacheUsageSnapshot,
  shortRates: [number, number, number],
  label: string,
): PricingRateSet {
  const longContext = usage.totalCacheTokens > OPENAI_LONG_CONTEXT_THRESHOLD;
  const [hit, miss, output] = shortRates;
  return {
    inputHitUsdPerMillion: longContext ? hit * 2 : hit,
    inputMissUsdPerMillion: longContext ? miss * 2 : miss,
    outputUsdPerMillion: longContext ? output * 1.5 : output,
    note: `${label} standard processing; ${longContext ? '>272k' : '<=272k'} input-token tier.`,
  };
}

function anthropicRates(rates: [number, number, number], label: string): PricingRateSet {
  const [hit, miss, output] = rates;
  return {
    inputHitUsdPerMillion: hit,
    inputMissUsdPerMillion: miss,
    outputUsdPerMillion: output,
    note: `${label} Claude API standard rate. Cache-write premiums are not separately estimated by this inspector.`,
  };
}

function priceTokens(tokens: number, usdPerMillion: number): number {
  return (tokens * usdPerMillion) / 1_000_000;
}


function includesAny(model: string, fragments: string[]): boolean {
  const normalized = normalizedModel(model);
  return fragments.some(fragment => normalized.includes(fragment));
}

function normalizedModel(model: string): string {
  return model.trim().toLowerCase();
}
