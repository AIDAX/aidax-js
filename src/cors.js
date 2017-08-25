export default function(url, callback, cors) {
  if (typeof cors === "undefined") {
    var m = url.match(/^\s*https?:\/\/[^\/]*/);
    cors =
      m &&
      m[0] !==
        location.protocol +
          "//" +
          location.hostname +
          (location.port ? ":" + location.port : "");
  }

  var x = new window.XMLHttpRequest();

  function isSuccessful(status) {
    return (status >= 200 && status < 300) || status === 304;
  }

  function loaded() {
    if (isSuccessful(x.status)) {
      callback.call(x, null, x);
    } else {
      callback.call(x, x, null);
    }
  }

  x.onreadystatechange = function readystate() {
    if (x.readyState === 4) {
      loaded();
    }
  };

  x.ontimeout = function(evt) {
    callback.call(this, evt, null);
    callback = function() {};
  };

  x.onabort = function(evt) {
    callback.call(this, evt, null);
    callback = function() {};
  };

  // GET is the only supported HTTP Verb by XDomainRequest and is the
  // only one supported here.
  x.open("GET", url, true);

  // Send the request. Sending data is not supported.
  x.send(null);

  return x;
}
