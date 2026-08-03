(() => {
  if (window.__QA_OBSERVER_INSTALLED__) return;
  window.__QA_OBSERVER_INSTALLED__ = true;

  const options = {
    captureElementText: false,
    captureResourceTimings: false,
    captureUserAgent: false,
    ...(window.__VFR_OBSERVER_OPTIONS__ || {}),
  };

  const events = [];
  const MAX_EVENTS = 5000;
  const safeText = (value, max = 160) => {
    try {
      return String(value ?? "").replace(/\s+/g, " ").slice(0, max);
    } catch {
      return "";
    }
  };
  const safeUrl = (value = location.href) => {
    try {
      const url = new URL(String(value), location.href);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
  };
  const safeEntry = (entry) => {
    const json = entry.toJSON ? entry.toJSON() : {
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
    };
    if (json.name && /^https?:/i.test(String(json.name))) {
      json.name = safeUrl(json.name);
    }
    delete json.serverTiming;
    return json;
  };
  const elementPayload = (el) => ({
    tag: el?.tagName,
    id: el?.id || undefined,
    role: el?.getAttribute?.("role") || undefined,
    label: el?.getAttribute?.("aria-label") || undefined,
    placeholder: el?.getAttribute?.("placeholder") || undefined,
    text: options.captureElementText ? safeText(el?.textContent, 120) : undefined,
  });
  const log = (kind, data = {}) => {
    const event = {
      t: performance.now(),
      wall: Date.now(),
      kind,
      url: safeUrl(),
      visibility: document.visibilityState,
      ...data,
    };
    events.push(event);
    if (events.length > MAX_EVENTS) events.shift();
    try {
      console.log("__QA_EVENT__" + JSON.stringify(event));
    } catch {}
  };

  window.__QA_EVENTS__ = events;
  log("observer_ready", {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    userAgent: options.captureUserAgent ? navigator.userAgent : undefined,
    privacyMode: options.captureElementText || options.captureResourceTimings || options.captureUserAgent ? "custom" : "default-safe",
  });

  window.addEventListener("error", (e) => {
    log("window_error", {
      message: safeText(e.message, 240),
      source: safeUrl(e.filename),
      line: e.lineno,
      col: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    log("unhandled_rejection", { reason: safeText(e.reason, 240) });
  });

  const observePerf = (type, optionsForObserver = {}) => {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const json = safeEntry(entry);
          if (type === "resource" && !options.captureResourceTimings) {
            if (entry.duration >= 1000) {
              log("perf_resource_slow", {
                name: safeUrl(entry.name),
                initiatorType: entry.initiatorType,
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          } else if (type === "layout-shift" && !entry.hadRecentInput && entry.value > 0.01) {
            log("perf_layout_shift", json);
          } else if (type === "longtask" && entry.duration >= 50) {
            log("perf_longtask", json);
          } else if (type === "long-animation-frame" && entry.duration >= 50) {
            log("perf_long_animation_frame", json);
          } else if (type === "event" && entry.duration >= 40) {
            log("perf_event", json);
          } else if (!["layout-shift", "longtask", "long-animation-frame", "event", "resource"].includes(type)) {
            log(`perf_${type}`, json);
          }
        }
      }).observe({ type, buffered: true, ...optionsForObserver });
    } catch {}
  };

  for (const type of [
    "long-animation-frame",
    "longtask",
    "layout-shift",
    "event",
    "paint",
    "largest-contentful-paint",
    "resource",
    "navigation",
  ]) {
    observePerf(type, type === "event" ? { durationThreshold: 40 } : {});
  }

  let lastRaf = performance.now();
  const rafSamples = [];
  const raf = (now) => {
    const delta = now - lastRaf;
    lastRaf = now;
    rafSamples.push(delta);
    if (rafSamples.length > 300) rafSamples.shift();
    if (delta > 25) log("raf_gap", { delta });
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  setInterval(() => {
    if (!rafSamples.length) return;
    const sorted = [...rafSamples].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    log("raf_summary", {
      count: sorted.length,
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      max: sorted[sorted.length - 1],
    });
  }, 5000);

  let lastScroll = { x: scrollX, y: scrollY };
  setInterval(() => {
    const dx = scrollX - lastScroll.x;
    const dy = scrollY - lastScroll.y;
    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      log("scroll_change", { x: scrollX, y: scrollY, dx, dy });
    }
    lastScroll = { x: scrollX, y: scrollY };
  }, 100);

  document.addEventListener("focusin", (e) => {
    log("focusin", elementPayload(e.target));
  }, true);

  document.addEventListener("click", (e) => {
    const rect = e.target?.getBoundingClientRect?.();
    log("click", {
      ...elementPayload(e.target),
      x: e.clientX,
      y: e.clientY,
      box: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined,
    });
  }, true);

  let mutationCount = 0;
  new MutationObserver((records) => {
    mutationCount += records.length;
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  setInterval(() => {
    if (mutationCount > 50) log("mutation_burst", { count: mutationCount });
    mutationCount = 0;
  }, 250);

  document.addEventListener("visibilitychange", () => {
    log("visibility_change", { state: document.visibilityState });
  });

  window.addEventListener("resize", () => {
    log("resize", { width: innerWidth, height: innerHeight, dpr: devicePixelRatio });
  });
})();
