from pathlib import Path


def rep(path, old, new):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if new in s:
        return
    if s.count(old) != 1:
        raise RuntimeError(f'{path}: expected 1 match, got {s.count(old)}')
    p.write_text(s.replace(old, new), encoding='utf-8')

rep('src/世界书管理器/App.vue', "const APP_VERSION = 'v4.07';", "const APP_VERSION = 'v4.08';")

p = Path('src/世界书管理器/version-manager.ts')
s = p.read_text(encoding='utf-8')
s = s.replace('jerryzmtz/worldbook-manager', 'SaigyoujiYusora/worldbook-manager')
p.write_text(s, encoding='utf-8')

rep('src/世界书管理器/cache-inspector/types.ts',
    '  outputUsdPerMillion: number;\n  note: string | null;',
    '  outputUsdPerMillion: number;\n  inputHitCnyPerMillion?: number;\n  inputMissCnyPerMillion?: number;\n  outputCnyPerMillion?: number;\n  note: string | null;')

pricing = Path('src/世界书管理器/cache-inspector/pricing.ts')
s = pricing.read_text(encoding='utf-8')
s = s.replace(
"type PricingRateSet = {\n  inputHitUsdPerMillion: number;\n  inputMissUsdPerMillion: number;\n  outputUsdPerMillion: number;\n  note: string | null;\n};",
"type PricingRateSet = {\n  inputHitUsdPerMillion: number;\n  inputMissUsdPerMillion: number;\n  outputUsdPerMillion: number;\n  inputHitCnyPerMillion?: number;\n  inputMissCnyPerMillion?: number;\n  outputCnyPerMillion?: number;\n  note: string | null;\n};")
s = s.replace("sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing/',", "sourceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',", 2)
s = s.replace("sourceDate: SOURCE_DATE,\n    matches: model =>\n      includesAny(model, ['deepseek-v4-pro'", "sourceDate: '2026-10-14',\n    matches: model =>\n      includesAny(model, ['deepseek-v4-pro'", 1)
s = s.replace("sourceDate: SOURCE_DATE,\n    matches: model =>\n      includesAny(model, [\n        'deepseek-flash'", "sourceDate: '2026-10-14',\n    matches: model =>\n      includesAny(model, [\n        'deepseek-flash'", 1)
s = s.replace("offPeak: [0.022, 0.66, 1.98],\n      peak: [0.044, 1.32, 3.96],", "offPeak: [0.022, 0.66, 1.98],\n      peak: [0.044, 1.32, 3.96],\n      offPeakCny: [0.15, 4.5, 13.5],\n      peakCny: [0.3, 9, 27],")
s = s.replace("offPeak: [0.003, 0.15, 0.6],\n      peak: [0.006, 0.3, 1.2],", "offPeak: [0.003, 0.15, 0.6],\n      peak: [0.006, 0.3, 1.2],\n      offPeakCny: [0.02, 1, 4],\n      peakCny: [0.04, 2, 8],")
s = s.replace("  const rates = rule.rates(usage, timestamp);\n  const usdToCnyRate = getUsdToCnyRate();\n  const pricingSnapshot: PricingSnapshot = {", "  const rates = rule.rates(usage, timestamp);\n  const usdToCnyRate = getUsdToCnyRate();\n  const inputHitCnyPerMillion = rates.inputHitCnyPerMillion ?? rates.inputHitUsdPerMillion * usdToCnyRate;\n  const inputMissCnyPerMillion = rates.inputMissCnyPerMillion ?? rates.inputMissUsdPerMillion * usdToCnyRate;\n  const outputCnyPerMillion = rates.outputCnyPerMillion ?? rates.outputUsdPerMillion * usdToCnyRate;\n  const pricingSnapshot: PricingSnapshot = {")
s = s.replace("    outputUsdPerMillion: rates.outputUsdPerMillion,\n    note: rates.note,", "    outputUsdPerMillion: rates.outputUsdPerMillion,\n    inputHitCnyPerMillion,\n    inputMissCnyPerMillion,\n    outputCnyPerMillion,\n    note: rates.note,")
s = s.replace("  const inputHitUsd = priceTokens(usage.hitTokens, rates.inputHitUsdPerMillion);\n  const inputMissUsd = priceTokens(usage.missTokens, rates.inputMissUsdPerMillion);\n  const outputUsd = priceTokens(usage.outputTokens, rates.outputUsdPerMillion);\n  const savedUsd = Math.max(0, priceTokens(usage.hitTokens, rates.inputMissUsdPerMillion - rates.inputHitUsdPerMillion));", "  const inputHitCny = priceTokens(usage.hitTokens, inputHitCnyPerMillion);\n  const inputMissCny = priceTokens(usage.missTokens, inputMissCnyPerMillion);\n  const outputCny = priceTokens(usage.outputTokens, outputCnyPerMillion);\n  const savedCny = Math.max(0, priceTokens(usage.hitTokens, inputMissCnyPerMillion - inputHitCnyPerMillion));")
s = s.replace("      inputHitCny: usdToCny(inputHitUsd, usdToCnyRate),\n      inputMissCny: usdToCny(inputMissUsd, usdToCnyRate),\n      outputCny: usdToCny(outputUsd, usdToCnyRate),\n      totalCny: usdToCny(inputHitUsd + inputMissUsd + outputUsd, usdToCnyRate),\n      savedCny: usdToCny(savedUsd, usdToCnyRate),", "      inputHitCny,\n      inputMissCny,\n      outputCny,\n      totalCny: inputHitCny + inputMissCny + outputCny,\n      savedCny,")
s = s.replace("  rateTable: { offPeak: [number, number, number]; peak: [number, number, number] },", "  rateTable: {\n    offPeak: [number, number, number];\n    peak: [number, number, number];\n    offPeakCny: [number, number, number];\n    peakCny: [number, number, number];\n  },")
s = s.replace("  const [hit, miss, output] = peak ? rateTable.peak : rateTable.offPeak;\n  return {", "  const [hit, miss, output] = peak ? rateTable.peak : rateTable.offPeak;\n  const [hitCny, missCny, outputCny] = peak ? rateTable.peakCny : rateTable.offPeakCny;\n  return {")
s = s.replace("    outputUsdPerMillion: output,\n    note: peak", "    outputUsdPerMillion: output,\n    inputHitCnyPerMillion: hitCny,\n    inputMissCnyPerMillion: missCny,\n    outputCnyPerMillion: outputCny,\n    note: peak")
s = s.replace("? 'DeepSeek peak rate: 01:00-04:00 or 06:00-10:00 UTC, Monday-Friday, excluding Chinese public holidays.'\n      : 'DeepSeek off-peak rate: all hours outside the weekday peak windows, including weekends and Chinese public holidays.'", "? 'DeepSeek peak rate. Cost uses the official CNY price directly; USD price is reference only.'\n      : 'DeepSeek off-peak rate. Cost uses the official CNY price directly; USD price is reference only.'")
s = s.replace("\nfunction usdToCny(value: number, usdToCnyRate: number): number {\n  return value * usdToCnyRate;\n}\n", "\n")
pricing.write_text(s, encoding='utf-8')

