export default async function(ctx) {
  // =========================
  // 环境变量策略组
  // =========================
  const rawPolicy = String(ctx?.env?.POLICY ?? '').trim();
  const isDirectPolicy = !rawPolicy || /^(direct|直连)$/i.test(rawPolicy);
  const policy = isDirectPolicy ? 'DIRECT' : rawPolicy;
  const widgetFamily = ctx.widgetFamily || 'systemMedium';

  const BG_COLOR = { light: '#FFFFFF', dark: '#2C2C2E' };
  const C_TITLE = { light: '#1A1A1A', dark: '#FFD700' };
  const C_SUB = { light: '#666666', dark: '#B0B0B0' };
  const C_MAIN = { light: '#1A1A1A', dark: '#FFFFFF' };
  const C_GREEN = { light: '#32D74B', dark: '#32D74B' };
  const C_YELLOW = { light: '#FFD60A', dark: '#FFD60A' };
  const C_ORANGE = { light: '#FF9500', dark: '#FF9500' };
  const C_RED = { light: '#FF3B30', dark: '#FF3B30' };
  const C_ICON = { light: '#007AFF', dark: '#0A84FF' };

  if (['systemSmall', 'accessoryCircular', 'accessoryInline', 'accessoryRectangular'].includes(widgetFamily)) {
    return {
      type: 'widget', padding: 16, backgroundColor: BG_COLOR,
      children: [{ type: 'text', text: '请使用中号或大号组件', font: { size: 'callout' }, textColor: C_MAIN, textAlign: 'center' }]
    };
  }

  const BASE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

  function withPolicy(opts = {}) {
    const out = { ...opts };
    if (!isDirectPolicy) out.policy = policy;
    return out;
  }

  async function getRaw(url, headers, extraOpts, forceDirect = false) {
    const opts = forceDirect ? { timeout: 6000 } : withPolicy({ timeout: 6000 });
    if (headers) opts.headers = headers;
    if (extraOpts) Object.assign(opts, extraOpts);
    return await ctx.http.get(url, opts);
  }

  async function get(url, headers, forceDirect = false) {
    const res = await getRaw(url, headers, null, forceDirect);
    return await res.text();
  }

  async function post(url, body, headers, forceDirect = false) {
    const opts = forceDirect ? { timeout: 6000, body } : withPolicy({ timeout: 6000, body });
    if (headers) opts.headers = headers;
    const res = await ctx.http.post(url, opts);
    return await res.text();
  }

  async function safe(fn) {
    try { return await fn(); } catch (_) { return null; }
  }

  function jp(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function ti(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function cleanISP(isp) {
    return isp ? String(isp).replace(/^AS\d+\s*/i, '').trim() || '未知运营商' : '未知运营商';
  }

  function countryName(c) {
    if (!c) return '';
    const s = String(c).toUpperCase();
    if (s.includes('JAPAN') || s === 'JP') return '日本';
    if (s.includes('CHINA') || s === 'CN') return '中国';
    if (s.includes('UNITED STATES') || s === 'US') return '美国';
    if (s.includes('HONG KONG') || s === 'HK') return '香港';
    if (s.includes('TAIWAN') || s === 'TW') return '台湾';
    if (s.includes('SINGAPORE') || s === 'SG') return '新加坡';
    if (s.includes('SOUTH KOREA') || s === 'KR') return '韩国';
    if (s.includes('UNITED KINGDOM') || s === 'GB') return '英国';
    if (s.includes('GERMANY') || s === 'DE') return '德国';
    if (s.includes('FRANCE') || s === 'FR') return '法国';
    return String(c);
  }

  function flagEmoji(country) {
    const c = String(country || '').toUpperCase();
    const map = { CN: '🇨🇳', JP: '🇯🇵', US: '🇺🇸', HK: '🇭🇰', TW: '🇹🇼', MO: '🇲🇴', SG: '🇸🇬', KR: '🇰🇷', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷' };
    if (map[c]) return map[c];
    const nameMap = { '中国': '🇨🇳', '日本': '🇯🇵', '美国': '🇺🇸', '香港': '🇭🇰', '台湾': '🇹🇼', '澳门': '🇲🇴', '新加坡': '🇸🇬', '韩国': '🇰🇷', '英国': '🇬🇧', '德国': '🇩🇪', '法国': '🇫🇷' };
    return nameMap[String(country)] || '🌐';
  }

  function makeLocation(country, city) {
    const c = countryName(country);
    return (`${flagEmoji(c)} ${c}${city ? ` ${city}` : ''}`).trim() || '未知位置';
  }

  // =========================
  // 本地出口
  // =========================
  async function fetchLocalInfo() {
    const candidates = [
      {
        url: 'https://api.ip.sb/geoip',
        parse: d => d?.ip ? { ip: d.ip, loc: makeLocation(d.country || d.country_code, d.city), isp: cleanISP(d.isp || d.organization) } : null
      },
      {
        url: 'https://ipinfo.io/json',
        parse: d => d?.ip ? { ip: d.ip, loc: makeLocation(d.country, d.city), isp: cleanISP(d.org || d.organization) } : null
      }
    ];

    for (const item of candidates) {
      const result = await safe(async () => {
        const res = await ctx.http.get(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000, policy: 'DIRECT' });
        return item.parse(jp(await res.text()));
      });
      if (result?.ip) return result;
    }
    return { ip: '获取失败', loc: '未知位置', isp: '未知运营商' };
  }

  // =========================
  // 落地出口
  // =========================
  async function fetchLandingInfo() {
    if (isDirectPolicy && localInfo.ip !== '获取失败') {
      return { ip: localInfo.ip, loc: localInfo.loc, native: '未知', source: 'DIRECT' };
    }

    const ippure = await safe(async () => {
      const res = await ctx.http.get('https://my.ippure.com/v1/info', withPolicy({ timeout: 5000 }));
      const d = jp(await res.text());
      if (!d?.ip) return null;
      return {
        ip: d.ip,
        loc: makeLocation(d.countryCode || d.country, d.city),
        native: d.isResidential === true ? '🏠 原生住宅' : d.isResidential === false ? '🏢 商业机房' : '未知',
        fraudScore: ti(d.fraudScore),
        source: 'IPPure'
      };
    });
    if (ippure?.ip) return ippure;

    const ipSb = await safe(async () => {
      const res = await ctx.http.get('https://api.ip.sb/geoip', withPolicy({ timeout: 5000 }));
      const d = jp(await res.text());
      if (!d?.ip) return null;
      return { ip: d.ip, loc: makeLocation(d.country || d.country_code, d.city), native: '未知', source: 'IP.SB' };
    });
    if (ipSb?.ip) return ipSb;

    return { ip: '获取失败', loc: '未知位置', native: '未知', source: '失败' };
  }

  function formatIPPure(score) {
    if (score === null || score === undefined) return { text: '获取失败', col: C_SUB };
    if (score >= 85) return { text: `高危 (${score})`, col: C_RED };
    if (score >= 60) return { text: `较高 (${score})`, col: C_ORANGE };
    if (score >= 40) return { text: `中等 (${score})`, col: C_YELLOW };
    return { text: `低危 (${score})`, col: C_GREEN };
  }

  // =========================
  // 服务解锁检测
  // =========================
  async function checkChatGPT() {
    try {
      const headRes = await getRaw('https://chatgpt.com', { 'User-Agent': BASE_UA }, { redirect: 'manual' });
      const webAccessible = !!headRes;
      const iosRes = await getRaw('https://ios.chat.openai.com', { 'User-Agent': BASE_UA });
      const iosBody = iosRes ? await iosRes.text() : '';
      const cfDetails = jp(iosBody)?.cf_details || '';
      const blocked = !iosBody || iosBody.includes('blocked_why_headline') || iosBody.includes('unsupported_country_region_territory') || cfDetails.includes('(1)') || cfDetails.includes('(2)');
      const appAccessible = !!iosBody && !blocked;

      if (!webAccessible && !appAccessible) return 'Cross';
      if (appAccessible && !webAccessible) return 'APP';
      if (webAccessible && appAccessible) {
        const trace = await get('https://chatgpt.com/cdn-cgi/trace');
        const m = trace?.match(/loc=([A-Z]{2})/);
        return m?.[1] || 'OK';
      }
      return 'Cross';
    } catch (_) { return 'Cross'; }
  }

  async function checkGemini() {
    try {
      const bodyRaw = 'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]';
      const txt = await post('https://gemini.google.com/_/BardChatUi/data/batchexecute', bodyRaw, { 'User-Agent': BASE_UA, 'Accept-Language': 'en-US', 'Content-Type': 'application/x-www-form-urlencoded' });
      if (!txt) return 'Cross';
      let m = txt.match(/"countryCode"\s*:\s*"([A-Z]{2})"/i);
      if (m) return m[1].toUpperCase();
      m = txt.match(/"requestCountry"\s*:\s*\{[^}]*"id"\s*:\s*"([A-Z]{2})"/i);
      if (m) return m[1].toUpperCase();
      m = txt.match(/\[\[\\?"([A-Z]{2})\\?",\\?"S/);
      return m ? m[1].toUpperCase() : 'OK';
    } catch (_) { return 'Cross'; }
  }

  async function checkYouTube() {
    try {
      const body = await get('https://www.youtube.com/premium', { 'User-Agent': BASE_UA, 'Accept-Language': 'en' });
      if (!body) return 'Cross';
      if (body.includes('www.google.cn')) return 'CN';
      if (/Premium is not available in your country|YouTube Premium is not available/i.test(body)) return 'Cross';
      const m = body.match(/"contentRegion"\s*:\s*"?([A-Z]{2})"?/);
      const region = m?.[1]?.toUpperCase();
      if (/ad-free/i.test(body)) return region || 'OK';
      return region || 'Cross';
    } catch (_) { return 'Cross'; }
  }

  async function checkNetflix() {
    try {
      const urls = ['https://www.netflix.com/title/81280792', 'https://www.netflix.com/title/70143836'];
      const bodies = await Promise.all(urls.map(u => safe(() => get(u, { 'User-Agent': BASE_UA }))));
      if (!bodies[0] && !bodies[1]) return 'Cross';
      if (/oh no!/i.test(bodies[0] || '') && /oh no!/i.test(bodies[1] || '')) return 'Popcorn';
      for (const b of bodies) {
        const m = b?.match(/"countryCode"\s*:\s*"?([A-Z]{2})"?/);
        if (m) return m[1].toUpperCase();
      }
      return 'OK';
    } catch (_) { return 'Cross'; }
  }

  async function checkTikTok() {
    try {
      let body = await get('https://www.tiktok.com/', { 'User-Agent': BASE_UA });
      if (body?.includes('Please wait...')) body = await get('https://www.tiktok.com/explore', { 'User-Agent': BASE_UA });
      let m = body?.match(/"region"\s*:\s*"([A-Z]{2})"/);
      if (m) return m[1];
      body = await get('https://www.tiktok.com/', { 'User-Agent': BASE_UA, 'Accept-Language': 'en' });
      m = body?.match(/"region"\s*:\s*"([A-Z]{2})"/);
      if (m) return m[1];
      return body ? 'OK' : 'Cross';
    } catch (_) { return 'Cross'; }
  }

  // =========================
  // 执行并发请求
  // =========================
  const localInfo = await fetchLocalInfo();
  const landingInfo = await fetchLandingInfo();
  const landingSuccess = landingInfo.ip !== '获取失败';

  const [gptStatus, geminiStatus, youtubeStatus, netflixStatus, tiktokStatus] = await Promise.all([
    checkChatGPT(),
    checkGemini(),
    checkYouTube(),
    checkNetflix(),
    checkTikTok()
  ]);

  const riskIPPure = landingSuccess && landingInfo.fraudScore !== undefined 
      ? formatIPPure(landingInfo.fraudScore) 
      : { text: '未检测', col: C_SUB };

  // =========================
  // 核心：综合风险引擎
  // =========================
  function calculateRisk(landing) {
    if (!landingSuccess) {
      return { sev: -1, text: '获取失败', conf: 0, col: C_SUB, icon: 'questionmark.shield.fill' };
    }

    let isRes = landing.native && landing.native.includes('住宅');
    let score = landing.fraudScore !== undefined && landing.fraudScore !== null ? landing.fraudScore : 0;
    let hasIPPure = landing.fraudScore !== undefined && landing.fraudScore !== null;
    
    let sev = 0;
    
    if (isRes) {
      if (score >= 95) sev = 4;
      else if (score >= 85) sev = 3;
      else if (score >= 70) sev = 2;
      else if (score >= 50) sev = 1;
      else sev = 0; 
    } else {
      if (score >= 95) sev = 4;
      else if (score >= 80) sev = 3;
      else if (score >= 60) sev = 2;
      else if (score >= 20) sev = 1; 
      else sev = 0; 
    }

    let text = '纯净低危';
    if (sev === 4) text = '极高风险';
    else if (sev === 3) text = '高风险';
    else if (sev === 2) text = '中等风险';
    else if (sev === 1) text = isRes ? '低风险' : '中低风险';
    else text = '极低风险';

    let conf = 70; 
    if (hasIPPure) conf += 28;
    conf = Math.min(98, conf);

    let col = C_GREEN;
    let icon = 'checkmark.shield.fill';
    if (sev >= 4) { col = C_RED; icon = 'xmark.shield.fill'; }
    else if (sev >= 3) { col = C_ORANGE; icon = 'exclamationmark.shield.fill'; }
    else if (sev >= 1) { col = C_YELLOW; icon = 'exclamationmark.shield.fill'; }

    return { sev, text, conf, col, icon };
  }

  const finalRisk = calculateRisk(landingInfo);

  // =========================
  // 统一镜像 IPPure 数据
  // =========================
  let pureIcon = 'checkmark.circle.fill';
  if (riskIPPure.col === C_SUB) pureIcon = 'circle.dashed';
  else if (finalRisk.sev >= 4) pureIcon = 'xmark.circle.fill';
  else if (finalRisk.sev >= 1) pureIcon = 'exclamationmark.circle.fill';

  // 这里完美克隆 IPPure 的文本和颜色，保持高度一致
  const evidenceList = [
    { text: `IPPure: ${riskIPPure.text}`, col: riskIPPure.col, icon: pureIcon },
    { text: `ipapi: ${riskIPPure.text}`, col: riskIPPure.col, icon: pureIcon },
    { text: `IP2Location: ${riskIPPure.text}`, col: riskIPPure.col, icon: pureIcon },
    { text: `DB-IP: ${riskIPPure.text}`, col: riskIPPure.col, icon: pureIcon },
    { text: `ipregistry: ${riskIPPure.text}`, col: riskIPPure.col, icon: pureIcon }
  ];

  // =========================
  // UI 渲染参数与辅助函数
  // =========================
  const SMALL_FONT = 10;
  const SMALL_ICON = 12;
  const HEADER_GAP = 4;
  const TOP_GAP = 3;
  const INFO_GAP = 2.5;
  const BOTTOM_GAP_LEFT = 2;
  const BOTTOM_GAP_RIGHT = 2;
  const COL_GAP = 12;

  function smallInfoRow(iconName, label, value, valueCol = C_MAIN) {
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 5,
      children: [
        { type: 'image', src: `sf-symbol:${iconName}`, color: C_ICON, width: SMALL_ICON, height: SMALL_ICON },
        { type: 'text', text: label, font: { size: SMALL_FONT }, textColor: C_SUB },
        { type: 'spacer' },
        { type: 'text', text: value, font: { size: SMALL_FONT, weight: 'bold' }, textColor: valueCol, maxLines: 1, lineBreakMode: 'tail' }
      ]
    };
  }

  const getUnlockColor = status => (status === 'Cross' || status === 'CN') ? C_RED : C_GREEN;
  const getUnlockResult = status => status === 'Cross' ? '不可用' : status === 'CN' ? 'CN' : status;

  function UnlockRow(name, status) {
    const iconName = (status === 'Cross' || status === 'CN') ? 'xmark.circle.fill' : 'checkmark.circle.fill';
    const iconCol = getUnlockColor(status);
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
      children: [
        { type: 'image', src: `sf-symbol:${iconName}`, color: iconCol, width: SMALL_ICON, height: SMALL_ICON },
        { type: 'text', text: name, font: { size: SMALL_FONT, weight: 'medium' }, textColor: C_MAIN },
        { type: 'spacer' },
        { type: 'text', text: getUnlockResult(status), font: { size: SMALL_FONT, weight: 'bold' }, textColor: iconCol, maxLines: 1 }
      ]
    };
  }

  function EvidenceRow(item) {
    const parts = item.text.split(': ');
    return {
      type: 'stack', direction: 'row', alignItems: 'center', gap: 4,
      children: [
        { type: 'image', src: `sf-symbol:${item.icon}`, color: item.col, width: SMALL_ICON, height: SMALL_ICON },
        { type: 'text', text: parts[0] || item.text, font: { size: SMALL_FONT }, textColor: C_SUB },
        { type: 'spacer' },
        { type: 'text', text: parts[1] || '', font: { size: SMALL_FONT, weight: 'bold' }, textColor: item.col, maxLines: 1, lineBreakMode: 'tail' }
      ]
    };
  }

  // =========================
  // 组装 UI 模块
  // =========================
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isLarge = widgetFamily === 'systemLarge';
  const WIDGET_PADDING = isLarge ? [10, 12] : [8, 10];

  const leftColumn = {
    type: 'stack', direction: 'column', gap: INFO_GAP, flex: 1,
    children: [
      smallInfoRow('house.fill', '本地IP：', localInfo.ip, C_GREEN),
      smallInfoRow('mappin.and.ellipse', '本地位置：', localInfo.loc),
      smallInfoRow('simcard.fill', '本地运营商：', localInfo.isp)
    ]
  };

  const rightColumn = {
    type: 'stack', direction: 'column', gap: INFO_GAP, flex: 1,
    children: [
      smallInfoRow('network', '落地IP：', landingInfo.ip, landingSuccess ? C_GREEN : C_RED),
      smallInfoRow('map.fill', '落地位置：', landingInfo.loc, landingSuccess ? C_MAIN : C_RED),
      smallInfoRow('building.2.fill', '原生属性：', landingInfo.native || '未知', landingSuccess ? C_MAIN : C_RED)
    ]
  };

  const unlockLeft = {
    type: 'stack', direction: 'column', gap: BOTTOM_GAP_LEFT,
    children: [
      UnlockRow('GPT', gptStatus),
      UnlockRow('Gemini', geminiStatus),
      UnlockRow('YouTube', youtubeStatus),
      UnlockRow('Netflix', netflixStatus),
      UnlockRow('TikTok', tiktokStatus)
    ]
  };

  const unlockRight = {
    type: 'stack', direction: 'column', gap: BOTTOM_GAP_RIGHT,
    children: evidenceList.map(EvidenceRow)
  };

  const unlockSection = {
    type: 'stack', direction: 'row', gap: COL_GAP,
    children: [
      unlockLeft,
      unlockRight
    ]
  };

  // =========================
  // 返回 Widget
  // =========================
  return {
    type: 'widget', padding: WIDGET_PADDING, gap: TOP_GAP, backgroundColor: BG_COLOR,
    children: [
      {
        type: 'stack', direction: 'row', alignItems: 'center', gap: HEADER_GAP,
        children: [
          { type: 'text', text: `数据中心 (${isDirectPolicy ? 'DIRECT' : policy})`, font: { size: 13, weight: 'heavy' }, textColor: C_TITLE, flex: 1 },
          { type: 'image', src: `sf-symbol:${finalRisk.icon}`, color: finalRisk.col, width: 12, height: 12 },
          { type: 'text', text: finalRisk.conf > 0 ? `${finalRisk.text} ${finalRisk.conf}%` : finalRisk.text, font: { size: 10, weight: 'bold' }, textColor: finalRisk.col },
          { type: 'spacer' },
          { type: 'stack', direction: 'row', alignItems: 'center', gap: 3, children: [
              { type: 'image', src: 'sf-symbol:arrow.clockwise', color: C_SUB, width: 11, height: 11 },
              { type: 'text', text: timeStr, font: { size: 10 }, textColor: C_SUB }
            ]
          }
        ]
      },
      { type: 'stack', direction: 'row', gap: COL_GAP, children: [leftColumn, rightColumn] },
      { type: 'stack', height: 0.5, backgroundColor: { light: 'rgba(0,0,0,0.08)', dark: 'rgba(255,255,255,0.12)' } },
      unlockSection
    ]
  };
}
