function setupXhrInterception(callback) {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._xhrUrl = url;
    this._xhrMethod = method;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const xhr = this;
    const originalOnReadyStateChange = xhr.onreadystatechange;

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          callback({
            url: xhr._xhrUrl,
            method: xhr._xhrMethod,
            response: response
          });
        } catch (e) {
          // Response is not JSON, skip
        }
      }

      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(xhr, arguments);
      }
    };

    return originalSend.apply(xhr, [body]);
  };
}
