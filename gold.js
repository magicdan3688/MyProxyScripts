// 现货黄金（黄金/美元）K线（东财 push2his）+ Canvas
// 修复版：解决 400 报错及 blobToDataURI 连环崩溃问题

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const SECID = '122.XAU';
const LIMIT = 37;

function parseKltFromEnv(ctx) {
  const raw = ctx?.env?.KLT;
  const kltNum = Number(raw);
  const allowed = [15, 30, 60, 101, 102, 103];
  if (allowed.includes(kltNum)) return kltNum;
  return 15;
}

function kltLabel(klt) {
  if (klt === 101) return '日K';
  if (klt === 102) return '周K';
  if (klt === 103) return '月K';
  return `${klt}分K`;
}

// 核心修复1：补充缺失的图片转换函数，防止崩溃
function blobToDataURI(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('FileReader error'));
    r.readAsDataURL(blob);
  });
}

async function canvasToDataURI(canvas) {
  if (canvas && typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return await blobToDataURI(blob);
  }
  if (canvas && typeof canvas.toDataURL === 'function') {
    return canvas.toDataURL('image/png');
  }
  throw new Error('No supported canvas export method');
}

function drawCandles(ctx2d, ohlc, w, h) {
  const padX = 2;
  const padY = 6;
  const px = (v) => Math.round(v) + 0.5;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const minBodyH = 2;

  if (!ohlc || ohlc.length < 2) {
    ctx2d.clearRect(0, 0, w, h);
    return;
  }

  let minP = Infinity;
  let maxP = -Infinity;
  for (const b of ohlc) {
    if (b.low < minP) minP = b.low;
    if (b.high > maxP) maxP = b.high;
  }
  if (!isFinite(minP) || !isFinite(maxP) || maxP <= minP) {
    minP = 0; maxP = 1;
  }

  const span = maxP - minP;
  const padSpan = span * 0.03;
  minP -= padSpan;
  maxP += padSpan;

  const n = ohlc.length;
  const candleW = Math.max(2, Math.floor((innerW / Math.max(n, 1)) * 0.7));
  const usableW = Math.max(0, innerW - candleW);
  const xStep = n > 1 ? usableW / (n - 1) : 0;
  const yClamp = (y) => Math.max(padY, Math.min(padY + innerH, y));
  const yOf = (p) => {
    const t = (p - minP) / (maxP - minP);
    return yClamp(px(padY + (1 - t) * innerH));
  };

  ctx2d.clearRect(0, 0, w, h);

  ctx2d.globalAlpha = 0.18;
  ctx2d.strokeStyle = '#FFFFFF';
  ctx2d.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const y = padY + (innerH * i) / 6;
    ctx2d.beginPath();
    ctx2d.moveTo(padX, y);
    ctx2d.lineTo(padX + innerW, y);
    ctx2d.stroke();
  }
  ctx2d.globalAlpha = 1;

  let maxHigh = -Infinity; let iHigh = -1;
  let minLow = Infinity; let iLow = -1;
  for (let i = 0; i < ohlc.length; i++) {
    const b = ohlc[i];
    if (b.high > maxHigh) { maxHigh = b.high; iHigh = i; }
    if (b.low < minLow) { minLow = b.low; iLow = i; }
  }

  for (let i = 0; i < ohlc.length; i++) {
    const b = ohlc[i];
    const xCenter = px(padX + (candleW / 2) + xStep * i);
    const xLeft = Math.round(xCenter - candleW / 2);

    const yOpen = yOf(b.open);
    const yClose = yOf(b.close);
    const yHigh = yOf(b.high);
    const yLow = yOf(b.low);

    const up = b.close >= b.open;
    const color = up ? '#FF3B30' : '#34C759';

    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 1.3;
    ctx2d.beginPath();
    ctx2d.moveTo(xCenter, yHigh);
    ctx2d.lineTo(xCenter, yLow);
    ctx2d.stroke();

    const top = Math.min(yOpen, yClose);
    const bottom = Math.max(yOpen, yClose);
    const bodyH = Math.max(minBodyH, bottom - top);
    let bodyTop = top;
    if (bodyTop + bodyH > padY + innerH) bodyTop = padY + innerH - bodyH;
    if (bodyTop < padY) bodyTop = padY;
    
    ctx2d.fillStyle = color;
    ctx2d.fillRect(xLeft, bodyTop, candleW, bodyH);
  }

  const fmt = (v) => (isFinite(v) ? v.toFixed(2) : '--');
  const labelStyle = { font: '11px system-ui' };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function drawLabelAt(i, yRaw, text, above) {
    if (i < 0) return;
    const x = px(padX + xStep * i);
    const goLeft = i > (ohlc.length - 1) * 0.65;
    const dir = goLeft ? -1 : 1;
    const lineLen = 12;
    const gap = 3;

    const insetY = 10;
    const yShifted = above ? (yRaw + insetY) : (yRaw - insetY);
    const y = clamp(yShifted, padY + 12, h - padY - 12);

    ctx2d.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx2d.lineWidth = 1.2;
    ctx2d.beginPath();
    ctx2d.moveTo(x, y);
    ctx2d.lineTo(x + dir * lineLen, y);
    ctx2d.stroke();

    ctx2d.fillStyle = 'rgba(255,255,255,0.95)';
    ctx2d.font = labelStyle.font;
    ctx2d.textBaseline = above ? 'bottom' : 'top';
    ctx2d.textAlign = goLeft ? 'right' : 'left';
    const tx = x + dir * (lineLen + gap);
    const ty = above ? y - 1 : y + 1;
    ctx2d.fillText(text, tx, ty);
  }

  drawLabelAt(iHigh, yOf(maxHigh), fmt(maxHigh), true);
  drawLabelAt(iLow, yOf(minLow), fmt(minLow), false);
}

