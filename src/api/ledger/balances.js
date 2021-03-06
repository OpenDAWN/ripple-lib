/* @flow */
'use strict';
const _ = require('lodash');
const async = require('async');
const utils = require('./utils');
const getTrustlines = require('./trustlines');
const validate = utils.common.validate;
const composeAsync = utils.common.composeAsync;
const convertErrors = utils.common.convertErrors;
import type {Remote, GetLedgerSequenceCallback} from '../../core/remote';

import type {TrustlinesOptions, Trustline} from './trustlines-types.js';


type Balance = {
  value: string,
  currency: string,
  counterparty?: string
}

type GetBalances = Array<Balance>

function getTrustlineBalanceAmount(trustline: Trustline) {
  return {
    currency: trustline.specification.currency,
    counterparty: trustline.specification.counterparty,
    value: trustline.state.balance
  };
}

function formatBalances(options, balances) {
  const result = balances.trustlines.map(getTrustlineBalanceAmount);
  if (!(options.counterparty ||
       (options.currency && options.currency !== 'XRP')
  )) {
    const xrpBalance = {
      currency: 'XRP',
      value: balances.xrp
    };
    result.unshift(xrpBalance);
  }
  if (options.limit && result.length > options.limit) {
    const toRemove = result.length - options.limit;
    result.splice(-toRemove, toRemove);
  }
  return result;
}

function getTrustlinesAsync(account: string, options: TrustlinesOptions,
  callback
) {
  getTrustlines.call(this, account, options)
    .then(data => callback(null, data))
    .catch(callback);
}

function getLedgerVersionHelper(remote: Remote, optionValue?: number,
  callback: GetLedgerSequenceCallback
) {
  if (optionValue !== undefined && optionValue !== null) {
    callback(null, optionValue);
  } else {
    remote.getLedgerSequence(callback);
  }
}

function getBalancesAsync(account: string, options: TrustlinesOptions,
  callback
) {
  validate.address(account);
  validate.getBalancesOptions(options);

  async.parallel({
    xrp: async.seq(
      _.partial(getLedgerVersionHelper, this.remote, options.ledgerVersion),
      _.partial(utils.getXRPBalance, this.remote, account)
    ),
    trustlines: _.partial(getTrustlinesAsync.bind(this), account, options)
  }, composeAsync(_.partial(formatBalances, options), convertErrors(callback)));
}

function getBalances(account: string, options: TrustlinesOptions = {}
): Promise<GetBalances> {
  return utils.promisify(getBalancesAsync).call(this, account, options);
}

module.exports = getBalances;