analytics = Path('src/世界书管理器/cache-inspector/analytics.ts')
s = analytics.read_text(encoding='utf-8')
s = s.replace("    const cost =\n      record.costSnapshot ?? estimateCacheCost(record.model, record, record.timestamp).costSnapshot;", "    const legacyDeepSeekPricing =\n      record.pricingSnapshot?.provider === 'deepseek' &&\n      !Number.isFinite(record.pricingSnapshot.inputHitCnyPerMillion);\n    const cost =\n      !legacyDeepSeekPricing && record.costSnapshot\n        ? record.costSnapshot\n        : estimateCacheCost(record.model, record, record.timestamp).costSnapshot;")
analytics.write_text(s, encoding='utf-8')

panel = Path('src/世界书管理器/cache-inspector/CacheInspectorPanel.vue')
s = panel.read_text(encoding='utf-8')
s = s.replace("formatMillionRateCny(pricing.inputHitUsdPerMillion, pricing.usdToCnyRate)", "formatPricingRateCny(pricing.inputHitCnyPerMillion, pricing.inputHitUsdPerMillion, pricing.usdToCnyRate)")
s = s.replace("formatMillionRateCny(pricing.inputMissUsdPerMillion, pricing.usdToCnyRate)", "formatPricingRateCny(pricing.inputMissCnyPerMillion, pricing.inputMissUsdPerMillion, pricing.usdToCnyRate)")
s = s.replace("formatMillionRateCny(pricing.outputUsdPerMillion, pricing.usdToCnyRate)", "formatPricingRateCny(pricing.outputCnyPerMillion, pricing.outputUsdPerMillion, pricing.usdToCnyRate)")
s = s.replace("formatMillionRateCny(pricingSnapshot.inputHitUsdPerMillion, pricingSnapshot.usdToCnyRate)", "formatPricingRateCny(pricingSnapshot.inputHitCnyPerMillion, pricingSnapshot.inputHitUsdPerMillion, pricingSnapshot.usdToCnyRate)")
s = s.replace("formatMillionRateCny(pricingSnapshot.inputMissUsdPerMillion, pricingSnapshot.usdToCnyRate)", "formatPricingRateCny(pricingSnapshot.inputMissCnyPerMillion, pricingSnapshot.inputMissUsdPerMillion, pricingSnapshot.usdToCnyRate)")
s = s.replace("formatMillionRateCny(pricingSnapshot.outputUsdPerMillion, pricingSnapshot.usdToCnyRate)", "formatPricingRateCny(pricingSnapshot.outputCnyPerMillion, pricingSnapshot.outputUsdPerMillion, pricingSnapshot.usdToCnyRate)")
s = s.replace("`费率日期 ${pricingSnapshot.sourceDate} · 1 USD = ${pricingSnapshot.usdToCnyRate.toFixed(4)} RMB`,", "pricingSnapshot.provider === 'deepseek'\n      ? `费率日期 ${pricingSnapshot.sourceDate} · DeepSeek 官方人民币价（不经美元汇率换算）`\n      : `费率日期 ${pricingSnapshot.sourceDate} · 1 USD = ${pricingSnapshot.usdToCnyRate.toFixed(4)} RMB`,")
s = s.replace("  if (record.pricingSnapshot && record.costSnapshot) {\n    return { pricingSnapshot: record.pricingSnapshot, costSnapshot: record.costSnapshot };\n  }", "  const legacyDeepSeekPricing =\n    record.pricingSnapshot?.provider === 'deepseek' &&\n    !Number.isFinite(record.pricingSnapshot.inputHitCnyPerMillion);\n  if (!legacyDeepSeekPricing && record.pricingSnapshot && record.costSnapshot) {\n    return { pricingSnapshot: record.pricingSnapshot, costSnapshot: record.costSnapshot };\n  }")
s = s.replace("function formatMillionRateCny(usdPerMillion: number, usdToCnyRate: number): string {\n  return trimTrailingZero((usdPerMillion * usdToCnyRate).toFixed(3));\n}", "function formatPricingRateCny(cnyPerMillion: number | undefined, usdPerMillion: number, usdToCnyRate: number): string {\n  const value = Number.isFinite(cnyPerMillion) ? Number(cnyPerMillion) : usdPerMillion * usdToCnyRate;\n  return trimTrailingZero(value.toFixed(3));\n}")
panel.write_text(s, encoding='utf-8')

