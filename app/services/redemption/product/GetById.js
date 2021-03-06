const rootPrefix = '../../../..',
  ServiceBase = require(rootPrefix + '/app/services/Base'),
  CommonValidators = require(rootPrefix + '/lib/validators/Common'),
  PricePointsCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/OstPricePoint'),
  RedemptionCountryByIdCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/RedemptionCountryById'),
  TokenRedemptionProductCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/TokenRedemptionProduct'),
  RedemptionProductCountryByProductIdCache = require(rootPrefix +
    '/lib/cacheManagement/kitSaasMulti/RedemptionProductCountryByProductId'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType'),
  quoteCurrencyConstants = require(rootPrefix + '/lib/globalConstant/quoteCurrency');

/**
 * Class to get redemption product by id.
 *
 * @class GetRedemptionProductById
 */
class GetRedemptionProductById extends ServiceBase {
  /**
   * Constructor to get redemption product by id.
   *
   * @param {object} params
   * @param {number} params.client_id: client Id
   * @param {number} params.redemption_product_id: Token Redemption Product table Id
   *
   * @augments ServiceBase
   *
   * @constructor
   */
  constructor(params) {
    super();

    const oThis = this;

    oThis.clientId = params.client_id;
    oThis.tokenRedemptionProductId = params.redemption_product_id;

    oThis.tokenRedemptionProductDetails = {};
    oThis.availability = [];
  }

  /**
   * Main performer for the class.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _asyncPerform() {
    const oThis = this;

    await oThis._validateTokenStatus();

    await oThis._fetchTokenRedemptionProductDetails();

    await oThis._fetchPricePointsData();

    await oThis._fetchProductAvailability();

    return oThis._prepareResponse();
  }

  /**
   * Fetch token redemption product.
   *
   * @sets oThis.tokenRedemptionProductDetails
   *
   * @returns {Promise<void>}
   * @private
   */
  async _fetchTokenRedemptionProductDetails() {
    const oThis = this;

    const tokenRedemptionProductCacheResponse = await new TokenRedemptionProductCache({
      tokenRedemptionProductIds: [oThis.tokenRedemptionProductId]
    }).fetch();

    if (tokenRedemptionProductCacheResponse.isFailure()) {
      return Promise.reject(tokenRedemptionProductCacheResponse);
    }

    oThis.tokenRedemptionProductDetails = tokenRedemptionProductCacheResponse.data[oThis.tokenRedemptionProductId];

    if (!CommonValidators.validateObject(oThis.tokenRedemptionProductDetails)) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'a_s_rd_p_gbd_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_redemption_product_id'],
          debug_options: {}
        })
      );
    }

    // If token id from signature is not equal to token redemption table.
    if (oThis.tokenRedemptionProductDetails.tokenId != oThis.tokenId) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'a_s_rd_p_gbd_2',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_redemption_product_id'],
          debug_options: {
            tokenId: oThis.tokenId,
            tokenRedemptionProductDetails: oThis.tokenRedemptionProductDetails
          }
        })
      );
    }
  }

  /**
   * This function fetches price points for a particular chainId.
   *
   * @returns {Promise<*>}
   * @private
   */
  async _fetchPricePointsData() {
    const oThis = this,
      fetchCacheRsp = await oThis._fetchClientConfigStrategy(oThis.clientId),
      auxChainId = fetchCacheRsp.data[oThis.clientId].chainId;

    const pricePointsCacheObj = new PricePointsCache({ chainId: auxChainId }),
      pricePointsResponse = await pricePointsCacheObj.fetch();

    if (pricePointsResponse.isFailure()) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'a_s_rd_p_gbd_4',
          api_error_identifier: 'cache_issue',
          debug_options: { chainId: oThis.auxChainId }
        })
      );
    }

    oThis.stakeCurrencyIsHowManyUSD = pricePointsResponse.data[oThis.token.stakeCurrencyId][quoteCurrencyConstants.USD];
  }

  /**
   * Get availability of given product for all countries.
   *
   * @sets oThis.availability
   *
   * @returns {Promise<never>}
   * @private
   */
  async _fetchProductAvailability() {
    const oThis = this,
      countryIds = [],
      redemptionProductId = oThis.tokenRedemptionProductDetails.redemptionProductId;

    // Currently product country map is not token dependent.
    const productCountryCacheResp = await new RedemptionProductCountryByProductIdCache({
      productIds: [redemptionProductId]
    }).fetch();
    if (productCountryCacheResp.isFailure()) {
      return Promise.reject(productCountryCacheResp);
    }

    const countryIdToDetailsMap = productCountryCacheResp.data[redemptionProductId];
    for (const countryId in countryIdToDetailsMap) {
      countryIds.push(countryId);
    }

    const redemptionCountryCacheResp = await new RedemptionCountryByIdCache({ countryIds: countryIds }).fetch();
    const countryIdToCountryMap = redemptionCountryCacheResp.data;

    for (const countryId in countryIdToDetailsMap) {
      const redemptionOptions = countryIdToDetailsMap[countryId].redemptionOptions,
        country = countryIdToCountryMap[countryId],
        usdToLocalCurrencyConversion = country.conversions[quoteCurrencyConstants.USD],
        denominations = [];

      for (let index = 0; index < redemptionOptions.length; index++) {
        const amountInFiat = redemptionOptions[index],
          amountInTokenWei = basicHelper.getNumberOfBTFromFiat(
            amountInFiat,
            usdToLocalCurrencyConversion,
            oThis.stakeCurrencyIsHowManyUSD,
            oThis.token.conversionFactor,
            oThis.token.decimal
          );

        denominations.push({
          amountInFiat: amountInFiat,
          amountInWei: amountInTokenWei.toString(10)
        });
      }

      oThis.availability.push({
        country: country.name,
        countryIsoCode: country.countryIsoCode,
        currencyIsoCode: country.currencyIsoCode,
        denominations: denominations
      });
    }
  }

  /**
   * Prepare final response.
   *
   * @sets oThis.tokenRedemptionProductDetails
   *
   * @returns {*|result}
   * @private
   */
  _prepareResponse() {
    const oThis = this;

    oThis.tokenRedemptionProductDetails.availability = oThis.availability;

    return responseHelper.successWithData({
      [resultType.redemptionProduct]: oThis.tokenRedemptionProductDetails
    });
  }
}

module.exports = GetRedemptionProductById;
