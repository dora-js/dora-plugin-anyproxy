import { parse as parseUrl } from 'url';
import pathToRegexp from 'path-to-regexp';
import assign from 'object-assign';
import isPlainObject from 'is-plain-object';
import mime from 'mime-type/with-db';

function decodeParam(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val;
  }

  return decodeURIComponent(val);
}

export function isRemote(str) {
  return str.indexOf('http://') === 0 || str.indexOf('https://') === 0;
}

export function isMatch(req, pattern) {
  const { method, url } = req;
  const urlObj = parseUrl(url);
  let expectPattern;
  let expectMethod;

  if (pattern.indexOf(' ') > -1) {
    [expectMethod, expectPattern] = pattern.split(/\s+/);
  } else {
    expectPattern = pattern;
  }
  // Match method first.
  if (expectMethod && expectMethod.toUpperCase() !== method.toUpperCase()) {
    return false;
  }

  if (isRemote(expectPattern)) {
    const { hostname, port, path } = parseUrl(expectPattern);
    return hostname === urlObj.hostname
      && (port || '80') === (urlObj.port || '80')
      && !!urlObj.path.match(pathToRegexp(path));
  }

  return !!urlObj.pathname.match(pathToRegexp(expectPattern));
}

export function getParams(url, pattern) {
  const keys = [];
  const path = pattern.trim().indexOf(' ') > -1 ? pattern.split(' ')[1] : pattern;
  if (path === '/') {
    return {};
  }

  const regexp = pathToRegexp(path, keys);
  const m = regexp.exec(url);
  if (!keys.length || !m) {
    return {};
  }

  const params = {};
  m.forEach((ms, index) => {
    if (index === 0) return;
    const key = keys[index - 1];
    const prop = key.name;
    const val = decodeParam(ms);
    if (val !== undefined || !(Object.prototype.hasOwnProperty.call(params, prop))) {
      params[prop] = val;
    }
  });
  return params;
}

export function getRes(req, callback) {
  let status = 200;
  const headers = {};

  function normalizeData(data) {
    switch (typeof data) {
      case 'string':
        return data;
      default:
        return JSON.stringify(data);
    }
  }

  return {
    type(type) {
      return this.set('Content-Type', mime.lookup(type));
    },
    set(key, val) {
      if (isPlainObject(key)) {
        assign(headers, key);
      } else {
        headers[key] = val;
      }
      return this;
    },
    status(statusCode) {
      status = statusCode;
      return this;
    },
    json(data) {
      return this.type('json').end(JSON.stringify(data));
    },
    jsonp(data, callbackName) {
      const fn = req.query[callbackName || 'callback'];
      return this.type('json').end(`${fn}(${JSON.stringify(data)})`);
    },
    end(data) {
      callback(status, headers, normalizeData(data));
      return this;
    },
  };
}