# Test direct RMB billing.
test = Path('src/世界书管理器/cache-inspector/pricing.test.cjs')
s = test.read_text(encoding='utf-8')
anchor = "test('DeepSeek Chinese public holidays are off-peak even on weekdays', () => {"
extra = """test('DeepSeek V4 Pro uses official CNY rates directly', () => {\n  const timestamp = Date.parse('2026-10-09T04:30:00Z');\n  const result = estimateCacheCost('deepseek-v4-pro', usage({ hit: 1000000, miss: 1000000, output: 1000000 }), timestamp);\n  assert.equal(result.pricingSnapshot.inputHitCnyPerMillion, 0.15);\n  assert.equal(result.pricingSnapshot.inputMissCnyPerMillion, 4.5);\n  assert.equal(result.pricingSnapshot.outputCnyPerMillion, 13.5);\n  assert.equal(result.costSnapshot.totalCny, 18.15);\n});\n\ntest('DeepSeek Flash uses official CNY rates directly', () => {\n  const timestamp = Date.parse('2026-10-09T01:30:00Z');\n  const result = estimateCacheCost('deepseek-flash', usage({ hit: 1000000, miss: 1000000, output: 1000000 }), timestamp);\n  assert.equal(result.pricingSnapshot.inputHitCnyPerMillion, 0.04);\n  assert.equal(result.pricingSnapshot.inputMissCnyPerMillion, 2);\n  assert.equal(result.pricingSnapshot.outputCnyPerMillion, 8);\n  assert.equal(result.costSnapshot.totalCny, 10.04);\n});\n\n"""
if 'official CNY rates directly' not in s:
    s = s.replace(anchor, extra + anchor)
test.write_text(s, encoding='utf-8')
