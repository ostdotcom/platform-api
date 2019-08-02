/**
 * This class creates entry in email async hooks table for client mile stone event type
 *
 * @module lib/email/hookCreator/ClientMileStone
 */

const rootPrefix = '../../..',
  EmailServiceHooksModel = require(rootPrefix + '/app/models/mysql/EmailServiceApiCallHook'),
  emailServiceConstants = require(rootPrefix + '/lib/globalConstant/emailServiceApiCallHooks'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

class ClientMileStone {
  /**
   * Constructor to update contact.
   *
   * @params {object} params
   * @params {number/string} params.receiverEntityId
   * @params {string} params.receiverEntityKind
   * @params {object} params.customAttributes
   * @params {object} params.userSettings
   * @params {string} params.mileStone
   * @params {string} params.tokenId
   *
   * @constructor
   */
  constructor(params) {
    const oThis = this;

    oThis.receiverEntityId = params.receiverEntityId;
    oThis.receiverEntityKind = params.receiverEntityKind;
    oThis.customAttributes = params.customAttributes;
    oThis.userSettings = params.userSettings;
    oThis.mileStone = params.mileStone;
    oThis.tokenId = params.tokenId;
  }

  /**
   * Perform
   *
   * @return {Promise<void>}
   */
  async perform() {
    const oThis = this;

    await oThis._insertHook();

    return responseHelper.successWithData({});
  }

  /**
   * Insert entry in email service hooks table
   *
   * @return {Promise<void>}
   * @private
   */
  async _insertHook() {
    const oThis = this;

    let params = {
      custom_attributes: oThis.customAttributes,
      user_settings: oThis.userSettings,
      mile_stone: oThis.mileStone,
      sub_env: coreConstants.subEnvironment
    };

    if (oThis.tokenId) {
      params['token_id'] = oThis.tokenId;
    }

    const insertParamsForClient = {
      receiverEntityId: oThis.receiverEntityId,
      receiverEntityKind: oThis.receiverEntityKind,
      eventType: emailServiceConstants.clientMileStoneEventType,
      params: params
    };

    await new EmailServiceHooksModel().insertRecord(insertParamsForClient);
  }
}

module.exports = ClientMileStone;