/**
 * MODCODES Python runtime worker.
 *
 * Runs user Python inside Pyodide so the main thread stays responsive and an
 * infinite loop can be stopped by terminating the worker. Static asset, served
 * from /public so it can be registered without a bundler loader.
 */

var pyodidePromise = null;
var activeIndexUrl = null;

function ensureRuntime(indexURL) {
  if (pyodidePromise && activeIndexUrl === indexURL) {
    return pyodidePromise;
  }
  activeIndexUrl = indexURL;
  pyodidePromise = (async function () {
    if (typeof self.loadPyodide !== "function") {
      try {
        importScripts(indexURL + "pyodide.js");
      } catch (err) {
        throw new Error(
          "Could not download the Python runtime. Check your connection — after the first download it is cached and works offline."
        );
      }
    }
    if (typeof self.loadPyodide !== "function") {
      throw new Error("The Python runtime failed to initialise.");
    }
    return self.loadPyodide({ indexURL: indexURL });
  })();
  return pyodidePromise;
}

self.onmessage = async function (event) {
  var message = event.data || {};
  var id = message.id;

  function send(payload) {
    self.postMessage(Object.assign({ id: id }, payload));
  }

  if (message.type === "warm") {
    try {
      await ensureRuntime(message.indexURL);
      send({ type: "ready" });
    } catch (err) {
      send({ type: "fatal", stdout: "", stderr: String((err && err.message) || err), error: String((err && err.message) || err) });
    }
    return;
  }

  if (message.type !== "run") {
    return;
  }

  var stdout = "";
  var stderr = "";

  try {
    var py = await ensureRuntime(message.indexURL);
    send({ type: "ready" });

    py.setStdout({
      batched: function (text) {
        stdout += text + "\n";
        send({ type: "out", text: text + "\n" });
      },
    });
    py.setStderr({
      batched: function (text) {
        stderr += text + "\n";
        send({ type: "err", text: text + "\n" });
      },
    });

    try {
      await py.runPythonAsync(String(message.code || ""));
      send({ type: "done", stdout: stdout, stderr: stderr, exitCode: 0 });
    } catch (err) {
      var detail = String((err && err.message) || err);
      stderr += detail + "\n";
      send({ type: "fail", stdout: stdout, stderr: stderr, exitCode: 1, error: detail });
    }
  } catch (err) {
    var fatal = String((err && err.message) || err);
    send({ type: "fatal", stdout: stdout, stderr: fatal + "\n", error: fatal });
  }
};
