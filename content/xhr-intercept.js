function setupXhrInterception(callback) {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  let intercepted = false;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._xhrUrl = url;
    this._xhrMethod = method;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const xhr = this;
    const originalOnReadyStateChange = xhr.onreadystatechange;

    xhr.addEventListener('readystatechange', function() {
      if (xhr.readyState === 4) {
        try {
          if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
            const response = JSON.parse(xhr.responseText);
            if (!intercepted) {
              intercepted = true;
              callback({
                url: xhr._xhrUrl || '',
                method: xhr._xhrMethod || 'GET',
                response: response
              });
            }
          }
        } catch (e) {
          // Response is not JSON or parsing failed, skip
        }
      }
    }, { once: true });

    if (originalOnReadyStateChange) {
      xhr.onreadystatechange = function() {
        originalOnReadyStateChange.apply(xhr, arguments);
      };
    }

    return originalSend.apply(xhr, [body]);
  };
}
