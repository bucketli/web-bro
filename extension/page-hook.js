(function () {
  if (window.__ccDatasourceAddHookInstalled) {
    return;
  }
  window.__ccDatasourceAddHookInstalled = true;

  var TARGET = "/rdp/console/api/v1/datasource/add";

  function post(payload, meta) {
    try {
      window.postMessage(
        {
          source: "CC_AUTOMATION_HOOK",
          type: "CC_DATASOURCE_ADD_API_RESULT",
          payload: payload,
          meta: meta || {}
        },
        "*"
      );
    } catch (error) {}
  }

  function shouldTrack(url) {
    return String(url || "").toLowerCase().includes(TARGET);
  }

  function parseAndPost(value, meta) {
    if (!value) {
      return;
    }

    if (typeof value === "object") {
      post(value, meta);
      return;
    }

    var text = String(value || "");
    if (!text) {
      return;
    }

    try {
      post(JSON.parse(text), meta);
      return;
    } catch (error) {}

    var jsonLike = text.match(/\{[\s\S]*\}/);
    if (jsonLike && jsonLike[0]) {
      try {
        post(JSON.parse(jsonLike[0]), meta);
        return;
      } catch (error) {}
    }

    post({ __rawText: text.slice(0, 1000) }, meta);
  }

  var originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function () {
      var args = Array.prototype.slice.call(arguments);
      var response = await originalFetch.apply(this, args);

      try {
        var reqArg = args && args[0];
        var reqUrl = reqArg && reqArg.url ? reqArg.url : reqArg;
        if (shouldTrack(reqUrl)) {
          var cloned = response.clone();
          var meta = { transport: "fetch", requestUrl: String(reqUrl || "") };
          cloned
            .json()
            .then(function (data) {
              parseAndPost(data, meta);
            })
            .catch(function () {
              cloned
                .text()
                .then(function (text) {
                  parseAndPost(text, meta);
                })
                .catch(function () {});
            });
        }
      } catch (error) {}

      return response;
    };
  }

  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ccHookUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (shouldTrack(this.__ccHookUrl)) {
      this.addEventListener("load", function () {
        try {
          var meta = { transport: "xhr", requestUrl: String(this.__ccHookUrl || "") };
          parseAndPost(this.response, meta);
          parseAndPost(this.responseText, meta);
        } catch (error) {}
      });
    }
    return originalSend.apply(this, arguments);
  };
})();
