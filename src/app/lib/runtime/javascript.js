const DEFAULT_TIMEOUT_MS = 5000;

let runSeq = 0;

function buildDocument(runId, code) {
  const payload = JSON.stringify(String(code ?? ""));
  const id = JSON.stringify(runId);
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>MODCODES runtime</title></head>
<body>
<script>
(function () {
  var ID = ${id};
  var pending = 0;
  var finished = false;
  var doneSent = false;
  var timers = {};
  var timerSeq = 0;
  var nativeSetTimeout = window.setTimeout.bind(window);
  var nativeClearTimeout = window.clearTimeout.bind(window);
  var nativeSetInterval = window.setInterval.bind(window);
  var nativeClearInterval = window.clearInterval.bind(window);

  function post(kind, text) {
    try {
      parent.postMessage({ __modcodesRun: ID, kind: kind, text: text }, "*");
    } catch (err) {
      /* the parent went away */
    }
  }

  function fmt(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      try {
        if (typeof a === "string") {
          out.push(a);
        } else if (a instanceof Error) {
          out.push(a.name + ": " + a.message);
        } else if (typeof a === "undefined") {
          out.push("undefined");
        } else if (typeof a === "function") {
          out.push(String(a));
        } else {
          out.push(JSON.stringify(a));
        }
      } catch (err) {
        out.push(String(a));
      }
    }
    return out.join(" ");
  }

  function checkDone() {
    if (finished && pending === 0 && !doneSent) {
      doneSent = true;
      post("done", "");
    }
  }

  function fail(err) {
    var text;
    if (err && err.stack) {
      text = String(err.stack);
    } else if (err && err.name && err.message) {
      text = err.name + ": " + err.message;
    } else {
      text = String(err);
    }
    post("err", text);
    finished = true;
    doneSent = true;
    post("fail", "");
  }

  ["log", "info", "warn", "error", "debug", "trace"].forEach(function (name) {
    console[name] = function () {
      post("out", fmt(Array.prototype.slice.call(arguments)));
    };
  });

  window.print = function () {
    post("out", fmt(Array.prototype.slice.call(arguments)));
  };

  window.setTimeout = function (fn, delay) {
    if (typeof fn !== "function") {
      return nativeSetTimeout(fn, delay);
    }
    pending++;
    var handle = ++timerSeq;
    timers[handle] = true;
    var id = nativeSetTimeout(function () {
      delete timers[handle];
      try {
        fn();
      } catch (err) {
        fail(err);
      } finally {
        pending--;
        checkDone();
      }
    }, delay);
    return id;
  };

  window.clearTimeout = function (id) {
    if (id && timers[id]) {
      delete timers[id];
      pending--;
      nativeClearTimeout(id);
      checkDone();
      return;
    }
    nativeClearTimeout(id);
  };

  window.setInterval = function (fn, delay) {
    return nativeSetInterval(fn, delay);
  };
  window.clearInterval = nativeClearInterval;

  window.onerror = function (message, source, line, column) {
    post("err", String(message) + " (line " + line + ")");
    finished = true;
    doneSent = true;
    post("fail", "");
    return true;
  };

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    post(
      "err",
      "Unhandled promise rejection: " +
        (reason && reason.message ? reason.message : String(reason))
    );
    finished = true;
    doneSent = true;
    post("fail", "");
  });

  try {
    var result = (0, eval)(${payload});
    if (typeof result !== "undefined") {
      post("out", fmt([result]));
    }
  } catch (err) {
    fail(err);
    return;
  }

  finished = true;
  nativeSetTimeout(checkDone, 0);
})();
</script>
</body>
</html>`;
}

export function runJavaScript({ code, timeoutMs = DEFAULT_TIMEOUT_MS, onOutput } = {}) {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      resolve({
        stdout: "",
        stderr: "The JavaScript runtime requires a browser document.",
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
      });
      return;
    }

    runSeq += 1;
    const runId = `modcodes-js-${Date.now()}-${runSeq}`;
    const startedAt = Date.now();
    const stdout = [];
    const stderr = [];
    let settled = false;
    let timer = null;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("title", "MODCODES JavaScript sandbox");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:640px;height:480px;border:0;opacity:0;pointer-events:none;visibility:hidden;";

    function cleanup() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      window.removeEventListener("message", onMessage);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }

    function finish(exitCode, timedOut) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({
        stdout: stdout.join(""),
        stderr: stderr.join(""),
        exitCode,
        durationMs: Date.now() - startedAt,
        timedOut: Boolean(timedOut),
      });
    }

    function onMessage(event) {
      if (settled || event.source !== iframe.contentWindow) {
        return;
      }
      const data = event.data;
      if (!data || data.__modcodesRun !== runId) {
        return;
      }
      if (data.kind === "out") {
        stdout.push(`${data.text}\n`);
        if (typeof onOutput === "function") {
          onOutput({ type: "stdout", text: `${data.text}\n` });
        }
        return;
      }
      if (data.kind === "err") {
        stderr.push(`${data.text}\n`);
        if (typeof onOutput === "function") {
          onOutput({ type: "stderr", text: `${data.text}\n` });
        }
        return;
      }
      if (data.kind === "done") {
        finish(0, false);
        return;
      }
      if (data.kind === "fail") {
        finish(1, false);
      }
    }

    timer = window.setTimeout(() => {
      stderr.push("Timed out: the script did not finish in time and was stopped.\n");
      finish(124, true);
    }, Math.max(250, timeoutMs));

    window.addEventListener("message", onMessage);
    iframe.srcdoc = buildDocument(runId, code);
    document.body.appendChild(iframe);
  });
}
