import cookie from "./cookie_helper.js";
import AX_TRACK_VIEWPORT from "./viewport.js";
import UUID from "./uuid.js";
import UAParser from "./ua_parser.js";
import corslite from "./cors.js";

var getRandomString = function() {
  var x = 2147483648;
  return (
    Math.floor(Math.random() * x).toString(36) +
    Math.abs(Math.floor(Math.random() * x) ^ new Date().getTime()).toString(36)
  );
};

function E() {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function(name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function(name, callback, ctx) {
    var self = this;
    function listener() {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    }

    listener._ = callback;
    return this.on(name, listener, ctx);
  },

  emit: function(name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function(name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    liveEvents.length ? (e[name] = liveEvents) : delete e[name];

    return this;
  }
};

var AIDAX_COLLECTOR = "//api.aidax.com.br",
  emitter = new E(),
  debug = false,
  CUSTOM_KEYS_LIMIT = 20,
  log = function(msg) {
    if (debug) {
      console.log(msg);
    }
  },
  assert = function(bool, msg) {
    if (!bool) {
      log(msg);
    }
    return bool;
  },
  addUnloadEvent = function(unloadEvent) {
    var executed = false,
      exec = function() {
        if (!executed) {
          executed = true;
          unloadEvent();
        }
      };
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") {
        exec();
      }
    });
    window.addEventListener("pagehide", exec);
    window.addEventListener("beforeunload", exec);
    window.onbeforeunload = exec;
  },
  urlencode = function(str) {
    return encodeURIComponent(str)
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/!/g, "%21")
      .replace(/\*/g, "%2A")
      .replace(/~/g, "%7E");
  },
  normalize_url = function(str) {
    return str.replace(
      /[{}"*|\^<>\\\,\[\]\s\u00C0-\u017F]/g,
      encodeURIComponent
    );
  },
  getReferrer = function() {
    var referrer = "";

    try {
      referrer = window.top.document.referrer;
    } catch (e) {
      if (window.parent) {
        try {
          referrer = window.parent.document.referrer;
        } catch (e2) {
          referrer = "";
        }
      }
    }

    if (referrer === "") {
      referrer = document.referrer;
    }
    return urlencode(normalize_url(referrer));
  },
  getHref = function() {
    var href = "";

    try {
      href = window.top.location.href;
    } catch (e) {
      if (window.parent) {
        try {
          href = window.parent.location.href;
        } catch (e2) {
          href = "";
        }
      }
    }

    if (href === "") {
      href = window.location.href;
    }

    if (href === "") {
      href = document.location.href;
    }

    return urlencode(normalize_url(href));
  },
  extra_params = {},
  key = AIDAX_CLIENT_KEY || "",
  validate_obj = function(source, properties) {
    var i = 0,
      valid = true;
    for (var k in properties) {
      if (properties.hasOwnProperty(k)) {
        i++;
        if (
          typeof properties[k] === "undefined" ||
          properties[k] === null ||
          properties[k] === ""
        ) {
          delete properties[k];
        } else if (
          k.indexOf(".") > -1 ||
          ((typeof properties[k] === "object" ||
            Array.isArray(properties[k])) &&
            k !== "$tags") ||
          i > CUSTOM_KEYS_LIMIT
        ) {
          valid = false;
          break;
        }
      }
    }
    assert(valid, source + " properties have one or more invalid fields.");
    if(!valid) {
      return {};
    }
    return properties;
  },
  stringify_tags = function(tags) {
    for (var i = 0; i < tags.length; i++) {
      tags[i] = tags[i].toString();
    }
    return tags;
  },
  validate_email = function(email) {
    var email_regex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
    return email_regex.test(email);
  },
  validate_uuid = function(id) {
    var uuid_regex = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
    return uuid_regex.test(id);
  },
  href = getHref(),
  referer = getReferrer(),
  device = UAParser(),
  browser = [device.browser.name, device.browser.version],
  userLang = urlencode(navigator.language || navigator.userLanguage),
  timezoneOffset = new Date().getTimezoneOffset(),
  ready = false,
  readyCallbacks = [],
  current_batch = [],
  identifying = "n",
  migrating = "s",
  unique = "n",
  validate_uid = function(id) {
    return validate_email(id) || id.length < 41;
  };

if (!cookie.get("aidax_unique")) {
  unique = "s";
  cookie.set("aidax_unique", "true", 30, "/");
}

delete device.ua;
delete device.engine;
delete device.cpu;
delete device.device;

var aidax_visitor_id = cookie.get("aidax_visitor");
if (!aidax_visitor_id || !validate_uid(aidax_visitor_id)) {
  var uuid = new UUID(4);
  aidax_visitor_id = uuid.format();
  cookie.set("aidax_visitor", aidax_visitor_id, 365, "/");
}

var uid = aidax_visitor_id,
  _device = device,
  unencoded_device = JSON.stringify(device),
  device = urlencode(unencoded_device),
  generateDefaultParameters = function() {
    var querystring = "rf=" + referer;

    querystring += "&loh=" + href;
    querystring += "&la=" + userLang;
    querystring += "&i=" + identifying;
    querystring += "&mig=" + migrating;
    querystring +=
      "&uid=" +
      encodeURIComponent(
        identifying === "s" ? uid : cookie.get("aidax_visitor")
      );
    querystring += "&un=" + unique;
    querystring += "&cid=" + encodeURIComponent(cookie.get("aidax_visitor"));
    querystring += "&tz=" + timezoneOffset;
    querystring += "&res=" + screen.width + "x" + screen.height;
    querystring += "&de=" + device;
    querystring += "&key=" + urlencode(key);
    return querystring;
  },
  add_to_batch = function(name, properties) {
    var cond = assert(cookie_enabled(), "[AIDAX] Cookie disabled.");
    if(cond) {
      current_batch.unshift({
        n: name,
        ps: properties
      });
      log(
        "Adding to the current batch: [" +
          name +
          "] \n" +
          JSON.stringify(properties)
      );
      if (navigator.sendBeacon && ready) {
        execute_batch();
      }
    }
  },
  return_query_params = function() {
    var q = {};
    window.location.href.replace(
      new RegExp("([^?=&]+)(=([^&]*))?", "g"),
      function($0, $1, $2, $3) {
        q[$1.toLowerCase()] = $3;
      }
    );
    return q;
  },
  cookie_enabled = function() {
    document.cookie = "tcax";
    return document.cookie.indexOf("tcax") !== -1;
  },
  cors = function(url_fragment, params, callback) {
    corslite(
      AIDAX_COLLECTOR +
        url_fragment +
        "?" +
        generateDefaultParameters() +
        "&" +
        params,
      function(err, resp) {
        if (typeof callback === "function") {
          callback(resp.responseText);
        }
      },
      true
    );
  },
  execute_batch = function(callback) {
    if (current_batch.length > 0) {
      log("Sending " + current_batch.length + " items to AIDAX");
      for (var i = 0; i < current_batch.length; i++) {
        var item = current_batch[i];
        Object.keys(item.ps).forEach(function(k) {
          if (Array.isArray(item.ps[k])) {
            for (var j = 0; j < item.ps[k].length; j++) {
              if (typeof item.ps[k][j] === "string") {
                item.ps[k][j] = normalize_url(urlencode(item.ps[k][j]));
              }
            }
          } else if (typeof item.ps[k] === "object" && item.ps[k] !== null) {
            Object.keys(item.ps[k]).forEach(function(k2) {
              if (Array.isArray(item.ps[k][k2])) {
                for (var j = 0; j < item.ps[k][k2].length; j++) {
                  if (typeof item.ps[k][k2][j] === "string") {
                    item.ps[k][k2][j] = normalize_url(
                      urlencode(item.ps[k][k2][j])
                    );
                  }
                }
              } else {
                if (typeof item.ps[k][k2] === "string") {
                  item.ps[k][k2] = normalize_url(urlencode(item.ps[k][k2]));
                }
              }
            });
          } else {
            if (typeof item.ps[k] === "string") {
              item.ps[k] = normalize_url(urlencode(item.ps[k]));
            }
          }
        });
      }
      var batch_params = {
        rf: decodeURIComponent(referer),
        loh: decodeURIComponent(href),
        la: userLang,
        i: identifying,
        mig: migrating,
        uid: urlencode(identifying === "s" ? uid : cookie.get("aidax_visitor")),
        un: unique,
        cid: urlencode(cookie.get("aidax_visitor")),
        tz: timezoneOffset,
        res: screen.width + "x" + screen.height,
        de: unencoded_device,
        key: urlencode(key),
        p: JSON.stringify(current_batch)
      };
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          AIDAX_COLLECTOR + "/batch",
          JSON.stringify(batch_params)
        );
        if (typeof callback === "function") {
          callback();
        }
      } else {
        var x = new XMLHttpRequest();
        x.open("POST", AIDAX_COLLECTOR + "/batch", true);
        x.setRequestHeader("Content-Type", "text/plain");
        x.send(JSON.stringify(batch_params));
        if (typeof callback === "function") {
          callback();
        }
      }
      current_batch = [];
      identifying = "n";
      if (validate_uid(uid)) {
        cookie.set("aidax_visitor", uid, 365, "/");
      }
    } else {
      if (typeof callback === "function") {
        callback();
      }
    }
  },
  ax_methods = {
    event: function(obj) {
      var cond1 = assert(
        typeof obj === "object" &&
          obj !== null &&
          Object.keys(obj).length > 0 &&
          typeof obj.name === "string" &&
          obj.name !== "",
        "[AIDAX] Invalid event parameters."
      );
      var cond2 = assert(
        typeof obj.id === "undefined" ||
          (typeof obj.id === "string" && validate_uuid(obj.id)),
        "[AIDAX] Invalid event ID."
      );
      if(cond1 && cond2) {
        var name = obj.name;
        var cond3 = assert(
          name.indexOf(".") === -1 && name.length < 40,
          "[AIDAX] Event name is too long or has invalid characters."
        );
        if(cond3) {
          var event_properties =
            typeof obj.properties === "object" && obj.properties !== null
              ? obj.properties
              : {};
          event_properties = validate_obj("Event", event_properties);
          var id = new UUID(5, key, aidax_visitor_id + name + getRandomString());
          id = id.format();
          var payload = {
            name: name,
            id: obj.id || id,
            p: event_properties
          };
          if (Array.isArray(event_properties.$tags)) {
            payload.tags = stringify_tags(event_properties.$tags);
            delete event_properties.$tags;
          }
          add_to_batch("event", payload);
          if (typeof obj.callback === "function") {
            obj.callback(id);
          }
        }
      }
      return this;
    },
    batch: function(callback) {
      var cond = assert(cookie_enabled(), "[AIDAX] Cookie disabled.");
      if(cond) {
        execute_batch(callback);
      }
      return this;
    },
    toggle_debug: function() {
      debug = !debug;
    },
    noop: function() {
      return this;
    },
    invoke_ready_callbacks: function() {
      if (readyCallbacks.length > 0) {
        for (var i = 0; i < readyCallbacks.length; i++) {
          readyCallbacks[i]();
        }
        readyCallbacks = [];
      }
    },
    ready: function(callback) {
      if (typeof callback === "function") {
        readyCallbacks.push(callback);
        if (ready) {
          this.invoke_ready_callbacks();
        }
      }
    },
    delete_tags: function(type, id, tags) {
      var cond = assert(["event", "visitor"].indexOf(type) > -1, "Invalid type.");
      var cond2 = true;
      if(cond) {
        if (type === "visitor") {
          tags = id;
        } else {
          cond2 = assert(typeof id === "string" && id !== "", "Invalid id.");
        }
        if(cond2) {
          var cond3 = assert(
            (typeof tags === "string" && tags !== "") ||
              (Array.isArray(tags) && tags.length > 0 && tags.length < 401),
            "Invalid tag(s)."
          );
          if(cond3) {
            if (typeof tags === "string") {
              tags = [tags];
            }
            cors(
              "/delete/tags",
              "type=" +
                type +
                (type !== "visitor" ? "&id=" + id : "") +
                "&tags=" +
                urlencode(JSON.stringify(tags))
            );
          }
        }
      }
      return this;
    },
    increment: function(type, name, value, callback) {
      var cond1 = assert(cookie_enabled(), "[AIDAX] Cookie disabled.");
      var cond2 = assert(
        ["user", "session"].indexOf(type) > -1 &&
          typeof name === "string" &&
          name !== "" &&
          typeof value === "number",
        "[AIDAX] Invalid increment parameters"
      );
      if(cond1 && cond2) {
        if (typeof callback === "undefined") {
          callback = function() {};
        }
        cors(
          "/increment",
          "type=" + type + "&name=" + urlencode(name) + "&value=" + value,
          callback
        );
      }
      return this;
    },
    clear_ab: function(key) {
      var cond = assert(cookie_enabled(), "[AIDAX] Cookie disabled.");
      if(cond) {
        if (!key) {
          cookie.remove("aidax_ab");
        } else if (typeof key === "string" && key !== "") {
          var ab = cookie.get("aidax_ab");
          if (!!ab) {
            var ab_obj = JSON.parse(ab);
            delete ab_obj[key];
            cookie.set("aidax_ab", JSON.stringify(ab_obj), 3, "/");
          }
        }
      }
      return this;
    },
    ab: function(_key, choices) {
      var cond1 = assert(cookie_enabled(), "[AIDAX] Cookie disabled.");
      var cond2 = assert(
        typeof _key === "string" &&
          _key !== "" &&
          typeof choices === "object" &&
          choices !== null &&
          Array.isArray(choices),
        "[AIDAX] Missing ab parameters."
      );
      if(cond1 && cond2) {
        var ab_properties = cookie.get("aidax_ab"),
          ab_obj = {},
          choice,
          getRandomInt = function(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
          },
          get_choice_from_obj = function() {
            var sortable = [],
              acc = 0,
              i,
              last_weight = 0,
              r;
            if (Array.isArray(choices)) {
              choice = choices[Math.floor(Math.random() * choices.length)];
            } else {
              for (var k in choices) {
                if (choices.hasOwnProperty(k)) {
                  sortable.push([
                    k,
                    [
                      last_weight === 0 ? last_weight : last_weight + 1,
                      choice[k] + last_weight
                    ]
                  ]);
                  last_weight = choice[k];
                  acc += +choice[k];
                }
              }
              r = getRandomInt(0, acc);
              sortable.sort(function(a, b) {
                return a[1] - b[1];
              });
              for (i = 0; i < sortable.length; i++) {
                if (r >= sortable[i][1][0] && r <= sortable[i][1][1]) {
                  choice = sortable[i][0];
                  break;
                }
              }
            }
            ab_obj[_key] =
              typeof choice === "string" ? choice.trim().toLowerCase() : choice;
          };
        if (!!ab_properties) {
          ab_obj = JSON.parse(ab_properties);
          if (!!ab_obj[_key]) {
            return ab_obj[_key];
          } else {
            get_choice_from_obj();
          }
        } else {
          get_choice_from_obj();
        }
        cookie.set("aidax_ab", JSON.stringify(ab_obj), 3, "/");
        this.session(ab_obj);
        return choice;
      }
    },
    log_impression: function(title, has_clicked, cost, cost_type, elem) {
      var cond1 = assert(
        cost === "" || cost === null || !isNaN(+cost),
        "Invalid cost for banner " + title
      );
      var cond2 = assert(
        !cost_type || ["cpa", "cpc", "cpm"].indexOf(cost_type) > -1,
        "Invalid cost type for banner " + title
      );
      if(cond1 && cond2) {
        var obj = {
          cost_type: cost_type,
          cost: cost,
          clicked: has_clicked
        };
        return this.emit(
          "banner" + (has_clicked ? "_clicked" : "") + ":" + title,
          obj,
          elem
        );
      }
    },
    session: function(_properties) {
      var cond1 = assert(
        typeof _properties === "object" &&
          _properties !== null &&
          Object.keys(_properties).length > 0,
        "[AIDAX] Missing session property parameters."
      );
      if(cond1) {
        var properties = validate_obj("Session Properties", _properties);
        add_to_batch("session", {
          p: properties
        });
      }
      return this;
    },
    start: function() {
      var cond1 = assert(validate_uuid(key), "[AIDAX] Invalid AIDAX_CLIENT_KEY.");
      var cond2 = assert(!window.ax.start, "[AIDAX] Script already initialized.");
      var cond3 = assert(cookie_enabled(), "[AIDAX] Cookies are disabled.");
      var cond4 = assert(
        JSON.stringify &&
          document.querySelectorAll &&
          (browser[0] !== "IE" ||
            (browser[0] === "IE" &&
              ["7", "8", "9"].indexOf(browser[1]) === -1)),
        "[AIDAX] Browser is old or in compatibility mode(IE)."
      );
      if(cond1 && cond2 && cond3 && cond4) {
        var self = this;
        self.track_campaign();
        var queue = window.ax._container.slice(0),
          query_queue = [],
          i;

        for (i = queue.length - 1; i >= 0; i--) {
          if (["toggle_debug"].indexOf(queue[i].method) > -1) {
            self[queue[i].method].apply(self, queue[i].args);
            queue.splice(i, 1);
          }
        }

        for (i = queue.length - 1; i >= 0; i--) {
          if (
            ["increment", "query", "whois", "delete_tags"].indexOf(
              queue[i].method
            ) > -1
          ) {
            query_queue.push(queue[i]);
            queue.splice(i, 1);
          } else {
            self[queue[i].method].apply(self, queue[i].args);
          }
        }

        self.track_url_actions();
        self.batch(function() {
          for (i = 0; i < query_queue.length; i++) {
            self[query_queue[i].method].apply(self, query_queue[i].args);
          }
          AX_TRACK_VIEWPORT.init(self);
          ready = true;
          self.invoke_ready_callbacks();
          if (!navigator.sendBeacon) {
            addUnloadEvent(self.batch);
            setInterval(self.batch, 400);
          }
        });
        this.start = this.noop;
      }
      return this;
    },
    is_unique: function() {
      return unique === "s";
    },
    on: emitter.on,
    emit: emitter.emit,
    query: function(obj) {
      var type = obj.type,
        value = obj.value,
        callback = obj.callback;
      var cond1 = assert(cookie_enabled(), "[AIDAX] Cookie disabled.");
      var cond2 = assert(
        ["user", "profile", "event", "whois", "session", "metric"].indexOf(
          type
        ) > -1,
        "[AIDAX] Invalid query type"
      );
      var cond3 = assert(
        (["user", "session"].indexOf(type) === -1 &&
          typeof value === "string" &&
          value !== "") ||
          ["user", "session"].indexOf(type) > -1,
        "[AIDAX] Invalid query parameters."
      );
      var cond4 = assert(
        typeof callback === "function",
        "[AIDAX] Missing callback function."
      );
      if(cond1 && cond2 && cond3 && cond4) {
        if (typeof value === "string") {
          value = value.trim().toLowerCase();
        }
        if (type === "metric") {
          corslite(
            AIDAX_COLLECTOR + "/rkey?id=" + value,
            function(err, resp) {
              if (typeof callback === "function") {
                callback(resp.responseText);
              }
            },
            true
          );
        } else {
          cors(
            "/query",
            "type=" +
              type +
              (["user", "session"].indexOf(type) > -1
                ? ""
                : "&value=" + urlencode(value)),
            callback
          );
        }
      }
      return this;
    },
    track_url_actions: function() {
      var q = return_query_params(),
        params = {
          ax_uid: "user",
          ax_event: "event"
        },
        user_obj = {},
        event_obj = {},
        sp_obj = {},
        params_to_obj = {
          ax_uid: user_obj,
          ax_event: event_obj
        },
        query_keys = Object.keys(q),
        param_keys = Object.keys(params),
        populate_obj = function(key, obj) {
          var r = new RegExp(key);
          for (var i = 0; i < query_keys.length; i++) {
            if (r.test(query_keys[i])) {
              obj[query_keys[i].replace(key, "")] = decodeURIComponent(
                q[query_keys[i]]
              );
            }
          }
        };
      for (var i = param_keys.length - 1; i >= 0; i--) {
        if (
          typeof q[param_keys[i]] !== "undefined" &&
          q[param_keys[i]] != null
        ) {
          populate_obj(param_keys[i] + "_", params_to_obj[param_keys[i]]);
        }
      }
      populate_obj("ax_sp_", sp_obj);
      for (var i = 0; i < param_keys.length; i++) {
        if (
          typeof q[param_keys[i]] !== "undefined" &&
          q[param_keys[i]] != null
        ) {
          if (param_keys[i] === "ax_event") {
            this[params[param_keys[i]]]({
              name: decodeURIComponent(q[param_keys[i]]),
              properties: event_obj
            });
            event_obj = {};
          } else if (param_keys[i] === "ax_uid") {
            this[params[param_keys[i]]]({
              id: decodeURIComponent(q[param_keys[i]]),
              properties: user_obj
            });
            user_obj = {};
          } else {
            this[params[param_keys[i]]](decodeURIComponent(q[param_keys[i]]));
          }
        }
      }
      if(Object.keys(sp_obj).length > 0) {
        this.session(sp_obj);
      }
      this.track_url_actions = this.noop;
      return this;
    },
    track_campaign: function() {
      var q = return_query_params(),
        campaign_params = [
          "utm_source",
          "utm_medium",
          "utm_term",
          "utm_content",
          "utm_campaign"
        ];
      for (var i = 0; i < campaign_params.length; i++) {
        if (typeof q[campaign_params[i]] !== "undefined") {
          extra_params[campaign_params[i]] = urlencode(
            q[campaign_params[i]].toLowerCase().trim()
          );
        }
      }
      if (
        typeof extra_params === "object" &&
        extra_params !== null &&
        Object.keys(extra_params).length > 0
      ) {
        this.session(extra_params);
      }
      this.track_campaign = this.noop;
      return this;
    },
    whois: function(callback) {
      return this.query({
        type: "whois",
        value: cookie.get("aidax_visitor"),
        callback: function(id) {
          uid = id;
          cookie.set("aidax_visitor", id, 365, "/");
          if (typeof callback === "function") {
            callback(id);
          }
        }
      });
    },
    user: function(obj) {
      var new_uid = typeof obj.id !== "undefined" ? obj.id.toString() : "";
      var properties =
        typeof obj.properties === "object" && obj.properties !== null
          ? obj.properties
          : {};
      migrating =
        typeof obj.migrate === "undefined" || obj.migrate === true ? "s" : "n";
      var is_new_uid = new_uid !== "";
      var cond1 = assert(
        typeof obj === "object" && obj !== null &&
          Object.keys(obj).length > 0,
        "[AIDAX] Missing user parameters"
      );
      var cond2 = true
      if(cond1) {
        if (is_new_uid) {
          cond2 = assert(
            validate_uid(new_uid),
            "[AIDAX] UID has invalid email format or is greater than 40 characters."
          );
          if(cond2) {
            uid = new_uid;
            properties =
              typeof properties === "object" && properties !== null
                ? validate_obj("User properties", properties)
                : {};
          }
        } else {
          properties = validate_obj("User properties", new_uid);
        }
        if(cond2) {
          identifying = "s";
          var payload = {
            p: properties
          };
          if (Array.isArray(properties.$tags)) {
            payload.tags = stringify_tags(properties.$tags);
            delete properties.$tags;
          }
          add_to_batch("user", payload);
        }
      }
      return this;
    }
  },
  ax_function = function() {
    return ax_methods.event.apply(ax_methods, arguments);
  };

for (var k in ax_methods) {
  if (ax_methods.hasOwnProperty(k)) {
    ax_function[k] = ax_methods[k];
  }
}
export default ax_function;