function fmtPrice(x, dec) {
  if (!isFinite(x)) return '--';
  return x.toFixed(typeof dec === 'number' ? dec : 2);
}

function placeholderChartDataURI(w, h) {
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(w, h);
  } else if (typeof document !== 'undefined' && document.createElement) {
    canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
  } else {
    throw new Error('No OffscreenCanvas or document canvas available');
  }
  const g = canvas.getContext('2d');

  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.font = '12px system-ui';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('暂无数据 / 网络异常', w / 2, h / 2);

  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/png' }).then(blobToDataURI);
  }
  if (typeof canvas.toDataURL === 'function') {
    return Promise.resolve(canvas.toDataURL('image/png'));
  }
  throw new Error('Canvas export not supported');
}

export default async function (ctx) {
  const KLT = parseKltFromEnv(ctx);
  const end = '20991231'; 

  // 核心修复2：fqt=0 (改为不复权，因为现货黄金请求复权会立刻报 400 错误)
  const url =
    'https://push2his.eastmoney.com/api/qt/stock/kline/get'
    + `?secid=${encodeURIComponent(SECID)}`
    + `&klt=${KLT}`
    + '&fqt=0' 
    + `&lmt=${LIMIT}`
    + `&end=${end}`
    + '&iscca=1'
    + '&fields1=f1,f2,f3,f4,f5,f6'
    + '&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61';

  let data = null;
  try {
    const resp = await ctx.http.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (resp.status !== 200) {
      console.log(`K线 HTTP 报错: ${resp.status}`);
    } else {
      const j = await resp.json();
      data = j?.data ?? null;
    }
  } catch (err) {
    console.log("K线数据拉取异常: " + err);
  }

  const hasKlines = !!(data && Array.isArray(data.klines) && data.klines.length >= 2);
  const kl = [];
  if (hasKlines) {
    for (const s of data.klines) {
      const arr = String(s).split(',');
      if (arr.length < 5) continue;
      const ts = arr[0], open = Number(arr[1]), close = Number(arr[2]);
      const high = Number(arr[3]), low = Number(arr[4]);
      if ([open, close, high, low].some(x => !isFinite(x))) continue;
      kl.push({ ts, open, close, high, low });
    }
  }

  const dec = typeof data?.decimal === 'number' ? data.decimal : 2;
  
  const snapUrl =
    'https://push2.eastmoney.com/api/qt/stock/get'
    + `?secid=${encodeURIComponent(SECID)}`
    + '&fields=f43,f59,f60,f169,f170,f58,f57';

  let snap = {};
  try {
    const snapResp = await ctx.http.get(snapUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Referer': 'https://quote.eastmoney.com/',
      },
    });
    if (snapResp.status === 200) {
       const snapJson = await snapResp.json();
       snap = snapJson?.data ?? {};
    }
  } catch (err) {
    console.log("快照数据拉取异常: " + err);
  }

  const snapPct = typeof snap.f170 === 'number' ? snap.f170 / 100 : NaN; 
  const snapDec = typeof snap.f59 === 'number' ? snap.f59 : dec;
  const snapScale = Math.pow(10, snapDec);
  const snapLast = typeof snap.f43 === 'number' ? snap.f43 / snapScale : NaN;

  let trendText = '-';
  let trendColor = '#999999';
  if (isFinite(snapPct)) {
    if (snapPct > 0) {
      trendText = `↑ +${snapPct.toFixed(2)}%`;
      trendColor = '#FF3B30';
    } else if (snapPct < 0) {
      trendText = `↓ ${snapPct.toFixed(2)}%`;
      trendColor = '#34C759';
    } else {
      trendText = '→ 0.00%';
      trendColor = '#FF9F0A';
    }
  }

  const W = 380;
  const H = 126;
  const SCALE = 2;

  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(W * SCALE, H * SCALE);
  } else if (typeof document !== 'undefined' && document.createElement) {
    canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
  } else {
    throw new Error('No OffscreenCanvas or document canvas available');
  }

  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas.getContext(2d) returned null');
  g.scale(SCALE, SCALE);

  const dataURI = hasKlines && kl.length >= 2
    ? (drawCandles(g, kl, W, H), await canvasToDataURI(canvas))
    : await placeholderChartDataURI(W, H);

  const nowISO = new Date().toISOString();
  const mainColor = trendColor === '#999999' ? '#FFFFFF' : trendColor;

  return {
    type: 'widget',
    padding: 6,
    gap: 0,
    refreshAfter: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    backgroundGradient: {
      type: 'linear',
      colors: ['#191a19', '#0d0d0d'],
      stops: [0.1, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    children: [
      {
        type: 'stack',
        direction: 'row',
        height: 34,
        alignItems: 'center',
        children: [
          { type: 'image', src: 'sf-symbol:diamond.circle.fill', width: 15, height: 15, color: '#FFD166' },
          { type: 'spacer', length: 6 },
          { type: 'text', text: '现货黄金', font: { size: 15, weight: 'black'}, textColor: '#FFFFFF', maxLines: 1, minScale: 0.6 },
          { type: 'spacer', length: 25 },
          { type: 'text', text: kltLabel(KLT), font: { size: 'caption2', weight: 'medium' }, textColor: '#B8B8B8', maxLines: 1, minScale: 0.6 },
          { type: 'spacer' },
          { type: 'text', text: fmtPrice(snapLast, snapDec), font: { size: 'headline', weight: 'semibold', design: 'rounded' }, textColor: mainColor, textAlign: 'right', maxLines: 1, minScale: 0.6 },
          { type: 'spacer', length: 8 },
          {
            type: 'stack',
            padding: [2, 6, 2, 6],
            backgroundColor: trendColor,
            borderRadius: 8,
            children: [
              { type: 'text', text: trendText, font: { size: 'caption1', weight: 'bold' }, textColor: '#FFFFFF', textAlign: 'right', maxLines: 1, minScale: 0.6 },
            ],
          },
        ],
      },
      {
        type: 'stack',
        direction: 'column',
        height: 120,
        children: [
          { type: 'image', src: dataURI, height: 120, resizeMode: 'contain', borderRadius: 12 },
        ],
      },
      {
        type: 'stack',
        direction: 'row',
        height: 20,
        alignItems: 'center',
        children: [
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            children: [
              { type: 'image', src: 'sf-symbol:clock.arrow.circlepath', width: 9, height: 9, color: '#999999' },
              { type: 'spacer', length: 4 },
              { type: 'date', date: nowISO, format: 'relative', font: { size: 'caption2', weight: 'medium' }, textColor: '#999999', maxLines: 1, minScale: 0.6 },
            ],
          },
          { type: 'spacer' },
          {
            type: 'stack',
            direction: 'row',
            alignItems: 'center',
            children: [
              { type: 'date', date: nowISO, format: 'date', font: { size: 'caption2', weight: 'medium' }, textColor: '#999999', maxLines: 1, minScale: 0.6 },
              { type: 'spacer', length: 6 },
              { type: 'date', date: nowISO, format: 'time', font: { size: 'caption2', weight: 'medium' }, textColor: '#999999', maxLines: 1, minScale: 0.6 },
            ],
          },
        ],
      },
    ],
  };
}
