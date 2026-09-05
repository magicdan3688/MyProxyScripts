export default async function(ctx) {
  // =========================
  // 环境变量策略组
  // 名称：POLICY
  // 值：你的策略组名字，例如：国际流量
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

  if ([
    'systemSmall',
    'accessoryCircular',
    'accessoryInline',
    'accessoryRectangular'
  ].includes(widgetFamily)) {
    return {
      type: 'widget',
      padding: 16,
      backgroundColor: BG_COLOR,
      children: [{
        type: 'text',
        text: '请使用中号或大号组件',
        font: { size: 'callout' },
        textColor: C_MAIN,
        textAlign: 'center'
      }]
    };
  }

  const BASE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
    'Version/17.4 Mobile/15E148 Safari/604.1';

  // =========================
  // 核心路由逻辑
  // =========================
  //
  // 1. 本地出口检测永远 DIRECT
  //
  // 2. DIRECT 模式：
  //    落地出口 = 本地 DIRECT 出口
  //
  // 3. 非 DIRECT 模式：
  //    落地出口严格按照 POLICY
  //
  // 4. 不复用/修改传入 opts 对象
  //
  // 5. 接口失败不能伪装成“低危”
  //

  function withPolicy(opts = {}) {
    const out = { ...opts };

    if (!isDirectPolicy) {
      out.policy = policy;
    }

    return out;
  }

  async function getRaw(
    url,
    headers,
    extraOpts,
    forceDirect = false
  ) {
    const opts = forceDirect
      ? { timeout: 6000 }
      : withPolicy({ timeout: 6000 });

    if (headers) {
      opts.headers = headers;
    }

    if (extraOpts) {
      Object.assign(opts, extraOpts);
    }

    return await ctx.http.get(url, opts);
  }

  async function get(
    url,
    headers,
    forceDirect = false
  ) {
    const res = await getRaw(
      url,
      headers,
      null,
      forceDirect
    );

    return await res.text();
  }

  async function post(
    url,
    body,
    headers,
    forceDirect = false
  ) {
    const opts = forceDirect
      ? {
          timeout: 6000,
          body
        }
      : withPolicy({
          timeout: 6000,
          body
        });

    if (headers) {
      opts.headers = headers;
    }

    const res = await ctx.http.post(url, opts);

    return await res.text();
  }

  async function safe(fn) {
    try {
      return await fn();
    } catch (_) {
      return null;
    }
  }

  function jp(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }

  function ti(v) {
    const n = Number(v);

    return Number.isFinite(n)
      ? Math.round(n)
      : null;
  }

  function cleanISP(isp) {
    if (!isp) {
      return '未知运营商';
    }

    return String(isp)
      .replace(/^AS\d+\s*/i, '')
      .trim() || '未知运营商';
  }

  function countryName(c) {
    if (!c) {
      return '';
    }

    const s = String(c).toUpperCase();

    if (
      s.includes('JAPAN') ||
      s === 'JP'
    ) {
      return '日本';
    }

    if (
      s.includes('CHINA') ||
      s === 'CN'
    ) {
      return '中国';
    }

    if (
      s.includes('UNITED STATES') ||
      s === 'US'
    ) {
      return '美国';
    }

    if (
      s.includes('HONG KONG') ||
      s === 'HK'
    ) {
      return '香港';
    }

    if (
      s.includes('TAIWAN') ||
      s === 'TW'
    ) {
      return '台湾';
    }

    if (
      s.includes('SINGAPORE') ||
      s === 'SG'
    ) {
      return '新加坡';
    }

    if (
      s.includes('SOUTH KOREA') ||
      s === 'KR'
    ) {
      return '韩国';
    }

    if (
      s.includes('UNITED KINGDOM') ||
      s === 'GB'
    ) {
      return '英国';
    }

    if (
      s.includes('GERMANY') ||
      s === 'DE'
    ) {
      return '德国';
    }

    if (
      s.includes('FRANCE') ||
      s === 'FR'
    ) {
      return '法国';
    }

    return String(c);
  }

  function flagEmoji(country) {
    const c = String(country || '').toUpperCase();

    const map = {
      CN: '🇨🇳',
      JP: '🇯🇵',
      US: '🇺🇸',
      HK: '🇭🇰',
      TW: '🇹🇼',
      MO: '🇲🇴',
      SG: '🇸🇬',
      KR: '🇰🇷',
      GB: '🇬🇧',
      DE: '🇩🇪',
      FR: '🇫🇷'
    };

    if (map[c]) {
      return map[c];
    }

    const nameMap = {
      '中国': '🇨🇳',
      '日本': '🇯🇵',
      '美国': '🇺🇸',
      '香港': '🇭🇰',
      '台湾': '🇹🇼',
      '澳门': '🇲🇴',
      '新加坡': '🇸🇬',
      '韩国': '🇰🇷',
      '英国': '🇬🇧',
      '德国': '🇩🇪',
      '法国': '🇫🇷'
    };

    return nameMap[String(country)] || '🌐';
  }

  function makeLocation(country, city) {
    const c = countryName(country);

    return (
      `${flagEmoji(c)} ${c}${city ? ` ${city}` : ''}`
    ).trim() || '未知位置';
  }

  // =========================
  // 本地出口
  // 永远 DIRECT
  // =========================

  async function fetchLocalInfo() {
    const candidates = [
      {
        url: 'https://api.ip.sb/geoip',

        parse: d => d?.ip
          ? {
              ip: d.ip,

              loc: makeLocation(
                d.country || d.country_code,
                d.city
              ),

              isp: cleanISP(
                d.isp || d.organization
              )
            }
          : null
      },

      {
        url: 'https://ipinfo.io/json',

        parse: d => d?.ip
          ? {
              ip: d.ip,

              loc: makeLocation(
                d.country,
                d.city
              ),

              isp: cleanISP(
                d.org || d.organization
              )
            }
          : null
      }
    ];

    for (const item of candidates) {
      const result = await safe(async () => {
        const res = await ctx.http.get(
          item.url,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0'
            },

            timeout: 5000,

            // 这里必须明确 DIRECT
            policy: 'DIRECT'
          }
        );

        return item.parse(
          jp(await res.text())
        );
      });

      if (result?.ip) {
        return result;
      }
    }

    return {
      ip: '获取失败',
      loc: '未知位置',
      isp: '未知运营商'
    };
  }

  // =========================
  // 落地出口
  // 严格按照 POLICY
  // =========================

  async function fetchLandingInfo() {

    // ---------------------------------
    // DIRECT 模式
    //
    // DIRECT 的语义非常明确：
    //
    // 本地出口 = 落地出口
    //
    // 所以不再重复请求 IPPure。
    //
    // 这正是修复 Rakuten 移动网络问题的关键。
    // ---------------------------------

    if (
      isDirectPolicy &&
      localInfo.ip !== '获取失败'
    ) {
      return {
        ip: localInfo.ip,
        loc: localInfo.loc,
        native: '未知',
        source: 'DIRECT'
      };
    }

    // ---------------------------------
    // 第一优先：IPPure
    //
    // 非 DIRECT 时严格走 POLICY
    // ---------------------------------

    const ippure = await safe(async () => {
      const res = await ctx.http.get(
        'https://my.ippure.com/v1/info',
        withPolicy({
          timeout: 5000
        })
      );

      const d = jp(
        await res.text()
      );

      if (!d?.ip) {
        return null;
      }

      return {
        ip: d.ip,

        loc: makeLocation(
          d.countryCode || d.country,
          d.city
        ),

        native:
          d.isResidential === true
            ? '🏠 原生住宅'
            : d.isResidential === false
              ? '🏢 商业机房'
              : '未知',

        fraudScore: ti(
          d.fraudScore
        ),

        source: 'IPPure'
      };
    });

    if (ippure?.ip) {
      return ippure;
    }

    // ---------------------------------
    // 第二优先：IP.SB
    //
    // 仍然严格走 POLICY
    // ---------------------------------

    const ipSb = await safe(async () => {
      const res = await ctx.http.get(
        'https://api.ip.sb/geoip',
        withPolicy({
          timeout: 5000
        })
      );

      const d = jp(
        await res.text()
      );

      if (!d?.ip) {
        return null;
      }

      return {
        ip: d.ip,

        loc: makeLocation(
          d.country || d.country_code,
          d.city
        ),

        native: '未知',

        source: 'IP.SB'
      };
    });

    if (ipSb?.ip) {
      return ipSb;
    }

    // ---------------------------------
    // 第三优先：IPinfo
    //
    // 仍然严格走 POLICY
    // ---------------------------------

    const ipInfo = await safe(async () => {
      const res = await ctx.http.get(
        'https://ipinfo.io/json',
        withPolicy({
          timeout: 5000,

          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        })
      );

      const d = jp(
        await res.text()
      );

      if (!d?.ip) {
        return null;
      }

      return {
        ip: d.ip,

        loc: makeLocation(
          d.country,
          d.city
        ),

        native: '未知',

        source: 'IPinfo'
      };
    });

    if (ipInfo?.ip) {
      return ipInfo;
    }

    // ---------------------------------
    // 第四优先：ipapi.co
    //
    // 仍然严格走 POLICY
    // ---------------------------------

    const ipApi = await safe(async () => {
      const res = await ctx.http.get(
        'https://ipapi.co/json/',
        withPolicy({
          timeout: 5000
        })
      );

      const d = jp(
        await res.text()
      );

      if (!d?.ip) {
        return null;
      }

      return {
        ip: d.ip,

        loc: makeLocation(
          d.country_code || d.country_name,
          d.city
        ),

        native: '未知',

        source: 'ipapi.co'
      };
    });

    if (ipApi?.ip) {
      return ipApi;
    }

    return {
      ip: '获取失败',
      loc: '未知位置',
      native: '未知',
      source: '失败'
    };
  }

  // =========================
  // IPPure 风险评分
  // =========================

  function riskFromScore(score) {
    if (score === null) {
      return {
        text: '获取失败',
        col: C_RED,
        sev: 4
      };
    }

    if (score >= 80) {
      return {
        text: `极高 (${score})`,
        col: C_RED,
        sev: 4
      };
    }

    if (score >= 70) {
      return {
        text: `高危 (${score})`,
        col: C_ORANGE,
        sev: 3
      };
    }

    if (score >= 40) {
      return {
        text: `中等 (${score})`,
        col: C_YELLOW,
        sev: 1
      };
    }

    return {
      text: `低危 (${score})`,
      col: C_GREEN,
      sev: 0
    };
  }

  // =========================
  // ChatGPT
  // =========================

  async function checkChatGPT() {
    try {
      const headRes = await getRaw(
        'https://chatgpt.com',
        {
          'User-Agent': BASE_UA
        },
        {
          redirect: 'manual'
        }
      );

      const webAccessible = !!headRes;

      const iosRes = await getRaw(
        'https://ios.chat.openai.com',
        {
          'User-Agent': BASE_UA
        }
      );

      const iosBody = iosRes
        ? await iosRes.text()
        : '';

      const cfDetails =
        jp(iosBody)?.cf_details || '';

      const blocked =
        !iosBody ||
        iosBody.includes(
          'blocked_why_headline'
        ) ||
        iosBody.includes(
          'unsupported_country_region_territory'
        ) ||
        cfDetails.includes('(1)') ||
        cfDetails.includes('(2)');

      const appAccessible =
        !!iosBody &&
        !blocked;

      if (
        !webAccessible &&
        !appAccessible
      ) {
        return 'Cross';
      }

      if (
        appAccessible &&
        !webAccessible
      ) {
        return 'APP';
      }

      if (
        webAccessible &&
        appAccessible
      ) {
        const trace = await get(
          'https://chatgpt.com/cdn-cgi/trace'
        );

        const m =
          trace?.match(
            /loc=([A-Z]{2})/
          );

        return m?.[1] || 'OK';
      }

      return 'Cross';

    } catch (_) {
      return 'Cross';
    }
  }

  // =========================
  // Gemini
  // =========================

  async function checkGemini() {
    try {
      const bodyRaw =
        'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]';

      const txt = await post(
        'https://gemini.google.com/_/BardChatUi/data/batchexecute',

        bodyRaw,

        {
          'User-Agent': BASE_UA,
          'Accept-Language': 'en-US',
          'Content-Type':
            'application/x-www-form-urlencoded'
        }
      );

      if (!txt) {
        return 'Cross';
      }

      let m = txt.match(
        /"countryCode"\s*:\s*"([A-Z]{2})"/i
      );

      if (m) {
        return m[1].toUpperCase();
      }

      m = txt.match(
        /"requestCountry"\s*:\s*\{[^}]*"id"\s*:\s*"([A-Z]{2})"/i
      );

      if (m) {
        return m[1].toUpperCase();
      }

      m = txt.match(
        /\[\[\\?"([A-Z]{2})\\?",\\?"S/
      );

      return m
        ? m[1].toUpperCase()
        : 'OK';

    } catch (_) {
      return 'Cross';
    }
  }

  // =========================
  // YouTube
  // =========================

  async function checkYouTube() {
    try {
      const body = await get(
        'https://www.youtube.com/premium',
        {
          'User-Agent': BASE_UA,
          'Accept-Language': 'en'
        }
      );

      if (!body) {
        return 'Cross';
      }

      if (
        body.includes(
          'www.google.cn'
        )
      ) {
        return 'CN';
      }

      if (
        /Premium is not available in your country|YouTube Premium is not available/i.test(
          body
        )
      ) {
        return 'Cross';
      }

      const m = body.match(
        /"contentRegion"\s*:\s*"?([A-Z]{2})"?/
      );

      const region =
        m?.[1]?.toUpperCase();

      if (/ad-free/i.test(body)) {
        return region || 'OK';
      }

      return region || 'Cross';

    } catch (_) {
      return 'Cross';
    }
  }

  // =========================
  // Netflix
  // =========================

  async function checkNetflix() {
    try {
      const urls = [
        'https://www.netflix.com/title/81280792',
        'https://www.netflix.com/title/70143836'
      ];

      const bodies = await Promise.all(
        urls.map(
          u => safe(
            () => get(
              u,
              {
                'User-Agent': BASE_UA
              }
            )
          )
        )
      );

      if (
        !bodies[0] &&
        !bodies[1]
      ) {
        return 'Cross';
      }

      if (
        /oh no!/i.test(
          bodies[0] || ''
        ) &&
        /oh no!/i.test(
          bodies[1] || ''
        )
      ) {
        return 'Popcorn';
      }

      for (const b of bodies) {
        const m = b?.match(
          /"countryCode"\s*:\s*"?([A-Z]{2})"?/
        );

        if (m) {
          return m[1].toUpperCase();
        }
      }

      return 'OK';

    } catch (_) {
      return 'Cross';
    }
  }

  // =========================
  // TikTok
  // =========================

  async function checkTikTok() {
    try {
      let body = await get(
        'https://www.tiktok.com/',
        {
          'User-Agent': BASE_UA
        }
      );

      if (
        body?.includes(
          'Please wait...'
        )
      ) {
        body = await get(
          'https://www.tiktok.com/explore',
          {
            'User-Agent': BASE_UA
          }
        );
      }

      let m = body?.match(
        /"region"\s*:\s*"([A-Z]{2})"/
      );

      if (m) {
        return m[1];
      }

      body = await get(
        'https://www.tiktok.com/',
        {
          'User-Agent': BASE_UA,
          'Accept-Language': 'en'
        }
      );

      m = body?.match(
        /"region"\s*:\s*"([A-Z]{2})"/
      );

      if (m) {
        return m[1];
      }

      return body
        ? 'OK'
        : 'Cross';

    } catch (_) {
      return 'Cross';
    }
  }

  // =========================
  // IPAPI 风险
  // =========================

  async function fetchIPAPIRisk(ip) {
    if (
      !ip ||
      ip === '获取失败'
    ) {
      return {
        text: '获取失败',
        col: C_RED,
        sev: 4
      };
    }

    try {
      const res = await ctx.http.get(
        `https://api.ipapi.is/?q=${encodeURIComponent(ip)}`,
        withPolicy({
          timeout: 5000
        })
      );

      const j = jp(
        await res.text()
      );

      const raw =
        j?.company?.abuser_score;

      if (
        raw === undefined ||
        raw === null
      ) {
        return {
          text: '获取失败',
          col: C_RED,
          sev: 4
        };
      }

      const m = String(raw).match(
        /([0-9.]+)\s*\(([^)]+)\)/
      );

      if (!m) {
        return {
          text: '获取失败',
          col: C_RED,
          sev: 4
        };
      }

      const pct =
        Math.round(
          Number(m[1]) * 10000
        ) / 100;

      const lv = m[2].trim();

      const high =
        /High|Very High/i.test(lv);

      const elevated =
        /Elevated/i.test(lv);

      return {
        text:
          `${lv} (${pct}%) Abuser`,

        col:
          high
            ? C_ORANGE
            : elevated
              ? C_YELLOW
              : C_GREEN,

        sev:
          high
            ? 3
            : elevated
              ? 2
              : 0
      };

    } catch (_) {
      return {
        text: '获取失败',
        col: C_RED,
        sev: 4
      };
    }
  }

  // =========================
  // 获取本地和落地信息
  // =========================

  const localInfo =
    await fetchLocalInfo();

  const landingInfo =
    await fetchLandingInfo();

  // =========================
  // IPPure 风险
  // =========================

  let riskIPPure =
    landingInfo.fraudScore !== undefined
      ? riskFromScore(
          landingInfo.fraudScore
        )
      : null;

  if (!riskIPPure) {
    if (
      landingInfo.ip ===
      '获取失败'
    ) {
      riskIPPure = {
        text: '获取失败',
        col: C_RED,
        sev: 4
      };
    } else {
      riskIPPure = {
        text: '未检测',
        col: C_SUB,
        sev: 0
      };
    }
  }

  // =========================
  // IPAPI 风险
  //
  // 只有拿到真实落地 IP 后才查询。
  //
  // 查询失败：
  // 获取失败
  //
  // 不再伪装成：
  // 低危 0%
  // =========================

  const riskIpapi =
    landingInfo.ip === '获取失败'
      ? {
          text: '获取失败',
          col: C_RED,
          sev: 4
        }
      : await fetchIPAPIRisk(
          landingInfo.ip
        );

  // =========================
  // 服务解锁检测
  // =========================

  const [
    gptStatus,
    geminiStatus,
    youtubeStatus,
    netflixStatus,
    tiktokStatus
  ] = await Promise.all([
    checkChatGPT(),
    checkGemini(),
    checkYouTube(),
    checkNetflix(),
    checkTikTok()
  ]);

  const landingSuccess =
    landingInfo.ip !== '获取失败';

  const getUnlockColor =
    status =>
      (
        status === 'Cross' ||
        status === 'CN'
      )
        ? C_RED
        : C_GREEN;

  const getUnlockResult =
    status =>
      status === 'Cross'
        ? '不可用'
        : status === 'CN'
          ? 'CN'
          : status;

  // =========================
  // 风险等级
  // =========================

  const riskGrades =
    landingSuccess
      ? [
          {
            sev: riskIPPure.sev,
            t:
              `IPPure: ${riskIPPure.text}`
          },

          {
            sev: riskIpapi.sev,
            t:
              `ipapi: ${riskIpapi.text}`
          },

          {
            sev: 0,
            t:
              'IP2Location: 未检测'
          },

          {
            sev: 0,
            t:
              'DB-IP: 未检测'
          },

          {
            sev: 0,
            t:
              'ipregistry: 未检测'
          }
        ]
      : [
          {
            sev: 4,
            t:
              '落地IP：获取失败'
          }
        ];

  let maxSev = 0;

  riskGrades.forEach(
    g => {
      if (g.sev > maxSev) {
        maxSev = g.sev;
      }
    }
  );

  function sevIcon(sev) {
    if (sev >= 4) {
      return 'xmark.shield.fill';
    }

    if (sev >= 1) {
      return 'exclamationmark.shield.fill';
    }

    return 'checkmark.shield.fill';
  }

  function sevText(sev) {
    if (sev >= 4) {
      return '极高风险';
    }

    if (sev >= 3) {
      return '高风险';
    }

    if (sev >= 2) {
      return '中等风险';
    }

    if (sev >= 1) {
      return '中低风险';
    }

    return '纯净低危';
  }

  function sevColor(sev) {
    if (sev >= 4) {
      return C_RED;
    }

    if (sev >= 3) {
      return C_ORANGE;
    }

    if (sev >= 1) {
      return C_YELLOW;
    }

    return C_GREEN;
  }

  const summaryIcon =
    sevIcon(maxSev);

  const summaryTxt =
    sevText(maxSev);

  const summaryCol =
    sevColor(maxSev);

  // =========================
  // UI 参数
  // =========================

  const SMALL_FONT = 10;
  const SMALL_ICON = 12;

  function smallInfoRow(
    iconName,
    label,
    value,
    valueCol = C_MAIN
  ) {
    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 5,

      children: [
        {
          type: 'image',
          src:
            `sf-symbol:${iconName}`,
          color: C_ICON,
          width: SMALL_ICON,
          height: SMALL_ICON
        },

        {
          type: 'text',
          text: label,
          font: {
            size: SMALL_FONT
          },
          textColor: C_SUB
        },

        {
          type: 'spacer'
        },

        {
          type: 'text',
          text: value,
          font: {
            size: SMALL_FONT,
            weight: 'bold'
          },
          textColor: valueCol,
          maxLines: 1,
          lineBreakMode: 'tail'
        }
      ]
    };
  }

  function UnlockRow(
    name,
    status
  ) {
    const iconName =
      (
        status === 'Cross' ||
        status === 'CN'
      )
        ? 'xmark.circle.fill'
        : 'checkmark.circle.fill';

    const iconCol =
      getUnlockColor(status);

    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 4,

      children: [
        {
          type: 'image',
          src:
            `sf-symbol:${iconName}`,
          color: iconCol,
          width: SMALL_ICON,
          height: SMALL_ICON
        },

        {
          type: 'text',
          text: name,
          font: {
            size: SMALL_FONT,
            weight: 'medium'
          },
          textColor: C_MAIN
        },

        {
          type: 'spacer'
        },

        {
          type: 'text',
          text:
            getUnlockResult(status),
          font: {
            size: SMALL_FONT,
            weight: 'bold'
          },
          textColor: iconCol,
          maxLines: 1
        }
      ]
    };
  }

  function ScoreRow(grade) {
    const col =
      sevColor(grade.sev);

    const parts =
      grade.t.split(': ');

    return {
      type: 'stack',
      direction: 'row',
      alignItems: 'center',
      gap: 4,

      children: [
        {
          type: 'image',
          src:
            `sf-symbol:${sevIcon(grade.sev)}`,
          color: col,
          width: SMALL_ICON,
          height: SMALL_ICON
        },

        {
          type: 'text',
          text:
            parts[0] || grade.t,
          font: {
            size: SMALL_FONT
          },
          textColor: C_SUB
        },

        {
          type: 'spacer'
        },

        {
          type: 'text',
          text:
            parts[1] || '',
          font: {
            size: SMALL_FONT,
            weight: 'bold'
          },
          textColor: col,
          maxLines: 1,
          lineBreakMode: 'tail'
        }
      ]
    };
  }

  // =========================
  // 时间
  // =========================

  const now = new Date();

  const timeStr =
    `${String(now.getHours()).padStart(2, '0')}:` +
    `${String(now.getMinutes()).padStart(2, '0')}`;

  const isLarge =
    widgetFamily === 'systemLarge';

  const WIDGET_PADDING =
    isLarge
      ? [10, 12]
      : [8, 10];

  const HEADER_FONT = 13;
  const HEADER_ICON = 11;
  const HEADER_TIME_FONT = 10;
  const HEADER_GAP = 4;

  const TOP_GAP = 3;
  const INFO_GAP = 2.5;
  const BOTTOM_GAP_LEFT = 2;
  const BOTTOM_GAP_RIGHT = 2;
  const COL_GAP = 12;

  // =========================
  // 左侧：本地出口
  // =========================

  const leftColumn = {
    type: 'stack',
    direction: 'column',
    gap: INFO_GAP,
    flex: 1,

    children: [
      smallInfoRow(
        'house.fill',
        '本地IP：',
        localInfo.ip,
        C_GREEN
      ),

      smallInfoRow(
        'mappin.and.ellipse',
        '本地位置：',
        localInfo.loc
      ),

      smallInfoRow(
        'simcard.fill',
        '本地运营商：',
        localInfo.isp
      )
    ]
  };

  // =========================
  // 右侧：落地出口
  // =========================

  const rightColumn = {
    type: 'stack',
    direction: 'column',
    gap: INFO_GAP,
    flex: 1,

    children: [
      smallInfoRow(
        'network',
        '落地IP：',
        landingInfo.ip,
        landingSuccess
          ? C_GREEN
          : C_RED
      ),

      smallInfoRow(
        'map.fill',
        '落地位置：',
        landingInfo.loc,
        landingSuccess
          ? C_MAIN
          : C_RED
      ),

      smallInfoRow(
        'building.2.fill',
        '原生属性：',
        landingInfo.native || '未知',
        landingSuccess
          ? C_MAIN
          : C_RED
      )
    ]
  };

  // =========================
  // 左侧：解锁检测
  // =========================

  const unlockLeft = {
    type: 'stack',
    direction: 'column',
    gap: BOTTOM_GAP_LEFT,

    children: [
      UnlockRow(
        'GPT',
        gptStatus
      ),

      UnlockRow(
        'Gemini',
        geminiStatus
      ),

      UnlockRow(
        'YouTube',
        youtubeStatus
      ),

      UnlockRow(
        'Netflix',
        netflixStatus
      ),

      UnlockRow(
        'TikTok',
        tiktokStatus
      )
    ]
  };

  // =========================
  // 右侧：风险检测
  // =========================

  const unlockRight = {
    type: 'stack',
    direction: 'column',
    gap: BOTTOM_GAP_RIGHT,

    children:
      riskGrades.map(
        ScoreRow
      )
  };

  const unlockSection = {
    type: 'stack',
    direction: 'row',
    gap: COL_GAP,

    children: [
      unlockLeft,
      unlockRight
    ]
  };

  // =========================
  // 最终 Widget
  // =========================

  return {
    type: 'widget',

    padding: WIDGET_PADDING,

    gap: TOP_GAP,

    backgroundColor: BG_COLOR,

    children: [

      // -------------------------
      // Header
      // -------------------------

      {
        type: 'stack',
        direction: 'row',
        alignItems: 'center',
        gap: HEADER_GAP,

        children: [
          {
            type: 'text',

            text:
              `数据中心 (${isDirectPolicy ? 'DIRECT' : policy})`,

            font: {
              size: HEADER_FONT,
              weight: 'heavy'
            },

            textColor: C_TITLE,

            flex: 1
          },

          {
            type: 'image',

            src:
              `sf-symbol:${summaryIcon}`,

            color: summaryCol,

            width: 12,
            height: 12
          },

          {
            type: 'text',

            text: summaryTxt,

            font: {
              size: 10,
              weight: 'bold'
            },

            textColor: summaryCol
          },

          {
            type: 'spacer'
          },

          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            gap: 3,

            children: [
              {
                type: 'image',

                src:
                  'sf-symbol:arrow.clockwise',

                color: C_SUB,

                width: HEADER_ICON,
                height: HEADER_ICON
              },

              {
                type: 'text',

                text: timeStr,

                font: {
                  size: HEADER_TIME_FONT
                },

                textColor: C_SUB
              }
            ]
          }
        ]
      },

      // -------------------------
      // 本地 / 落地信息
      // -------------------------

      {
        type: 'stack',
        direction: 'row',
        gap: COL_GAP,

        children: [
          leftColumn,
          rightColumn
        ]
      },

      // -------------------------
      // 分隔线
      // -------------------------

      {
        type: 'stack',

        height: 0.5,

        backgroundColor: {
          light:
            'rgba(0,0,0,0.08)',

          dark:
            'rgba(255,255,255,0.12)'
        }
      },

      // -------------------------
      // 解锁 / 风险
      // -------------------------

      unlockSection
    ]
  };
}
