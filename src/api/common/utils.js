/* @flow */
'use strict';
const _ = require('lodash');
const BigNumber = require('bignumber.js');
const core = require('../../core');
const errors = require('./errors');
const es6promisify = require('es6-promisify');
const keypairs = require('ripple-keypairs');

import type {Amount, RippledAmount} from './types.js';

function dropsToXrp(drops: string): string {
  return (new BigNumber(drops)).dividedBy(1000000.0).toString();
}

function xrpToDrops(xrp: string): string {
  return (new BigNumber(xrp)).times(1000000.0).floor().toString();
}

function toRippledAmount(amount: Amount): RippledAmount {
  if (amount.currency === 'XRP') {
    return xrpToDrops(amount.value);
  }
  return {
    currency: amount.currency,
    issuer: amount.counterparty ? amount.counterparty :
      (amount.issuer ? amount.issuer : undefined),
    value: amount.value
  };
}

function generateAddress(options?: Object): Object {
  const secret = keypairs.generateSeed(options);
  const keypair = keypairs.deriveKeypair(secret);
  const address = keypairs.deriveAddress(keypair.publicKey);
  return {secret, address};
}

type AsyncFunction = (...x: any) => void

function wrapCatch(asyncFunction: AsyncFunction): AsyncFunction {
  return function() {
    try {
      asyncFunction.apply(this, arguments);
    } catch (error) {
      const callback = arguments[arguments.length - 1];
      callback(error);
    }
  };
}

type Callback = (err: any, data: any) => void
type Wrapper = (data: any) => any

function composeAsync(wrapper: Wrapper, callback: Callback): Callback {
  return function(error, data) {
    if (error) {
      callback(error, data);
      return;
    }
    let result;
    try {
      result = wrapper(data);
    } catch (exception) {
      callback(exception);
      return;
    }
    callback(null, result);
  };
}

function convertErrors(callback: Callback): () => void {
  return function(error, data) {
    if (error && !(error instanceof errors.RippleError)) {
      const message = _.get(error, ['remote', 'error_message'], error.message);
      const error_ = new errors.RippleError(message);
      error_.data = data;
      callback(error_, data);
    } else if (error) {
      error.data = data;
      callback(error, data);
    } else {
      callback(error, data);
    }
  };
}

function convertExceptions<T>(f: () => T): () => T {
  return function() {
    try {
      return f.apply(this, arguments);
    } catch (error) {
      throw new errors.ApiError(error.message);
    }
  };
}

const FINDSNAKE = /([a-zA-Z]_[a-zA-Z])/g;
function convertKeysFromSnakeCaseToCamelCase(obj: any): any {
  if (typeof obj === 'object') {
    let newKey;
    return _.reduce(obj, (result, value, key) => {
      newKey = key;
      if (FINDSNAKE.test(key)) {
        newKey = key.replace(FINDSNAKE, r => r[0] + r[2].toUpperCase());
      }
      result[newKey] = convertKeysFromSnakeCaseToCamelCase(value);
      return result;
    }, {});
  }
  return obj;
}

function promisify(asyncFunction: AsyncFunction): Function {
  return es6promisify(wrapCatch(asyncFunction));
}

module.exports = {
  core,
  dropsToXrp,
  xrpToDrops,
  toRippledAmount,
  generateAddress,
  composeAsync,
  wrapCatch,
  convertExceptions,
  convertErrors,
  convertKeysFromSnakeCaseToCamelCase,
  promisify
};
