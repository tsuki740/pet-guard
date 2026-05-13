/**
 * Pet Guard：成分分析 + 自动评分（拍照模拟 OCR · 扫码模拟库）
 */

(function () {
  "use strict";

  var FLOAT_HISTORY_KEY = "pet_guard_scan_history_v1";

  /** 扫码查粮：模拟条码命中后的库内产品（配料摘要用于同一套评分） */
  var MOCK_PRODUCTS = [
    {
      id: "p1",
      name: "深海三文鱼成猫粮",
      brand: "海洋之星",
      ingredients_summary: "鲜三文鱼、鲜鸡肉、红薯、豌豆蛋白",
      meat_clarity: 88,
    },
    {
      id: "p2",
      name: "经典鸡肉犬粮",
      brand: "皇家",
      ingredients_summary: "鸡肉粉、小麦、玉米、动物脂肪、诱食剂",
      meat_clarity: 52,
    },
    {
      id: "p3",
      name: "冻干双拼全价猫粮",
      brand: "麦富迪",
      ingredients_summary: "鲜鸡肉、冻干鸡肉粒、甘薯、鱼油",
      meat_clarity: 76,
    },
    {
      id: "p4",
      name: "经济型全犬种粮",
      brand: "宝路",
      ingredients_summary: "肉类及其制品、谷物、豆粕、BHA（抗氧化剂）",
      meat_clarity: 35,
    },
    {
      id: "p5",
      name: "低敏鸭肉梨小型犬",
      brand: "爱肯拿",
      ingredients_summary: "新鲜鸭肉、新鲜梨、豌豆、扁豆",
      meat_clarity: 82,
    },
    {
      id: "p6",
      name: "室内成猫控制毛球",
      brand: "冠能",
      ingredients_summary: "鸡肉、玉米蛋白粉、鸡肝粉、纤维素",
      meat_clarity: 68,
    },
    {
      id: "p7",
      name: "全价幼猫粮",
      brand: "比瑞吉",
      ingredients_summary: "鸡肉粉、大米、鱼粉、植物油、口味增强剂",
      meat_clarity: 48,
    },
    {
      id: "p8",
      name: "六种鱼配方犬粮",
      brand: "渴望",
      ingredients_summary: "新鲜完整太平洋沙丁鱼、鲭鱼、鳕鱼、比目鱼",
      meat_clarity: 92,
    },
  ];

  var RED_RULES = [
    {
      id: "meat_meal",
      patterns: ["肉粉", "鸡肉粉", "鱼粉", "鸭肉粉"],
      label: "肉粉",
      reason: "肉粉为二次加工肉源，营养与透明度通常弱于鲜肉，长期主食建议优先鲜肉配方。",
    },
    {
      id: "bha_bht",
      patterns: ["BHA", "BHT", "丁基羟基茴香醚", "二丁基羟基甲苯"],
      label: "BHA / BHT",
      reason: "合成抗氧化剂，争议较大；部分养宠家庭会主动避开。",
    },
    {
      id: "palatant",
      patterns: ["诱食剂", "口味增强剂", "风味剂", "宠物饲料调味剂", "动物水解蛋白"],
      label: "诱食剂",
      reason: "可能掩盖劣质原料气味，不利于判断真实适口性与原料质量。",
    },
    {
      id: "grain",
      patterns: ["谷物", "小麦", "玉米", "大米", "糙米", "燕麦", "大麦"],
      label: "谷物",
      reason: "部分宠物对谷物敏感；若需低敏或无谷配方需注意。",
    },
    {
      id: "unclear_fat",
      patterns: ["动物脂肪", "不明油脂", "精炼动物油", "混合油", "禽类脂肪"],
      label: "不明油脂",
      reason: "未标明具体动物或来源的油脂，原料可追溯性较差。",
    },
    {
      id: "artificial_color",
      patterns: ["人工色素", "柠檬黄", "日落黄", "胭脂红", "诱惑红"],
      label: "人工色素",
      reason: "对宠物无营养意义，部分合成色素存在争议，可优先选择无色素配方。",
    },
  ];

  var GOOD_RULES = [
    {
      id: "fresh_chicken",
      patterns: ["鲜鸡肉", "新鲜鸡肉"],
      label: "鲜鸡肉",
      note: "鲜肉排位靠前通常更有利于蛋白质量与适口性（需结合完整配料解读）。",
    },
    {
      id: "salmon",
      patterns: ["三文鱼", "鲑鱼"],
      label: "三文鱼",
      note: "常见优质蛋白与脂肪酸来源之一。",
    },
    {
      id: "freeze_dried",
      patterns: ["冻干"],
      label: "冻干",
      note: "可提升适口性并保留部分营养，注意整体配方平衡。",
    },
    {
      id: "probiotic",
      patterns: ["益生菌", "枯草芽孢杆菌", "乳酸菌"],
      label: "益生菌",
      note: "有助于肠道菌群与消化，具体效果因菌株与剂量而异。",
    },
  ];

  var MOCK_SCANS = [
    {
      brand: "海洋之星",
      text:
        "品牌：海洋之星。原料组成：鲜鸡肉、三文鱼、冻干鸡肉粒、鱼油、益生菌（枯草芽孢杆菌）。肉类占比 62%。",
    },
    {
      brand: "示例粮 A",
      text:
        "配料表：鸡肉、鲜鸡肉、肉粉（≥12%）、豌豆、鸡油、口味增强剂、抗氧化剂（BHA、乙氧基喹啉）。本产品含谷物（小麦、玉米）。肉类占比 28%。日落黄。",
    },
    {
      brand: "示例粮 B",
      text:
        "原料组成：冻干鸡肉粒、肉粉、玉米、小麦、动物水解蛋白、食品用香料、BHT。肉类占比 35%。",
    },
    {
      brand: "示例粮 C",
      text:
        "添加剂：氯化胆碱、牛磺酸、抗氧化剂 BHA。肉类及其制品（鲜鸡肉、鱼粉）、诱食剂、动物脂肪。人工色素（柠檬黄）。肉类占比 45%。",
    },
  ];

  var state = {
    busy: false,
    analysisDebounce: null,
    skipNextRawInput: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function setHeroStatus(msg) {
    var el = $("heroActionStatus");
    if (el) el.textContent = msg || "";
  }

  /** @returns {number|null} */
  function parseMeatPercent(text) {
    if (!text || typeof text !== "string") return null;
    var t = text.replace(/\s/g, "");
    var patterns = [
      /肉类占比[：:]?(\d+(?:\.\d+)?)%/i,
      /含肉量[：:]?(\d+(?:\.\d+)?)%/i,
      /动物蛋白[：:]?(\d+(?:\.\d+)?)%/i,
      /鲜肉占比[：:]?(\d+(?:\.\d+)?)%/i,
      /肉类[（(][^）)]*[）)][：:]?(\d+(?:\.\d+)?)%/,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = t.match(patterns[i]);
      if (m && m[1]) {
        var v = parseFloat(m[1]);
        if (!isNaN(v)) return v;
      }
    }
    return null;
  }

  function isNegatedBefore(text, matchIndex) {
    var w = text.slice(Math.max(0, matchIndex - 22), matchIndex);
    return /(?:不含|未添加|无添加|未使用|零添加)[\s\S]{0,16}$/m.test(w);
  }

  function textHasPattern(text, kw) {
    var from = 0;
    while (true) {
      var i = text.indexOf(kw, from);
      if (i === -1) return false;
      if (!isNegatedBefore(text, i)) return true;
      from = i + kw.length;
    }
  }

  function textContainsAny(text, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      if (textHasPattern(text, patterns[i])) return true;
    }
    return false;
  }

  function collectRuleHits(text, rules) {
    var hits = [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (textContainsAny(text, r.patterns)) hits.push(r);
    }
    return hits;
  }

  function scoreAndAnalyze(text) {
    var meatPct = parseMeatPercent(text);
    var redHits = collectRuleHits(text, RED_RULES);
    var goodHits = collectRuleHits(text, GOOD_RULES);

    var score = 100;
    score -= redHits.length * 20;
    score += goodHits.length * 5;
    if (meatPct !== null && meatPct < 40) score -= 10;
    score = Math.round(clamp(score, 0, 100));

    var grade;
    if (score >= 90) grade = "S";
    else if (score >= 75) grade = "A";
    else if (score >= 60) grade = "B";
    else if (score >= 50) grade = "C";
    else grade = "F";

    var summary = buildSummary(grade, score, redHits, meatPct);
    return {
      score: score,
      grade: grade,
      summary: summary,
      redHits: redHits,
      goodHits: goodHits,
      meatPct: meatPct,
      meatPenalty: meatPct !== null && meatPct < 40,
    };
  }

  function buildSummary(grade, score, redHits, meatPct) {
    if (grade === "F" || score < 50) {
      return "多项红线成分叠加，综合风险偏高，不建议作为长期主食。";
    }
    if (redHits.length === 0 && (!meatPct || meatPct >= 40)) {
      if (grade === "S") return "未命中常见红线项，且得分优秀，配方相对友好（仍请对照完整包装与个体耐受）。";
      return "未命中常见红线项，整体相对可控，建议结合个体情况选择。";
    }
    var top = redHits[0];
    if (top.id === "bha_bht" || top.id === "palatant") {
      return "含有高风险防腐剂或强诱食相关成分，不建议购买。";
    }
    if (top.id === "meat_meal" && redHits.length >= 2) {
      return "肉粉与多项辅料叠加，原料透明度一般，谨慎选择。";
    }
    if (meatPct !== null && meatPct < 40) {
      return "标注肉类占比较低，蛋白结构可能偏植物或副产品，建议谨慎。";
    }
    return "命中部分风险关键词，请重点核对红色列表中的避雷理由。";
  }

  function inferBrand(text) {
    if (!text) return "未识别品牌";
    var m = text.match(/品牌[：:]\s*([^\n。；;]+)/);
    if (m && m[1]) return m[1].trim().slice(0, 24) || "未识别品牌";
    return "未识别品牌";
  }

  function buildTextFromProduct(p) {
    var code = "690" + String(Math.floor(100000000 + Math.random() * 899999999));
    return (
      "品牌：" +
      p.brand +
      "。产品：" +
      p.name +
      "（条形码匹配·库内模拟）。条码：" +
      code +
      "。配料摘要：" +
      p.ingredients_summary +
      "。肉类占比 " +
      p.meat_clarity +
      "%。"
    );
  }

  function readFloatHistory() {
    try {
      var raw = localStorage.getItem(FLOAT_HISTORY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeFloatHistory(arr) {
    localStorage.setItem(FLOAT_HISTORY_KEY, JSON.stringify(arr.slice(0, 5)));
  }

  function pushFloatHistory(brand, grade) {
    var list = readFloatHistory();
    list.unshift({ brand: brand || "未识别品牌", grade: grade, ts: Date.now() });
    writeFloatHistory(list);
    renderFloatHistory();
  }

  function renderFloatHistory() {
    var ul = $("scanHistoryFloatList");
    var box = $("scanHistoryFloat");
    if (!ul || !box) return;
    var list = readFloatHistory();
    if (!list.length) {
      ul.innerHTML = '<li class="scan-history-float__empty">暂无记录</li>';
      return;
    }
    ul.innerHTML = list
      .map(function (r) {
        return (
          '<li class="scan-history-float__item"><span class="scan-history-float__brand">' +
          escapeHtml(r.brand) +
          '</span><span class="scan-history-float__grade scan-history-float__grade--' +
          escapeHtml(String(r.grade).toLowerCase()) +
          '">' +
          escapeHtml(r.grade) +
          "</span></li>"
        );
      })
      .join("");
  }

  function renderAnalysis(result) {
    var sec = $("analysisSection");
    var gradeEl = $("analysisGrade");
    var scoreEl = $("analysisScore");
    var sumEl = $("analysisSummary");
    var goodUl = $("analysisGoodList");
    var riskUl = $("analysisRiskList");
    if (!sec || !gradeEl || !scoreEl || !sumEl || !goodUl || !riskUl) return;

    sec.hidden = false;
    gradeEl.textContent = result.grade;
    gradeEl.className = "analysis-grade analysis-grade--" + String(result.grade).toLowerCase();
    scoreEl.textContent = String(result.score);
    sumEl.textContent = result.summary;

    if (!result.goodHits.length) {
      goodUl.innerHTML = '<li class="analysis-list__empty">未命中加分项关键词</li>';
    } else {
      goodUl.innerHTML = result.goodHits
        .map(function (g) {
          return (
            "<li><strong>" +
            escapeHtml(g.label) +
            "</strong> — " +
            escapeHtml(g.note) +
            "</li>"
          );
        })
        .join("");
    }

    if (!result.redHits.length) {
      riskUl.innerHTML = '<li class="analysis-list__empty">未命中红线项关键词</li>';
    } else {
      riskUl.innerHTML = result.redHits
        .map(function (r) {
          return (
            "<li><strong>" +
            escapeHtml(r.label) +
            "</strong><span class=\"analysis-risk-reason\"> — " +
            escapeHtml(r.reason) +
            "</span></li>"
          );
        })
        .join("");
    }
  }

  function runAnalysisFromUI() {
    var ta = $("analysisRawText");
    if (!ta) return;
    var text = ta.value || "";
    if (!text.trim()) {
      var sec = $("analysisSection");
      if (sec) sec.hidden = true;
      return;
    }
    var result = scoreAndAnalyze(text);
    renderAnalysis(result);
  }

  function finishScan(text, historyBrand, doneMsg) {
    var ta = $("analysisRawText");
    if (ta) {
      state.skipNextRawInput = true;
      ta.value = text;
    }
    var result = scoreAndAnalyze(text);
    renderAnalysis(result);
    pushFloatHistory(historyBrand, result.grade);
    setHeroStatus(doneMsg);
    state.busy = false;
    var sec = $("analysisSection");
    if (sec) {
      try {
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        sec.scrollIntoView();
      }
    }
  }

  var SPLASH_SESSION_KEY = "pet_guard_session_splash_seen";

  function initSplash() {
    var splash = document.getElementById("splashScreen");
    var mainApp = document.getElementById("mainApp");
    if (!splash || !mainApp) return;

    function revealApp() {
      mainApp.classList.add("main-app--visible");
      document.body.style.overflow = "";
    }

    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      splash.hidden = true;
      splash.setAttribute("aria-hidden", "true");
      splash.classList.add("splash--hidden");
      revealApp();
      return;
    }

    document.body.style.overflow = "hidden";
    splash.hidden = false;
    splash.classList.remove("splash--hidden");
    splash.setAttribute("aria-hidden", "false");
    requestAnimationFrame(function () {
      splash.classList.add("splash--run");
    });

    window.setTimeout(function () {
      splash.classList.add("splash--hidden");
      revealApp();
      sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
      window.setTimeout(function () {
        splash.hidden = true;
        splash.setAttribute("aria-hidden", "true");
        splash.classList.remove("splash--run");
      }, 520);
    }, 2000);
  }

  function simulateOcrFromFile() {
    if (state.busy) return;
    state.busy = true;
    setHeroStatus("正在模拟识别配料表（约 2 秒）…");

    window.setTimeout(function () {
      var sample = MOCK_SCANS[Math.floor(Math.random() * MOCK_SCANS.length)];
      var text = sample.text;
      var brand = sample.brand || inferBrand(text);
      finishScan(
        text,
        brand,
        "拍照识别完成（模拟）。请查看下方成分分析与安全等级。"
      );
    }, 2000);
  }

  function simulateBarcodeFromFile() {
    if (state.busy) return;
    state.busy = true;
    setHeroStatus("正在模拟扫码匹配库内产品（约 2 秒）…");

    window.setTimeout(function () {
      var p = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
      var text = buildTextFromProduct(p);
      finishScan(text, p.brand, "扫码查粮完成（模拟库）。请查看下方成分分析与安全等级。");
    }, 2000);
  }

  function bind() {
    var btnPhoto = $("btnPhotoIngredient");
    var ocrIn = $("ocrFileInput");
    if (btnPhoto && ocrIn) {
      btnPhoto.addEventListener("click", function () {
        ocrIn.click();
      });
    }

    var btnBc = $("btnBarcodeScan");
    var bcIn = $("barcodeFileInput");
    if (btnBc && bcIn) {
      btnBc.addEventListener("click", function () {
        bcIn.click();
      });
    }

    if (ocrIn) {
      ocrIn.addEventListener("change", function () {
        if (ocrIn.files && ocrIn.files.length) {
          simulateOcrFromFile();
          ocrIn.value = "";
        }
      });
    }

    if (bcIn) {
      bcIn.addEventListener("change", function () {
        if (bcIn.files && bcIn.files.length) {
          simulateBarcodeFromFile();
          bcIn.value = "";
        }
      });
    }

    var ta = $("analysisRawText");
    if (ta) {
      ta.addEventListener("input", function () {
        if (state.skipNextRawInput) {
          state.skipNextRawInput = false;
          runAnalysisFromUI();
          return;
        }
        if (state.analysisDebounce) window.clearTimeout(state.analysisDebounce);
        state.analysisDebounce = window.setTimeout(function () {
          state.analysisDebounce = null;
          runAnalysisFromUI();
        }, 350);
      });
    }
  }

  initSplash();
  bind();
  renderFloatHistory();
})();
