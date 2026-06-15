// 现货黄金 - 境外可用版（fawazahmed0 currency API，无需 key）
// XAU/USD 实时价格 + 纯文字 Widget，兼容 Egern JS 沙箱

export default async function (ctx) {
  // 主接口（jsDelivr CDN 加速）
  const URL_PRIMARY   = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json';
  // 备用接口（Cloudflare Pages 直连）
  const URL_FALLBACK  = 'https://latest.currency-api.pages.dev/v1/currencies/xau.json';

  let xauUsd = NaN;
  let updatedAt = '';

  for (const url of [URL_PRIMARY, URL_FALLBACK]) {
    try {
      const resp = await ctx.http.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });
      if (resp.status !== 200) continue;
      const j = await resp.json();
      // j.xau.usd = 1 XAU 值多少 USD
      const rate = j?.xau?.usd;
      if (typeof rate === 'number' && isFinite(rate)) {
        xauUsd = rate;
        updatedAt = j?.date ?? '';
        break;
      }
    } catch (e) {
      console.log('金价拉取失败: ' + e);
    }
  }

  // 昨日收盘（用于计算涨跌幅）—— 同源 API 取昨日数据
  let prevClose = NaN;
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const urlYest = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${yesterday}/v1/currencies/xau.json`;
    const r = await ctx.http.get(urlYest, {
      timeout: 6000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });
    if (r.status === 200) {
      const j = await r.json();
      const v = j?.xau?.usd;
      if (typeof v === 'number' && isFinite(v)) prevClose = v;
    }
  } catch (e) {
    console.log('昨日数据失败: ' + e);
  }

  // 涨跌幅
  const pct = (isFinite(xauUsd) && isFinite(prevClose) && prevClose > 0)
    ? ((xauUsd - prevClose) / prevClose) * 100
    : NaN;

  const priceText = isFinite(xauUsd) ? xauUsd.toFixed(2) : '--';
  const diffText  = (isFinite(xauUsd) && isFinite(prevClose))
    ? (xauUsd - prevClose >= 0 ? '+' : '') + (xauUsd - prevClose).toFixed(2)
    : '';

  let trendText  = '--';
  let trendColor = '#999999';
  if (isFinite(pct)) {
    if (pct > 0)      { trendText = `↑ +${pct.toFixed(2)}%`; trendColor = '#FF3B30'; }
    else if (pct < 0) { trendText = `↓ ${pct.toFixed(2)}%`;  trendColor = '#34C759'; }
    else              { trendText = '→ 0.00%';                trendColor = '#FF9F0A'; }
  }

  const mainColor = trendColor === '#999999' ? '#FFFFFF' : trendColor;
  const nowISO    = new Date().toISOString();

  return {
    type: 'widget',
    padding: 14,
    gap: 8,
    refreshAfter: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    backgroundGradient: {
      type: 'linear',
      colors: ['#1a1a1a', '#0d0d0d'],
      stops: [0, 1],
      startPoint: { x: 0, y: 0 },
      endPoint:   { x: 1, y: 1 },
    },
    children: [
      // 标题行
      {
        type: 'stack', direction: 'row', alignItems: 'center', height: 22,
        children: [
          { type: 'image', src: 'sf-symbol:diamond.circle.fill', width: 14, height: 14, color: '#FFD166' },
          { type: 'spacer', length: 6 },
          { type: 'text', text: '现货黄金 XAU/USD', font: { size: 13, weight: 'black' }, textColor: '#FFFFFF', maxLines: 1 },
          { type: 'spacer' },
          { type: 'text', text: 'USD/troy oz', font: { size: 'caption2' }, textColor: '#666666', maxLines: 1 },
        ],
      },
      // 价格行
      {
        type: 'stack', direction: 'row', alignItems: 'baseline', height: 48,
        children: [
          { type: 'text', text: priceText, font: { size: 38, weight: 'bold', design: 'rounded' }, textColor: mainColor, maxLines: 1, minScale: 0.7 },
          { type: 'spacer', length: 10 },
          {
            type: 'stack', direction: 'column', alignItems: 'flex-end',
            children: [
              { type: 'text', text: trendText, font: { size: 14, weight: 'semibold' }, textColor: trendColor, maxLines: 1 },
              ...(diffText ? [{ type: 'text', text: diffText, font: { size: 'caption1' }, textColor: trendColor, maxLines: 1 }] : []),
            ],
          },
        ],
      },
      // 底部时间行
      {
        type: 'stack', direction: 'row', alignItems: 'center', height: 16,
        children: [
          { type: 'image', src: 'sf-symbol:clock.arrow.circlepath', width: 10, height: 10, color: '#555555' },
          { type: 'spacer', length: 4 },
          { type: 'date', date: nowISO, format: 'time', font: { size: 'caption2' }, textColor: '#666666' },
          { type: 'spacer' },
          { type: 'text', text: updatedAt ? `数据日期: ${updatedAt}` : 'fawazahmed0', font: { size: 'caption2' }, textColor: '#444444', maxLines: 1 },
        ],
      },
    ],
  };
}
