'use strict';
/**
 * Cache for token details.
 *
 * @module lib/kitSaasSharedCacheManagement/Token
 */

const rootPrefix = '../..',
  Token = require(rootPrefix + '/app/models/mysql/Token'),
  BaseCacheManagement = require(rootPrefix + '/lib/kitSaasSharedCacheManagement/Base');

/**
 * Class for token details cache
 *
 * @class
 */
class TokenCache extends BaseCacheManagement {
  /**
   * Constructor for token details cache
   *
   * @param {Object} params - cache key generation & expiry related params
   *
   * @augments BaseCacheManagement
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.clientId = params.clientId;

    // Call sub class method to set cache key using params provided
    oThis._setCacheKeySuffix();

    // Call sub class method to set cache expiry using params provided
    oThis._setCacheExpiry();

    // Call sub class method to set cache implementer using params provided
    oThis._setCacheImplementer();
  }

  /**
   * set cache keys
   */
  _setCacheKeySuffix() {
    const oThis = this;
    oThis.cacheKeySuffix = `c_tkn_${oThis.clientId}`;
  }

  /**
   * set cache expiry in oThis.cacheExpiry and return it
   */
  _setCacheExpiry() {
    const oThis = this;
    oThis.cacheExpiry = 24 * 60 * 60; // 24 hours ;
  }

  /**
   * fetch data from source
   *
   * @return {Result}
   */
  async _fetchDataFromSource() {
    const oThis = this;
    return await new Token().getDetailsByClientId(oThis.clientId);
  }
}

module.exports = TokenCache;