/**
 * Pet Guard 2.0 — 纯前端科学工具箱（主界面）
 * 启动页逻辑保持不变；主界面：Tesseract 本地 OCR + 配料评分 + 营养计算
 */

(function () {
  "use strict";

  var NUTRITION_STATE_KEY = "pet_guard_last_nutrition_v1";
  var SPLASH_DURATION_MS = 2000;
  var SPLASH_FADE_MS = 520;
  var OCR_FAIL_MSG = "未识别到有效配料，请重新拍摄更清晰的照片";

  var ASH_ESTIMATE = 8;

  var RED_RULES = [
    {
      id: "meat_meal",
      patterns: ["肉粉", "鸡肉粉", "鱼粉", "鸭肉粉", "meat meal", "chicken meal", "fish meal"],
      label: "肉粉",
      reason: "肉粉为二次加工肉源，营养与透明度通常弱于鲜肉，长期主食建议优先鲜肉配方。",
    },
    {
      id: "bha_bht",
      patterns: ["BHA", "BHT", "丁基羟基茴香醚", "二丁基羟基甲苯", "butylated hydroxyanisole"],
      label: "BHA / BHT",
      reason: "合成抗氧化剂，争议较大；部分养宠家庭会主动避开。",
    },
    {
      id: "palatant",
      patterns: ["诱食剂", "口味增强剂", "风味剂", "宠物饲料调味剂", "动物水解蛋白", "flavor", "palatability"],
      label: "诱食剂",
      reason: "可能掩盖劣质原料气味，不利于判断真实适口性与原料质量。",
    },
    {
      id: "grain",
      patterns: ["谷物", "小麦", "玉米", "大米", "糙米", "燕麦", "大麦", "corn", "wheat", "rice", "grain"],
      label: "谷物",
      reason: "部分宠物对谷物敏感；若需低敏或无谷配方需注意。",
    },
    {
      id: "unclear_fat",
      patterns: ["动物脂肪", "不明油脂", "精炼动物油", "混合油", "禽类脂肪", "animal fat", "poultry fat"],
      label: "不明油脂",
      reason: "未标明具体动物或来源的油脂，原料可追溯性较差。",
    },
    {
      id: "artificial_color",
      patterns: ["人工色素", "柠檬黄", "日落黄", "胭脂红", "诱惑红", "colorant", "fd&c"],
      label: "人工色素",
      reason: "对宠物无营养意义，部分合成色素存在争议，可优先选择无色素配方。",
    },
  ];

  var GOOD_RULES = [
    {
      id: "fresh_chicken",
      patterns: ["鲜鸡肉", "新鲜鸡肉", "fresh chicken"],
      label: "鲜鸡肉",
      note: "鲜肉排位靠前通常更有利于蛋白质量与适口性（需结合完整配料解读）。",
    },
    {
      id: "salmon",
      patterns: ["三文鱼", "鲑鱼", "salmon"],
      label: "三文鱼",
      note: "常见优质蛋白与脂肪酸来源之一。",
    },
    {
      id: "freeze_dried",
      patterns: ["冻干", "freeze-dried", "freeze dried"],
      label: "冻干",
      note: "可提升适口性并保留部分营养，注意整体配方平衡。",
    },
    {
      id: "probiotic",
      patterns: ["益生菌", "枯草芽孢杆菌", "乳酸菌", "probiotic", "bacillus"],
      label: "益生菌",
      note: "有助于肠道菌群与消化，具体效果因菌株与剂量而异。",
    },
  ];

  var INGREDIENT_HINTS = [
    "鸡肉",
    "鸡肉",
    "鲜鸡",
    "鱼",
    "鸭",
    "牛",
    "羊",
    "玉米",
    "小麦",
    "米",
    "豆",
    "薯",
    "油",
    "肉",
    "粉",
    "chicken",
    "fish",
    "salmon",
    "corn",
    "wheat",
    "meal",
    "rice",
    "pea",
    "potato",
    "duck",
    "beef",
    "lamb",
    "turkey",
  ];

  var FATAL_SYMPTOMS = [
    { id: "urine_block_24h", label: "尿闭超过 24 小时", category: "urinary" },
    { id: "bloody_stool", label: "拉血便 / 黑便", category: "digestive" },
    { id: "collapse", label: "突然倒地 / 意识模糊", category: "mental" },
    { id: "breathing_distress", label: "张口呼吸 / 舌头发紫", category: "mental" },
  ];

  var SYMPTOM_GROUPS = [
    {
      id: "digestive",
      label: "消化",
      items: [
        { id: "vomit", label: "呕吐（未含血）" },
        { id: "diarrhea", label: "软便 / 腹泻" },
        { id: "bloody_stool", label: "拉血便 / 黑便", fatal: true },
        { id: "no_eat", label: "拒食超过 24h" },
      ],
    },
    {
      id: "urinary",
      label: "泌尿",
      items: [
        { id: "freq_urine", label: "频繁蹲厕但尿少" },
        { id: "urine_block_24h", label: "尿闭超过 24 小时", fatal: true },
        { id: "blood_urine", label: "血尿" },
      ],
    },
    {
      id: "mental",
      label: "精神",
      items: [
        { id: "lethargy", label: "精神萎靡" },
        { id: "collapse", label: "突然倒地 / 意识模糊", fatal: true },
        { id: "breathing_distress", label: "张口呼吸 / 舌头发紫", fatal: true },
      ],
    },
  ];

  var MOCK_HOSPITALS = [
    {
      name: "宠爱国际 24h 急诊中心",
      address: "朝阳区建国路 88 号",
      phone: "010-88886666",
      lat: 39.9087,
      lng: 116.4575,
      is_24h: true,
      business_hours: "24小时",
      tags: ["急诊", "24小时"],
    },
    {
      name: "萌宠动物医院（夜诊）",
      address: "海淀区中关村大街 12 号",
      phone: "010-66661234",
      lat: 39.983,
      lng: 116.315,
      is_24h: false,
      business_hours: "09:00-21:00; 急诊至次日02:00",
      night_emergency: true,
      tags: ["夜诊"],
    },
    {
      name: "阳光宠物诊所",
      address: "西城区西单北大街 5 号",
      phone: "010-55557890",
      lat: 39.913,
      lng: 116.374,
      is_24h: false,
      business_hours: "08:30-18:30",
      tags: [],
    },
    {
      name: "瑞鹏深夜急诊部",
      address: "丰台区南三环西路 66 号",
      phone: "010-77779999",
      lat: 39.858,
      lng: 116.286,
      is_24h: true,
      business_hours: "全天24小时急诊",
      tags: ["24小时", "急诊"],
    },
    {
      name: "社区宠物门诊",
      address: "东城区东直门内大街 3 号",
      phone: "010-44443333",
      lat: 39.942,
      lng: 116.417,
      is_24h: false,
      business_hours: "10:00-19:00",
      tags: [],
    },
  ];

  var DEWORM_PRODUCTS = [
    {
      id: "revolution_cat",
      name: "大宠爱（猫）",
      mgPerKg: 6,
      unitHint: "按体重选规格管，挤至对应刻度（模拟：≤4kg 用幼猫管第1格）",
    },
    {
      id: "revolution_dog",
      name: "大宠爱（犬）",
      mgPerKg: 6,
      unitHint: "按说明书体重区间选管号，滴至推荐刻度",
    },
    {
      id: "hailiao",
      name: "海乐妙（猫）",
      mgPerKg: 16,
      unitHint: "片剂：常见 2–8kg 半片～1片，请以包装体重表为准",
    },
    {
      id: "bayer_dog",
      name: "拜宠清（犬）",
      mgPerKg: 5,
      unitHint: "按体重分段给药，超重犬需组合片数",
    },
  ];

  var TOXINS = [
    {
      id: "chocolate",
      name: "巧克力（可可碱）",
      thresholdMgPerKg: 20,
      dangerMgPerKg: 40,
      calcMg: function (grams, cocoaPct) {
        var pct = cocoaPct || 50;
        return grams * (pct / 100) * 14;
      },
    },
    {
      id: "onion",
      name: "洋葱/大葱",
      thresholdGPerKg: 5,
      dangerGPerKg: 15,
      calcG: function (grams) {
        return grams;
      },
    },
    {
      id: "grape",
      name: "葡萄/葡萄干",
      thresholdGPerKg: 2.8,
      dangerGPerKg: 10,
      calcG: function (grams) {
        return grams;
      },
    },
  ];

  var state = {
    busy: false,
    nutrition: null,
    userLocation: null,
    healthStep: 0,
    healthData: { species: "cat", age: "", onset: "today", category: "", symptoms: [] },
    openPanel: null,
    analysisDebounce: null,
    skipNextRawInput: false,
    lastOcrRaw: "",
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

  function setOcrLoading(on) {
    var load = $("ocrLoading");
    var btn = $("btnPhotoIngredient");
    if (load) load.hidden = !on;
    if (btn) btn.disabled = !!on;
  }

  function isNegatedBefore(text, matchIndex) {
    var w = text.slice(Math.max(0, matchIndex - 22), matchIndex);
    return /(?:不含|未添加|无添加|未使用|零添加|no added|free from)[\s\S]{0,16}$/im.test(w);
  }

  function textHasPattern(text, kw) {
    var from = 0;
    var lower = text.toLowerCase();
    var k = kw.toLowerCase();
    while (true) {
      var i = lower.indexOf(k, from);
      if (i === -1) return false;
      if (!isNegatedBefore(text, i)) return true;
      from = i + k.length;
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
      if (textContainsAny(text, rules[i].patterns)) hits.push(rules[i]);
    }
    return hits;
  }

  function parseMeatPercent(text) {
    if (!text) return null;
    var t = text.replace(/\s/g, "");
    var patterns = [
      /肉类占比[：:]?(\d+(?:\.\d+)?)%/i,
      /含肉量[：:]?(\d+(?:\.\d+)?)%/i,
      /动物蛋白[：:]?(\d+(?:\.\d+)?)%/i,
      /鲜肉占比[：:]?(\d+(?:\.\d+)?)%/i,
      /meat\s*content[：:]?(\d+(?:\.\d+)?)\s*%/i,
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
    return {
      score: score,
      grade: grade,
      summary: buildSummary(grade, score, redHits, meatPct),
      redHits: redHits,
      goodHits: goodHits,
      meatPct: meatPct,
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
    return "命中部分风险关键词，请重点核对避雷列表中的理由。";
  }

  function cleanIngredientBlock(s) {
    return String(s)
      .replace(/\s+/g, " ")
      .replace(/[|｜]/g, " ")
      .trim()
      .slice(0, 2500);
  }

  function extractIngredientsText(raw) {
    if (!raw) return null;
    var text = String(raw).replace(/\r\n/g, "\n").trim();
    if (text.length < 4) return null;
    var markers = [
      /(?:配料表|原料组成|原料|食材|成份|成分表)[：:\s]*\n?([\s\S]{8,}?)(?=\n\s*(?:保证成分|营养成分|营养分析|添加剂|GUARANTEED|ANALYSIS|Nutrition)|$)/i,
      /(?:ingredients|composition)[：:\s]*\n?([\s\S]{8,}?)(?=\n\s*(?:guaranteed|nutritional|analysis)|$)/i,
    ];
    var i;
    for (i = 0; i < markers.length; i++) {
      var m = text.match(markers[i]);
      if (m && m[1] && m[1].trim().length >= 6) {
        return cleanIngredientBlock(m[1]);
      }
    }
    return cleanIngredientBlock(text);
  }

  function hasValidIngredients(text) {
    if (!text) return false;
    var compact = text.replace(/\s/g, "");
    if (compact.length < 6) return false;
    var lower = text.toLowerCase();
    var h;
    for (h = 0; h < INGREDIENT_HINTS.length; h++) {
      if (lower.indexOf(INGREDIENT_HINTS[h].toLowerCase()) >= 0) return true;
    }
    if (collectRuleHits(text, RED_RULES).length > 0) return true;
    if (collectRuleHits(text, GOOD_RULES).length > 0) return true;
    if (/[、，,;；\/]/.test(text) && compact.length >= 10) return true;
    return false;
  }

  function inferPetFromText(text) {
    if (!text) return "cat";
    if (/犬|狗|dog|puppy|canine/i.test(text)) return "dog";
    if (/猫|cat|kitten|feline/i.test(text)) return "cat";
    return "cat";
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

  function hideAnalysis() {
    var sec = $("analysisSection");
    if (sec) sec.hidden = true;
  }

  function runAnalysisFromUI() {
    var ta = $("analysisRawText");
    if (!ta) return;
    var text = ta.value || "";
    if (!text.trim() || !hasValidIngredients(text)) {
      hideAnalysis();
      return;
    }
    renderAnalysis(scoreAndAnalyze(text));
  }

  /* ——— 启动页（2 秒进度条 → 淡出；不改动 index.html 启动 DOM） ——— */

  function hideSplashAndShowMain(splash, mainApp) {
    if (!splash || !mainApp) return;
    splash.classList.add("splash--hidden");
    splash.setAttribute("aria-hidden", "true");
    mainApp.classList.add("main-app--visible");
    mainApp.style.opacity = "1";
    mainApp.style.pointerEvents = "auto";
    mainApp.style.visibility = "visible";
    document.body.style.overflow = "";
    window.setTimeout(function () {
      splash.hidden = true;
      splash.style.display = "none";
      splash.style.visibility = "hidden";
      splash.style.pointerEvents = "none";
      splash.classList.remove("splash--run");
    }, SPLASH_FADE_MS);
  }

  function initSplash() {
    var splash = document.getElementById("splashScreen");
    var mainApp = document.getElementById("mainApp");
    if (!splash || !mainApp) return;

    document.body.style.overflow = "hidden";
    splash.hidden = false;
    splash.style.display = "";
    splash.style.visibility = "visible";
    splash.classList.remove("splash--hidden");
    splash.setAttribute("aria-hidden", "false");
    requestAnimationFrame(function () {
      splash.classList.add("splash--run");
    });

    window.setTimeout(function () {
      hideSplashAndShowMain(splash, mainApp);
    }, SPLASH_DURATION_MS);
  }

  function forceShowMainIfSplashStuck() {
    var splash = document.getElementById("splashScreen");
    var mainApp = document.getElementById("mainApp");
    if (splash) {
      splash.hidden = true;
      splash.style.display = "none";
      splash.style.visibility = "hidden";
      splash.classList.add("splash--hidden");
    }
    if (mainApp) {
      mainApp.classList.add("main-app--visible");
      mainApp.style.opacity = "1";
      mainApp.style.pointerEvents = "auto";
      mainApp.style.visibility = "visible";
    }
    document.body.style.overflow = "";
  }

  /* ——— 营养解析与计算 ——— */

  function parseNutrient(text, keys) {
    if (!text) return null;
    var t = text.replace(/\s/g, "");
    for (var i = 0; i < keys.length; i++) {
      var re = new RegExp(keys[i] + "[^\\d]{0,12}(\\d+(?:\\.\\d+)?)\\s*%", "i");
      var m = t.match(re);
      if (m && m[1]) {
        var v = parseFloat(m[1]);
        if (!isNaN(v)) return v;
      }
    }
    return null;
  }

  function extractNutritionFromText(text) {
    var protein = parseNutrient(text, [
      "粗蛋白质",
      "粗蛋白",
      "蛋白质",
      "crudeprotein",
      "crude protein",
    ]);
    var fat = parseNutrient(text, ["粗脂肪", "脂肪", "crude fat", "fat"]);
    var fiber = parseNutrient(text, ["粗纤维", "纤维", "crude fiber", "fiber"]);
    var moisture = parseNutrient(text, ["水分", "含水量", "moisture"]);
    return {
      protein: protein,
      fat: fat,
      fiber: fiber,
      moisture: moisture,
      pet: inferPetFromText(text),
      text: text,
    };
  }

  function hasParsedNutrition(n) {
    return (
      n &&
      n.protein != null &&
      n.fat != null &&
      n.fiber != null &&
      n.moisture != null
    );
  }

  function calcCarbPercent(n) {
    var carb =
      100 - n.protein - n.fat - n.fiber - ASH_ESTIMATE - n.moisture;
    return Math.round(clamp(carb, 0, 100) * 10) / 10;
  }

  function estimateKcalPer100g(n) {
    return 3.5 * n.protein + 8.5 * n.fat + 3.5 * calcCarbPercent(n);
  }

  function calcRERkg(weightKg, species) {
    if (species === "cat") return 70 * Math.pow(weightKg, 0.75);
    return 70 * Math.pow(weightKg, 0.75);
  }

  function calcDailyFeedingGrams(weightKg, nutrition, species) {
    if (!weightKg || weightKg <= 0) return null;
    var rer = calcRERkg(weightKg, species);
    var factor = species === "cat" ? 1.2 : 1.4;
    var mer = rer * factor;
    var kcal100 = estimateKcalPer100g(nutrition);
    if (kcal100 <= 0) return null;
    return Math.round((mer / kcal100) * 100);
  }

  function saveNutrition(n) {
    state.nutrition = n;
    try {
      localStorage.setItem(NUTRITION_STATE_KEY, JSON.stringify(n));
    } catch (e) {
      /* ignore */
    }
  }

  function loadNutrition() {
    try {
      var raw = localStorage.getItem(NUTRITION_STATE_KEY);
      if (raw) state.nutrition = JSON.parse(raw);
    } catch (e) {
      state.nutrition = null;
    }
  }

  function showPhotoResultsContainer() {
    var box = $("photoResults");
    if (!box) return;
    box.hidden = false;
    box.classList.remove("hidden");
  }

  function renderPhotoResults() {
    var box = $("photoResults");
    var blocks = $("nutritionBlocks");
    if (!box || !state.nutrition || !hasParsedNutrition(state.nutrition)) {
      if (blocks) blocks.hidden = true;
      return;
    }
    showPhotoResultsContainer();
    if (blocks) blocks.hidden = false;
    var n = state.nutrition;
    var carb = calcCarbPercent(n);
    var carbEl = $("carbPercent");
    var barEl = $("carbProgressBar");
    var hintEl = $("carbFormulaHint");
    if (carbEl) carbEl.textContent = String(carb);
    if (barEl) barEl.style.width = carb + "%";
    if (hintEl) {
      hintEl.textContent =
        "100% − 粗蛋白 " +
        n.protein +
        "% − 粗脂肪 " +
        n.fat +
        "% − 粗纤维 " +
        n.fiber +
        "% − 粗灰分(估) " +
        ASH_ESTIMATE +
        "% − 水分 " +
        n.moisture +
        "%";
    }
    updateFeedingDisplay();
  }

  function updateFeedingDisplay() {
    var wEl = $("petWeightFeed");
    var out = $("feedingResult");
    if (!out || !state.nutrition) return;
    var w = wEl ? parseFloat(wEl.value) : NaN;
    if (!w || w <= 0) {
      out.textContent = "建议每日喂食 — 克";
      return;
    }
    var g = calcDailyFeedingGrams(w, state.nutrition, state.nutrition.pet);
    out.textContent = g ? "建议每日喂食 " + g + " 克" : "建议每日喂食 — 克";
  }

  function processOcrSuccess(rawText) {
    state.lastOcrRaw = rawText;
    var ingredients = extractIngredientsText(rawText);
    if (!ingredients || !hasValidIngredients(ingredients)) {
      hideAnalysis();
      var pr = $("photoResults");
      if (pr) pr.hidden = true;
      setHeroStatus(OCR_FAIL_MSG);
      return;
    }

    var ta = $("analysisRawText");
    if (ta) {
      state.skipNextRawInput = true;
      ta.value = ingredients;
    }

    var analysis = scoreAndAnalyze(ingredients);
    renderAnalysis(analysis);
    showPhotoResultsContainer();

    var nutrition = extractNutritionFromText(rawText);
    if (hasParsedNutrition(nutrition)) {
      nutrition.carb = calcCarbPercent(nutrition);
      nutrition.kcal100 = estimateKcalPer100g(nutrition);
      saveNutrition(nutrition);
      renderPhotoResults();
      setHeroStatus(
        "识别完成 · 等级 " +
          analysis.grade +
          " · " +
          analysis.score +
          " 分 · 已解析营养数据"
      );
    } else {
      var blocks = $("nutritionBlocks");
      if (blocks) blocks.hidden = true;
      state.nutrition = null;
      setHeroStatus(
        "识别完成 · 等级 " + analysis.grade + " · " + analysis.score + " 分 · 未解析到保证分析值"
      );
    }

    var card = $("heroPhotoCard");
    if (card) {
      try {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (e) {
        card.scrollIntoView();
      }
    }
  }

  function runOcrFromFile(file) {
    if (state.busy) return;
    if (!file || !file.type || file.type.indexOf("image") !== 0) {
      setHeroStatus(OCR_FAIL_MSG);
      return;
    }
    if (typeof Tesseract === "undefined") {
      setHeroStatus("OCR 引擎未加载，请检查网络后刷新页面。");
      return;
    }

    state.busy = true;
    setOcrLoading(true);
    setHeroStatus("正在识别中...");
    hideAnalysis();
    var pr = $("photoResults");
    if (pr) pr.hidden = true;

    Tesseract.recognize(file, "chi_sim+eng", {
      logger: function (m) {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          setHeroStatus("正在识别中... " + Math.round(m.progress * 100) + "%");
        } else if (m.status === "loading language traineddata") {
          setHeroStatus("正在加载识别语言包...");
        }
      },
    })
      .then(function (result) {
        var text = (result && result.data && result.data.text) || "";
        if (!text.replace(/\s/g, "").length) {
          setHeroStatus(OCR_FAIL_MSG);
          return;
        }
        processOcrSuccess(text);
      })
      .catch(function (err) {
        console.error("Tesseract OCR failed:", err);
        setHeroStatus(OCR_FAIL_MSG);
      })
      .finally(function () {
        setOcrLoading(false);
        state.busy = false;
      });
  }

  /* ——— 面板切换 ——— */

  var PANEL_IDS = {
    health: "panelHealth",
    emergency: "panelEmergency",
    water: "panelWater",
    toxic: "panelToxic",
  };

  function closeAllPanels() {
    Object.keys(PANEL_IDS).forEach(function (key) {
      var el = $(PANEL_IDS[key]);
      if (el) {
        el.hidden = true;
      }
    });
    document.querySelectorAll(".tool-card").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });
    state.openPanel = null;
  }

  function openPanel(name) {
    if (state.openPanel === name) {
      closeAllPanels();
      return;
    }
    closeAllPanels();
    state.openPanel = name;
    var el = $(PANEL_IDS[name]);
    if (!el) return;
    el.hidden = false;
    var btn = document.querySelector('.tool-card[data-panel="' + name + '"]');
    if (btn) btn.setAttribute("aria-expanded", "true");

    if (name === "health") renderHealthPanel();
    if (name === "emergency") startEmergencySearch();
    if (name === "water") renderWaterPanel();
    if (name === "toxic") renderToxicPanel();

    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ——— 健康自检 Stepper ——— */

  function hasFatalSymptom(ids) {
    for (var i = 0; i < ids.length; i++) {
      for (var j = 0; j < FATAL_SYMPTOMS.length; j++) {
        if (FATAL_SYMPTOMS[j].id === ids[i]) return true;
      }
    }
    return false;
  }

  function showEmergencyModal() {
    var m = $("modalEmergencyAlert");
    if (m) m.hidden = false;
  }

  function hideEmergencyModal() {
    var m = $("modalEmergencyAlert");
    if (m) m.hidden = true;
  }

  function renderHealthPanel() {
    var el = $("panelHealth");
    if (!el) return;
    var d = state.healthData;
    var step = state.healthStep;
    var html = "";

    if (step === 0) {
      html +=
        '<p class="text-sm font-extrabold text-coffee mb-3">第 1 步 · 基本信息</p>' +
        '<label class="block text-xs font-bold text-coffee/70 mb-1">物种</label>' +
        '<select id="healthSpecies" class="w-full rounded-xl bg-cream px-3 py-2 font-bold text-coffee mb-3">' +
        '<option value="cat"' +
        (d.species === "cat" ? " selected" : "") +
        ">猫</option>" +
        '<option value="dog"' +
        (d.species === "dog" ? " selected" : "") +
        ">犬</option></select>" +
        '<label class="block text-xs font-bold text-coffee/70 mb-1">年龄</label>' +
        '<input id="healthAge" type="text" class="w-full rounded-xl bg-cream px-3 py-2 font-bold text-coffee mb-3" placeholder="如 1岁" value="' +
        escapeHtml(d.age) +
        '">' +
        '<label class="block text-xs font-bold text-coffee/70 mb-1">发病时间</label>' +
        '<select id="healthOnset" class="w-full rounded-xl bg-cream px-3 py-2 font-bold text-coffee">' +
        '<option value="today"' +
        (d.onset === "today" ? " selected" : "") +
        ">今日</option>" +
        '<option value="1-3d"' +
        (d.onset === "1-3d" ? " selected" : "") +
        ">1–3 天</option>" +
        '<option value="week+"' +
        (d.onset === "week+" ? " selected" : "") +
        ">一周以上</option></select>";
    } else if (step === 1) {
      html += '<p class="text-sm font-extrabold text-coffee mb-3">第 2 步 · 症状大类</p><div class="flex flex-wrap gap-2">';
      SYMPTOM_GROUPS.forEach(function (g) {
        var sel = d.category === g.id ? " bg-coffee text-cream" : " bg-card text-coffee";
        html +=
          '<button type="button" class="health-cat-btn rounded-xl px-4 py-2 font-extrabold text-sm active:scale-95 transition-all duration-200' +
          sel +
          '" data-cat="' +
          g.id +
          '">' +
          escapeHtml(g.label) +
          "</button>";
      });
      html += "</div>";
    } else if (step === 2) {
      var group = null;
      for (var gi = 0; gi < SYMPTOM_GROUPS.length; gi++) {
        if (SYMPTOM_GROUPS[gi].id === d.category) {
          group = SYMPTOM_GROUPS[gi];
          break;
        }
      }
      html += '<p class="text-sm font-extrabold text-coffee mb-3">第 3 步 · 勾选具体症状</p>';
      if (!group) {
        html += '<p class="text-sm font-bold text-coffee/60">请先返回上一步选择大类。</p>';
      } else {
        html += '<div class="space-y-2">';
        group.items.forEach(function (item) {
          var checked = d.symptoms.indexOf(item.id) >= 0;
          html +=
            '<label class="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 font-bold text-sm cursor-pointer">' +
            '<input type="checkbox" class="health-symptom" data-id="' +
            item.id +
            '"' +
            (checked ? " checked" : "") +
            (item.fatal ? ' data-fatal="1"' : "") +
            "> " +
            escapeHtml(item.label) +
            "</label>";
        });
        html += "</div>";
      }
    } else {
      var advise = hasFatalSymptom(d.symptoms) ? "urgent" : d.symptoms.length >= 2 ? "vet" : "observe";
      var adviseText =
        advise === "urgent"
          ? "⚠️ 存在急症信号，请立即就医。"
          : advise === "vet"
            ? "建议 24 小时内预约兽医面诊。"
            : "可先居家观察饮水与食欲，症状加重请就医。";
      var exportText = buildHealthExport(d);
      html +=
        '<p class="text-sm font-extrabold text-coffee mb-2">分诊结果</p>' +
        '<p class="font-bold text-coffee mb-3">' +
        escapeHtml(adviseText) +
        "</p>";
      if (advise !== "observe") {
        html +=
          '<p class="text-xs font-bold text-coffee/70 mb-1">长按复制发给医生：</p>' +
          '<textarea id="healthExportText" readonly rows="4" class="w-full rounded-xl bg-cream px-3 py-2 text-sm font-bold text-coffee">' +
          escapeHtml(exportText) +
          "</textarea>" +
          '<button type="button" id="btnCopyHealth" class="mt-2 w-full rounded-xl bg-card font-extrabold py-2 active:scale-95 transition-all duration-200">复制主诉摘要</button>';
      }
    }

    html +=
      '<div class="flex gap-2 mt-4">' +
      (step > 0
        ? '<button type="button" id="healthPrev" class="flex-1 rounded-xl bg-card font-extrabold py-2 active:scale-95 transition-all duration-200">上一步</button>'
        : "") +
      '<button type="button" id="healthNext" class="flex-1 rounded-xl bg-card font-extrabold py-2 active:scale-95 transition-all duration-200">' +
      (step >= 3 ? "完成" : "下一步") +
      "</button></div>";

    el.innerHTML = html;
    bindHealthPanelEvents();
  }

  function buildHealthExport(d) {
    var species = d.species === "dog" ? "犬" : "猫";
    var onsetMap = { today: "今日", "1-3d": "近1–3天", "week+": "一周以上" };
    var labels = [];
    SYMPTOM_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (d.symptoms.indexOf(it.id) >= 0) labels.push(it.label);
      });
    });
    return (
      species +
      "，" +
      (d.age || "年龄未填") +
      "，发病" +
      (onsetMap[d.onset] || d.onset) +
      "，主诉：" +
      (labels.length ? labels.join("、") : "未勾选具体症状") +
      "。来自 Pet Guard 自检摘要，请医生结合体检判断。"
    );
  }

  function bindHealthPanelEvents() {
    var prev = $("healthPrev");
    var next = $("healthNext");
    if (prev) {
      prev.addEventListener("click", function () {
        state.healthStep = Math.max(0, state.healthStep - 1);
        renderHealthPanel();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        collectHealthStepInputs();
        if (state.healthStep === 2 && hasFatalSymptom(state.healthData.symptoms)) {
          showEmergencyModal();
        }
        if (state.healthStep >= 3) {
          state.healthStep = 0;
          closeAllPanels();
          return;
        }
        state.healthStep += 1;
        renderHealthPanel();
      });
    }

    document.querySelectorAll(".health-cat-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.healthData.category = btn.getAttribute("data-cat");
        renderHealthPanel();
      });
    });

    document.querySelectorAll(".health-symptom").forEach(function (cb) {
      cb.addEventListener("change", function () {
        collectHealthSymptomsFromDom();
        if (cb.getAttribute("data-fatal") && cb.checked) showEmergencyModal();
      });
    });

    var copyBtn = $("btnCopyHealth");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var ta = $("healthExportText");
        if (!ta) return;
        ta.select();
        try {
          document.execCommand("copy");
          copyBtn.textContent = "已复制 ✓";
        } catch (e) {
          copyBtn.textContent = "请长按文本框手动复制";
        }
      });
    }
  }

  function collectHealthStepInputs() {
    var sp = $("healthSpecies");
    var ag = $("healthAge");
    var on = $("healthOnset");
    if (sp) state.healthData.species = sp.value;
    if (ag) state.healthData.age = ag.value.trim();
    if (on) state.healthData.onset = on.value;
    if (state.healthStep === 2) collectHealthSymptomsFromDom();
  }

  function collectHealthSymptomsFromDom() {
    var ids = [];
    document.querySelectorAll(".health-symptom:checked").forEach(function (cb) {
      ids.push(cb.getAttribute("data-id"));
    });
    state.healthData.symptoms = ids;
  }

  /* ——— 深夜急诊 ——— */

  function isNightHour(h) {
    return h >= 22 || h < 7;
  }

  function hospitalOpenNow(h, meta) {
    if (meta.is_24h) return true;
    if (meta.night_emergency && isNightHour(h)) return true;
    var bh = (meta.business_hours || "").toLowerCase();
    if (/24\s*小时|24h|全天|急诊/.test(bh) && isNightHour(h)) return true;
    if (isNightHour(h)) return false;
    return true;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function startEmergencySearch() {
    var el = $("panelEmergency");
    if (!el) return;
    el.innerHTML =
      '<span class="inline-block rounded-full bg-card px-2 py-0.5 text-xs font-extrabold text-coffee mb-2">演示模式</span>' +
      '<p class="text-sm font-extrabold text-coffee mb-2">正在定位并筛选仍在营业的医院…</p>' +
      '<p class="text-xs font-bold text-coffee/60">地图 API 占位 · 模拟医院库 · 按当前系统时间过滤营业状态</p>';

    function runFilter(lat, lng) {
      var now = new Date();
      var h = now.getHours();
      var night = isNightHour(h);
      var list = MOCK_HOSPITALS.map(function (hp) {
        var dist =
          lat != null
            ? haversineKm(lat, lng, hp.lat, hp.lng)
            : 999;
        return {
          hp: hp,
          dist: dist,
          open: hospitalOpenNow(h, hp),
        };
      })
        .filter(function (x) {
          return night ? x.open : true;
        })
        .sort(function (a, b) {
          return a.dist - b.dist;
        });

      renderHospitalList(el, list, lat != null, night);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          state.userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          runFilter(pos.coords.latitude, pos.coords.longitude);
        },
        function () {
          runFilter(39.9042, 116.4074);
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } else {
      runFilter(39.9042, 116.4074);
    }
  }

  function renderHospitalList(container, list, hasGeo, night) {
    if (!list.length) {
      container.innerHTML =
        '<p class="font-bold text-coffee">当前时段未找到仍在营业的宠物医院（模拟库）。请直接拨打当地 24h 急诊热线。</p>';
      return;
    }
    var timeLabel = night ? "深夜模式 · 已过滤白天仅营业机构" : "日间 · 显示营业中机构";
    var html =
      '<p class="text-xs font-bold text-coffee/60 mb-3">' +
      escapeHtml(timeLabel) +
      '</p><ul class="space-y-3">';
    list.forEach(function (item) {
      var hp = item.hp;
      var distStr = hasGeo && item.dist < 900 ? item.dist.toFixed(1) + " km" : "—";
      var amap = "https://uri.amap.com/marker?position=" + hp.lng + "," + hp.lat + "&name=" + encodeURIComponent(hp.name);
      var qq = "https://apis.map.qq.com/uri/v1/marker?marker=coord:" + hp.lat + "," + hp.lng + ";title:" + encodeURIComponent(hp.name);
      html +=
        '<li class="rounded-xl bg-cream p-3 shadow-sm">' +
        '<p class="font-extrabold text-coffee">' +
        escapeHtml(hp.name) +
        "</p>" +
        '<p class="text-xs font-bold text-coffee/60 mt-1">' +
        escapeHtml(hp.address) +
        " · " +
        escapeHtml(hp.business_hours) +
        "</p>" +
        '<p class="text-xs font-bold text-coffee/70 mt-1">约 ' +
        distStr +
        "</p>" +
        '<div class="flex flex-wrap gap-2 mt-2">' +
        '<a href="tel:' +
        hp.phone +
        '" class="rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold active:scale-95 transition-all duration-200">📞 拨号</a>' +
        '<a href="' +
        amap +
        '" target="_blank" rel="noopener" class="rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold active:scale-95 transition-all duration-200">高德导航</a>' +
        '<a href="' +
        qq +
        '" target="_blank" rel="noopener" class="rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold active:scale-95 transition-all duration-200">腾讯地图</a>' +
        "</div></li>";
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  /* ——— 水粮计算 ——— */

  function calcDailyWaterMl(weightKg, species) {
    var mlPerKg = species === "cat" ? 50 : 55;
    return Math.round(weightKg * mlPerKg);
  }

  function renderWaterPanel() {
    var el = $("panelWater");
    if (!el) return;
    var hasFood = !!state.nutrition;
    el.innerHTML =
      '<p class="text-sm font-extrabold text-coffee mb-3">💧 饮水追踪</p>' +
      '<label class="text-xs font-bold text-coffee/70">宠物体重 (kg)</label>' +
      '<input type="number" id="waterWeight" min="0.1" step="0.1" placeholder="4.5" class="w-full rounded-xl bg-cream px-3 py-2 font-bold text-coffee mt-1">' +
      '<label class="text-xs font-bold text-coffee/70 mt-3 block">物种</label>' +
      '<select id="waterSpecies" class="w-full rounded-xl bg-cream px-3 py-2 font-bold text-coffee">' +
      '<option value="cat">猫</option><option value="dog">犬</option></select>' +
      (hasFood
        ? '<p class="text-xs font-bold text-coffee/55 mt-2">已关联识别粮：水分 ' +
          state.nutrition.moisture +
          "%，按建议喂食量估算湿粮含水。</p>"
        : '<p class="text-xs font-bold text-amber-800/80 mt-2">请先拍照识别配料表，可更准确扣除食物水分。</p>') +
      '<div id="waterCupDisplay" class="water-cup mt-4 rounded-2xl bg-cream p-4 shadow-sm">' +
      '<div class="water-cup__glass">' +
      '<div id="waterFill" class="water-cup__fill" style="height:0%"></div>' +
      "</div>" +
      '<p id="waterResultText" class="mt-3 text-center text-base font-black text-coffee">输入体重后计算</p></div>';

    var wIn = $("waterWeight");
    var sp = $("waterSpecies");
    function recalc() {
      var w = parseFloat(wIn && wIn.value);
      var species = sp ? sp.value : "cat";
      var txt = $("waterResultText");
      var fill = $("waterFill");
      if (!w || w <= 0) {
        if (txt) txt.textContent = "输入体重后计算";
        if (fill) fill.style.height = "0%";
        return;
      }
      var total = calcDailyWaterMl(w, species);
      var fromFood = 0;
      if (state.nutrition) {
        var feedG = calcDailyFeedingGrams(w, state.nutrition, state.nutrition.pet) || 0;
        fromFood = Math.round(feedG * (state.nutrition.moisture / 100));
      }
      var extra = Math.max(0, total - fromFood);
      var pct = clamp((extra / total) * 100, 8, 100);
      if (fill) fill.style.height = pct + "%";
      if (txt) {
        txt.textContent = state.nutrition
          ? "吃这款粮，主子今天还需要额外喝水 " + extra + " mL"
          : "今日基础需水量约 " + total + " mL（未关联猫粮）";
      }
    }
    if (wIn) wIn.addEventListener("input", recalc);
    if (sp) sp.addEventListener("change", recalc);
  }

  /* ——— 毒性药量 ——— */

  function renderToxicPanel() {
    var el = $("panelToxic");
    if (!el) return;
    var dewormOpts = DEWORM_PRODUCTS.map(function (p) {
      return '<option value="' + p.id + '">' + escapeHtml(p.name) + "</option>";
    }).join("");
    var toxOpts = TOXINS.map(function (t) {
      return '<option value="' + t.id + '">' + escapeHtml(t.name) + "</option>";
    }).join("");

    el.innerHTML =
      '<div class="flex gap-2 mb-4">' +
      '<button type="button" data-tox-tab="deworm" class="tox-tab flex-1 rounded-xl bg-coffee text-cream font-extrabold py-2 text-sm active:scale-95 transition-all duration-200">驱虫剂量</button>' +
      '<button type="button" data-tox-tab="intake" class="tox-tab flex-1 rounded-xl bg-card text-coffee font-extrabold py-2 text-sm active:scale-95 transition-all duration-200">误食毒性</button>' +
      "</div>" +
      '<div id="toxTabDeworm">' +
      '<label class="text-xs font-bold text-coffee/70">药品</label>' +
      '<select id="dewormProduct" class="w-full rounded-xl bg-cream px-3 py-2 font-bold mt-1">' +
      dewormOpts +
      "</select>" +
      '<label class="text-xs font-bold text-coffee/70 mt-3 block">体重 (kg，精确到 0.1)</label>' +
      '<input type="number" id="dewormWeight" min="0.1" step="0.1" class="w-full rounded-xl bg-cream px-3 py-2 font-bold mt-1">' +
      '<p id="dewormResult" class="mt-3 rounded-xl bg-cream p-3 font-black text-coffee text-sm">请输入体重</p>' +
      "</div>" +
      '<div id="toxTabIntake" class="hidden">' +
      '<label class="text-xs font-bold text-coffee/70">毒物</label>' +
      '<select id="toxinType" class="w-full rounded-xl bg-cream px-3 py-2 font-bold mt-1">' +
      toxOpts +
      "</select>" +
      '<label class="text-xs font-bold text-coffee/70 mt-3 block">误食量 (克)</label>' +
      '<input type="number" id="toxinGrams" min="0" step="0.1" class="w-full rounded-xl bg-cream px-3 py-2 font-bold mt-1">' +
      '<label class="text-xs font-bold text-coffee/70 mt-3 block">体重 (kg)</label>' +
      '<input type="number" id="toxinWeight" min="0.1" step="0.1" class="w-full rounded-xl bg-cream px-3 py-2 font-bold mt-1">' +
      '<p id="toxinResult" class="mt-3 rounded-xl bg-cream p-3 font-black text-sm">请输入数据</p>' +
      "</div>";

    document.querySelectorAll(".tox-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tox-tab");
        $("toxTabDeworm").classList.toggle("hidden", tab !== "deworm");
        $("toxTabIntake").classList.toggle("hidden", tab !== "intake");
        document.querySelectorAll(".tox-tab").forEach(function (b) {
          var on = b.getAttribute("data-tox-tab") === tab;
          b.classList.toggle("bg-coffee", on);
          b.classList.toggle("text-cream", on);
          b.classList.toggle("bg-card", !on);
          b.classList.toggle("text-coffee", !on);
        });
      });
    });

    function calcDeworm() {
      var pid = $("dewormProduct").value;
      var w = parseFloat($("dewormWeight").value);
      var out = $("dewormResult");
      var prod = null;
      for (var di = 0; di < DEWORM_PRODUCTS.length; di++) {
        if (DEWORM_PRODUCTS[di].id === pid) {
          prod = DEWORM_PRODUCTS[di];
          break;
        }
      }
      if (!prod || !w || w <= 0) {
        out.textContent = "请输入体重";
        out.className = "mt-3 rounded-xl bg-cream p-3 font-black text-coffee text-sm";
        return;
      }
      var mg = Math.round(prod.mgPerKg * w * 10) / 10;
      var doseHint = w <= 4 ? "吃半粒" : w <= 8 ? "吃 1 粒" : "按体重选大规格";
      var scaleHint = w <= 4 ? "滴至第 1 刻度" : w <= 8 ? "滴至第 2 刻度" : "滴至第 3 刻度";
      var isTopical = prod.id.indexOf("revolution") >= 0;
      out.textContent = isTopical
        ? "安全剂量：" + doseHint + " / " + scaleHint + "（约 " + mg + " mg，" + prod.unitHint + "）"
        : "安全剂量：" + doseHint + "（约 " + mg + " mg，" + prod.unitHint + "）";
      out.className = "mt-3 rounded-xl bg-cream p-3 font-black text-coffee text-sm";
    }

    function calcToxin() {
      var tid = $("toxinType").value;
      var grams = parseFloat($("toxinGrams").value);
      var w = parseFloat($("toxinWeight").value);
      var out = $("toxinResult");
      var tox = null;
      for (var ti = 0; ti < TOXINS.length; ti++) {
        if (TOXINS[ti].id === tid) {
          tox = TOXINS[ti];
          break;
        }
      }
      if (!tox || !w || w <= 0 || isNaN(grams)) {
        out.textContent = "请输入数据";
        out.className = "mt-3 rounded-xl bg-cream p-3 font-black text-sm text-coffee";
        return;
      }
      var level = "safe";
      var msg = "✅ 未达常见危险阈值，继续观察。";
      if (tox.id === "chocolate") {
        var mg = tox.calcMg(grams, 50) / w;
        if (mg >= tox.dangerMgPerKg) level = "danger";
        else if (mg >= tox.thresholdMgPerKg) level = "warn";
        msg =
          level === "danger"
            ? "🚨 危险！可可碱约 " + mg.toFixed(1) + " mg/kg，请立即急诊！"
            : level === "warn"
              ? "⚠️ 接近风险线（" + mg.toFixed(1) + " mg/kg），建议联系兽医。"
              : "✅ 约 " + mg.toFixed(1) + " mg/kg，低于常见阈值。";
      } else {
        var gpk = grams / w;
        if (gpk >= tox.dangerGPerKg) level = "danger";
        else if (gpk >= tox.thresholdGPerKg) level = "warn";
        msg =
          level === "danger"
            ? "🚨 危险！约 " + gpk.toFixed(2) + " g/kg，请立即急诊！"
            : level === "warn"
              ? "⚠️ 接近风险（" + gpk.toFixed(2) + " g/kg）。"
              : "✅ 约 " + gpk.toFixed(2) + " g/kg，相对安全。";
      }
      out.textContent = msg;
      out.className =
        "mt-3 rounded-xl p-3 font-black text-sm " +
        (level === "danger"
          ? "bg-red-100 text-red-800 tox-alert"
          : level === "warn"
            ? "bg-amber-100 text-amber-900"
            : "bg-green-100 text-green-900");
    }

    $("dewormProduct").addEventListener("change", calcDeworm);
    $("dewormWeight").addEventListener("input", calcDeworm);
    $("toxinType").addEventListener("change", calcToxin);
    $("toxinGrams").addEventListener("input", calcToxin);
    $("toxinWeight").addEventListener("input", calcToxin);
  }

  /* ——— 绑定 ——— */

  function bind() {
    var btnPhoto = $("btnPhotoIngredient");
    var ocrIn = $("ocrFileInput");
    if (btnPhoto && ocrIn) {
      btnPhoto.addEventListener("click", function () {
        ocrIn.click();
      });
    }
    if (ocrIn) {
      ocrIn.addEventListener("change", function () {
        if (ocrIn.files && ocrIn.files.length) {
          runOcrFromFile(ocrIn.files[0]);
          ocrIn.value = "";
        }
      });
    }

    var analysisTa = $("analysisRawText");
    if (analysisTa) {
      analysisTa.addEventListener("input", function () {
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

    var feedW = $("petWeightFeed");
    if (feedW) feedW.addEventListener("input", updateFeedingDisplay);

    document.querySelectorAll(".tool-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openPanel(btn.getAttribute("data-panel"));
      });
    });

    var closeAlert = $("btnCloseEmergencyAlert");
    if (closeAlert) closeAlert.addEventListener("click", hideEmergencyModal);
  }

  function bootDashboard() {
    try {
      loadNutrition();
      if (state.nutrition && hasParsedNutrition(state.nutrition)) {
        showPhotoResultsContainer();
        renderPhotoResults();
      }
      bind();
    } catch (err) {
      console.error("Pet Guard dashboard init:", err);
    }
  }

  try {
    initSplash();
    bootDashboard();
  } catch (err) {
    console.error("Pet Guard splash init:", err);
    forceShowMainIfSplashStuck();
    bootDashboard();
  }
})();
