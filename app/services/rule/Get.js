'use strict';

/**
 *  Fetch device details by userId and wallet addresses.
 *
 * @module app/services/rule/Get
 */

const rootPrefix = '../../..',
  ServiceBase = require(rootPrefix + '/app/services/Base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType'),
  RuleCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/Rule'),
  TokenRuleDetailsByTokenId = require(rootPrefix + '/lib/cacheManagement/kitSaas/TokenRuleDetailsByTokenId');

/**
 * Class for get rules.
 *
 * @class
 */
class GetRule extends ServiceBase {
  /**
   * Constructor for get devices base.
   *
   * @param {Object} params
   * @param {Integer} params.clientId
   *
   * @augments ServiceBase
   *
   * @constructor
   */
  constructor(params) {
    super(params);
    const oThis = this;
    oThis.clientId = params.client_id;
    oThis.tokenId = null;
  }
  //TODO: Validate if token_id actually exists.

  /**
   * Async performer
   *
   * @returns {Promise<*|result>}
   */
  async _asyncPerform() {
    const oThis = this,
      tokenIdNamesArray = [];

    if (!oThis.tokenId) {
      await oThis._fetchTokenDetails();
    }

    let tokenRulesDetails = await new TokenRuleDetailsByTokenId({ tokenId: oThis.tokenId }).fetch(),
      tokenRulesData = tokenRulesDetails.data;

    for (let eachTokenRule in tokenRulesData) {
      let ruleTokenIdNameString = '',
        tokenRule = tokenRulesData[eachTokenRule];

      ruleTokenIdNameString = tokenRule.rule_token_id + '_' + tokenRule.rule_name;

      tokenIdNamesArray.push(ruleTokenIdNameString);
    }

    let finalResponse = {},
      rulesArray = [],
      ruleDetails = await new RuleCache({ ruleTokenIdNames: tokenIdNamesArray }).fetch(),
      ruleDetailsData = ruleDetails.data;

    for (let eachRule in ruleDetailsData) {
      let ruleEntity = {},
        rule = ruleDetailsData[eachRule],
        tokenRuleEntity = tokenRulesData[rule.name];

      ruleEntity['id'] = tokenRuleEntity.rule_id;
      ruleEntity['tokenId'] = tokenRuleEntity.token_id;
      ruleEntity['name'] = tokenRuleEntity.rule_name;
      ruleEntity['address'] = tokenRuleEntity.address;
      ruleEntity['abi'] = rule.abi;
      ruleEntity['updatedTimestamp'] = tokenRuleEntity.updated_at;

      rulesArray.push(ruleEntity);
    }
    finalResponse[resultType.rules] = rulesArray;

    return responseHelper.successWithData(finalResponse);
  }
}

module.exports = GetRule;
