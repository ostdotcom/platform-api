const rootPrefix = '../../..',
  RedemptionCountryModel = require(rootPrefix + '/app/models/mysql/Country'),
  BaseKitSaasMultiCacheManagement = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/Base'),
  cacheManagementConstants = require(rootPrefix + '/lib/globalConstant/cacheManagement');

/**
 * Class for redemption product countries by country id cache.
 *
 * @class RedemptionProductCountryByCountryId
 */
class RedemptionProductCountryByCountryId extends BaseKitSaasMultiCacheManagement {
  /**
   * Constructor for redemption product countries by product id cache.
   *
   * @param {object} params: cache key generation & expiry related params
   * @param {array<string/number>} params.countryIds
   *
   * @augments BaseKitSaasMultiCacheManagement
   *
   * @constructor
   */
  constructor(params) {
    super();

    const oThis = this;

    oThis.countryIds = params.countryIds;

    oThis.cacheType = cacheManagementConstants.sharedMemcached;

    // Call sub class method to set cache level.
    oThis._setCacheLevel();

    // Call sub class method to set cache keys using params provided.
    oThis._setCacheKeys();

    // Call sub class method to set inverted cache keys using params provided.
    oThis._setInvertedCacheKeys();

    // Call sub class method to set cache expiry using params provided.
    oThis._setCacheExpiry();

    // Call sub class method to set cache implementer using params provided.
    oThis._setCacheImplementer();
  }

  /**
   * Set cache level.
   *
   * @sets oThis.cacheLevel
   *
   * @private
   */
  _setCacheLevel() {
    const oThis = this;

    oThis.cacheLevel = cacheManagementConstants.kitSaasSubEnvLevel;
  }

  /**
   * Set cache keys.
   *
   * @sets oThis.saasCacheKeys
   *
   * @private
   */
  _setCacheKeys() {
    const oThis = this;

    // It uses shared cache key between company api and saas. Any changes in key here should be synced.
    for (let index = 0; index < oThis.countryIds.length; index++) {
      oThis.saasCacheKeys[oThis._saasCacheKeyPrefix() + 'cm_ksm_rcbi_' + oThis.countryIds[index]] =
        oThis.countryIds[index];
      // NOTE: We are not setting kitCacheKeys here as the cacheLevel is only saasSubEnvLevel.
    }
  }

  /**
   * Set cache expiry.
   *
   * @param {number} [timeDelta]
   *
   * @sets oThis.cacheExpiry
   *
   * @private
   */
  _setCacheExpiry(timeDelta) {
    const oThis = this;

    oThis.cacheExpiry = timeDelta || 24 * 60 * 60; // 1 day
  }

  /**
   * Fetch data from source.
   *
   * @param {array<number>} cacheMissCountryIds
   *
   * @returns {Promise<*>}
   * @private
   */
  async _fetchDataFromSource(cacheMissCountryIds) {
    return new RedemptionCountryModel().getDetailsByCountryId(cacheMissCountryIds);
  }
}

module.exports = RedemptionProductCountryByCountryId;
