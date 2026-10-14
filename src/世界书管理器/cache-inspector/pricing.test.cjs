const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
});
require('ts-node/register/transpile-only');

const { estimateCacheCost, isDeepSeekPeakTime } = require('./pricing.ts');

function usage({ hit = 1000, miss = 1000, output = 1000 } = {}) {
  const totalCacheTokens = hit + miss;
  return {
    hitTokens: hit,
    missTokens: miss,
    totalCacheTokens,
    hitRate: totalCacheTokens > 0 ? hit / totalCacheTokens : null,
    outputTokens: output,
    totalTokens: totalCacheTokens + output,
    rawUsage: null,
  };
}

function rates(model, timestamp, input = usage()) {
  const result = estimateCacheCost(model, input, timestamp);
  assert.ok(result.pricingSnapshot, `expected pricing for ${model}`);
  return result.pricingSnapshot;
}

test('DeepSeek Flash uses peak rates during weekday peak windows', () => {
  const timestamp = Date.parse('2026-10-09T01:30:00Z'); // Friday, not a Chinese public holiday.
  assert.equal(isDeepSeekPeakTime(timestamp), true);
  const pricing = rates('deepseek-flash', timestamp);
  assert.equal(pricing.inputHitUsdPerMillion, 0.006);
  assert.equal(pricing.inputMissUsdPerMillion, 0.3);
  assert.equal(pricing.outputUsdPerMillion, 1.2);
});

test('DeepSeek Flash uses off-peak rates outside peak windows', () => {
  const timestamp = Date.parse('2026-10-09T04:30:00Z');
  assert.equal(isDeepSeekPeakTime(timestamp), false);
  const pricing = rates('deepseek-v4.1-flash', timestamp);
  assert.equal(pricing.inputHitUsdPerMillion, 0.003);
  assert.equal(pricing.inputMissUsdPerMillion, 0.15);
  assert.equal(pricing.outputUsdPerMillion, 0.6);
});

test('DeepSeek V4 Pro uses official CNY rates directly instead of USD FX conversion', () => {
  const timestamp = Date.parse('2026-10-09T04:30:00Z'); // 12:30 Beijing, off-peak.
  const result = estimateCacheCost('deepseek-v4-pro', usage({ hit: 1_000_000, miss: 1_000_000, output: 1_000_000 }), timestamp);
  assert.equal(result.pricingSnapshot.inputHitCnyPerMillion, 0.15);
  assert.equal(result.pricingSnapshot.inputMissCnyPerMillion, 4.5);
  assert.equal(result.pricingSnapshot.outputCnyPerMillion, 13.5);
  assert.equal(result.costSnapshot.inputHitCny, 0.15);
  assert.equal(result.costSnapshot.inputMissCny, 4.5);
  assert.equal(result.costSnapshot.outputCny, 13.5);
  assert.equal(result.costSnapshot.totalCny, 18.15);
});

test('DeepSeek Flash uses official CNY rates directly instead of USD FX conversion', () => {
  const timestamp = Date.parse('2026-10-09T01:30:00Z'); // 09:30 Beijing, peak.
  const result = estimateCacheCost('deepseek-flash', usage({ hit: 1_000_000, miss: 1_000_000, output: 1_000_000 }), timestamp);
  assert.equal(result.pricingSnapshot.inputHitCnyPerMillion, 0.04);
  assert.equal(result.pricingSnapshot.inputMissCnyPerMillion, 2);
  assert.equal(result.pricingSnapshot.outputCnyPerMillion, 8);
  assert.equal(result.costSnapshot.totalCny, 10.04);
});

test('DeepSeek Chinese public holidays are off-peak even on weekdays', () => {
  const timestamp = Date.parse('2026-10-05T01:30:00Z'); // National Day holiday.
  assert.equal(isDeepSeekPeakTime(timestamp), false);
  const pricing = rates('deepseek-v4-pro', timestamp);
  assert.equal(pricing.inputHitUsdPerMillion, 0.022);
  assert.equal(pricing.inputMissUsdPerMillion, 0.66);
  assert.equal(pricing.outputUsdPerMillion, 1.98);
});

test('legacy DeepSeek V4 Flash aliases use V4.1 Flash pricing', () => {
  const pricing = rates('deepseek-v4-flash-vision-exp', Date.parse('2026-10-10T01:30:00Z'));
  assert.equal(pricing.id, 'deepseek-v4.1-flash');
});

test('GPT-6.1 Sol applies the long-context multiplier above 272k input tokens', () => {
  const pricing = rates(
    'gpt-6.1-sol',
    Date.parse('2026-10-10T00:00:00Z'),
    usage({ hit: 200_000, miss: 72_001, output: 1000 }),
  );
  assert.equal(pricing.inputHitUsdPerMillion, 0.2);
  assert.equal(pricing.inputMissUsdPerMillion, 4);
  assert.equal(pricing.outputUsdPerMillion, 15);
});

test('GPT-5.6 alias routes to GPT-5.6 Sol pricing', () => {
  const pricing = rates('gpt-5.6', Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(pricing.id, 'gpt-5.6-sol');
  assert.equal(pricing.inputHitUsdPerMillion, 0.4);
  assert.equal(pricing.inputMissUsdPerMillion, 4);
  assert.equal(pricing.outputUsdPerMillion, 20);
});

test('Gemini 3.8 Flash switches from introductory to 2027 standard pricing', () => {
  const intro = rates('gemini-3.8-flash', Date.parse('2026-12-31T12:00:00Z'));
  assert.equal(intro.inputHitUsdPerMillion, 0.075);
  assert.equal(intro.inputMissUsdPerMillion, 0.75);
  assert.equal(intro.outputUsdPerMillion, 3.75);

  const standard = rates('gemini-3.8-flash', Date.parse('2027-01-01T00:00:00Z'));
  assert.equal(standard.inputHitUsdPerMillion, 0.15);
  assert.equal(standard.inputMissUsdPerMillion, 1.5);
  assert.equal(standard.outputUsdPerMillion, 7.5);
});

test('current Claude models expose standard cache-read/input/output rates', () => {
  const sonnet = rates('claude-sonnet-5-5', Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(sonnet.inputHitUsdPerMillion, 0.1);
  assert.equal(sonnet.inputMissUsdPerMillion, 2);
  assert.equal(sonnet.outputUsdPerMillion, 10);

  const opus = rates('claude-opus-5-5', Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(opus.inputHitUsdPerMillion, 0.2);
  assert.equal(opus.inputMissUsdPerMillion, 4);
  assert.equal(opus.outputUsdPerMillion, 20);
});

test('Claude Haiku 5.5 applies its >100k prompt tier', () => {
  const short = rates('claude-haiku-5-5', Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(short.inputHitUsdPerMillion, 0.01);
  assert.equal(short.inputMissUsdPerMillion, 0.1);
  assert.equal(short.outputUsdPerMillion, 0.5);

  const long = rates(
    'claude-haiku-5-5',
    Date.parse('2026-10-10T00:00:00Z'),
    usage({ hit: 80_000, miss: 20_001, output: 1000 }),
  );
  assert.equal(long.inputHitUsdPerMillion, 0.05);
  assert.equal(long.inputMissUsdPerMillion, 0.5);
  assert.equal(long.outputUsdPerMillion, 2.5);
});
