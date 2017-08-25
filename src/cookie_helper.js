export default {
  set: function(name, value, days, path, secure) {
    var date = new Date(),
      expires = "",
      type = typeof value,
      valueToUse = "",
      secureFlag = "";
    path = path || "/";
    if (days) {
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    if (type === "object" && type !== "undefined") {
      valueToUse = encodeURIComponent(
        JSON.stringify({
          v: value
        })
      );
    } else {
      valueToUse = encodeURIComponent(value);
    }
    if (secure) {
      secureFlag = "; secure";
    }

    document.cookie =
      name + "=" + valueToUse + expires + "; path=" + path + secureFlag;
  },
  get: function(name) {
    var nameEQ = name + "=",
      ca = document.cookie.split(";"),
      value = "",
      firstChar = "",
      parsed = {};
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        value = decodeURIComponent(c.substring(nameEQ.length, c.length));
        firstChar = value.substring(0, 1);
        if (firstChar == "{") {
          try {
            parsed = JSON.parse(value);
            if ("v" in parsed) return parsed.v;
          } catch (e) {
            return value;
          }
        }
        if (value == "undefined") return undefined;
        return value;
      }
    }
    return null;
  },
  remove: function(name) {
    this.set(name, "", -1);
  }
};
