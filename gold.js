// 现货黄金 (XAU) Egern Widget 脚本
const url = "https://hq.sinajs.cn/list=hf_XAU";

$httpClient.get({
    url: url,
    headers: {
        // 关键所在：伪装来源，防止报 400 或 403 错误
        "Referer": "https://finance.sina.com.cn/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    }
}, function (error, response, data) {
    if (error) {
        console.log("请求失败: " + error);
        $done({ title: "现货黄金", content: "网络请求失败", icon: "xmark.circle" });
        return;
    }
    
    if (response.status === 200) {
        try {
            // 新浪返回的格式是字符串：var hq_str_hf_XAU="最新价,买价,卖价,最高价,最低价,昨收价,..."
            // 使用正则表达式提取双引号内的内容
            const match = data.match(/="(.*)"/);
            if (match && match[1]) {
                const arr = match[1].split(",");
                const currentPrice = parseFloat(arr[0]).toFixed(2); // 最新价
                const preClose = parseFloat(arr[5]); // 昨收价
                
                // 计算涨跌额和涨跌幅
                const change = (currentPrice - preClose).toFixed(2);
                const percent = ((change / preClose) * 100).toFixed(2);
                
                // 决定颜色和图标 (国内习惯红涨绿跌)
                const isUp = change >= 0;
                const color = isUp ? "#FF3B30" : "#34C759"; 
                const icon = isUp ? "arrow.up.right.circle.fill" : "arrow.down.right.circle.fill";
                const sign = isUp ? "+" : "";

                $done({
                    title: "现货黄金 (XAU/USD)",
                    content: `最新价: $${currentPrice}\n涨跌幅: ${sign}${change} (${sign}${percent}%)`,
                    icon: icon,
                    "icon-color": color
                });
            } else {
                 $done({ title: "现货黄金", content: "数据解析失败", icon: "exclamationmark.circle" });
            }
        } catch (e) {
            $done({ title: "现货黄金", content: "代码执行异常", icon: "exclamationmark.circle" });
        }
    } else {
        $done({ title: "现货黄金", content: `接口错误: HTTP ${response.status}`, icon: "exclamationmark.circle" });
    }
});
