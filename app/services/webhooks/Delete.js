/**
 * Module to delete webhook.
 *
 * @module app/services/webhooks/Delete
 */

const OSTBase = require('@ostdotcom/base'),
  InstanceComposer = OSTBase.InstanceComposer;

const rootPrefix = '../../..',
  ServiceBase = require(rootPrefix + '/app/services/Base'),
  WebhookEndpointModel = require(rootPrefix + '/app/models/mysql/WebhookEndpoint'),
  WebhookSubscriptionModel = require(rootPrefix + '/app/models/mysql/WebhookSubscription'),
  WebhookEndpointsByUuidCache = require(rootPrefix + '/lib/cacheManagement/kitSaasMulti/WebhookEndpointsByUuid'),
  WebhookSubscriptionsByUuidCache = require(rootPrefix +
    '/lib/cacheManagement/kitSaasMulti/WebhookSubscriptionsByUuid'),
  WebhookEndpointCacheByClientId = require(rootPrefix + '/lib/cacheManagement/kitSaas/WebhookEndpointByClientId'),
  WebhookSubscriptionsByClientIdCache = require(rootPrefix +
    '/lib/cacheManagement/kitSaas/WebhookSubscriptionsByClientId'),
  WebhookSecretByClientIdCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/WebhookSecret'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  resultType = require(rootPrefix + '/lib/globalConstant/resultType'),
  webhookEndpointsConstants = require(rootPrefix + '/lib/globalConstant/webhookEndpoints'),
  webhookSubscriptionConstants = require(rootPrefix + '/lib/globalConstant/webhookSubscriptions');

/**
 * Class to delete webhook.
 *
 * @class DeleteWebhook
 */
class DeleteWebhook extends ServiceBase {
  /**
   * Constructor for delete webhook class.
   *
   * @param {object} params
   * @param {number} params.client_id
   * @param {string} params.webhook_id: uuid v4
   *
   * @augments ServiceBase
   *
   * @constructor
   */
  constructor(params) {
    super(params);

    const oThis = this;

    oThis.clientId = params.client_id;
    oThis.webhookId = params.webhook_id;

    oThis.topics = [];
  }

  /**
   * Async perform.
   *
   * @return {Promise<void>}
   * @private
   */
  async _asyncPerform() {
    const oThis = this;

    await oThis._validateWebhookId();

    await oThis._prepareResponseData();

    await oThis._markWebhookSubscriptionsInactive();

    await oThis._markWebhookEndpointsDeleted();

    await oThis._clearCache();

    return responseHelper.successWithData({
      [resultType.webhook]: {
        id: oThis.webhookId,
        url: oThis.webhookEndpointRsp.endpoint,
        status: webhookEndpointsConstants.invertedStatuses[webhookEndpointsConstants.deleteStatus],
        topics: oThis.topics,
        updatedTimestamp: basicHelper.dateToSecondsTimestamp(oThis.webhookEndpointRsp.updatedAt)
      }
    });
  }

  /**
   * Validates webhookId.
   *
   * @sets oThis.webhookEndpointRsp
   *
   * @returns {Promise<never>}
   * @private
   */
  async _validateWebhookId() {
    const oThis = this;

    const webhookEndpointsCacheResp = await new WebhookEndpointsByUuidCache({
      webhookEndpointUuids: [oThis.webhookId]
    }).fetch();

    oThis.webhookEndpointRsp = webhookEndpointsCacheResp.data[oThis.webhookId];

    // If client id from cache doesn't match,
    // Then we can say that webhook uuid is invalid.
    if (
      !oThis.webhookEndpointRsp ||
      !oThis.webhookEndpointRsp.uuid ||
      oThis.webhookEndpointRsp.clientId !== oThis.clientId
    ) {
      return Promise.reject(
        responseHelper.paramValidationError({
          internal_error_identifier: 'a_s_w_d_1',
          api_error_identifier: 'invalid_api_params',
          params_error_identifiers: ['invalid_webhook_id'],
          debug_options: {}
        })
      );
    }
  }

  /**
   * Prepare response to return.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _prepareResponseData() {
    const oThis = this;

    const webhookSubscriptionCacheRsp = await new WebhookSubscriptionsByUuidCache({
        webhookEndpointUuids: [oThis.webhookId]
      }).fetch(),
      webhookSubscriptionCacheRspData = webhookSubscriptionCacheRsp.data[oThis.webhookId],
      activeWebhooks = webhookSubscriptionCacheRspData.active;

    for (let index = 0; index < activeWebhooks.length; index++) {
      oThis.topics.push(activeWebhooks[index].webhookTopicKind);
    }
  }

  /**
   * Mark webhook subscriptions inactive.
   *
   * @returns {Promise<never>}
   * @private
   */
  async _markWebhookSubscriptionsInactive() {
    const oThis = this;

    await new WebhookSubscriptionModel()
      .update({
        status: webhookSubscriptionConstants.invertedStatuses[webhookSubscriptionConstants.inActiveStatus]
      })
      .where({
        webhook_endpoint_uuid: oThis.webhookId
      })
      .fire();
  }

  /**
   * Mark webhook endpoints deleted.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _markWebhookEndpointsDeleted() {
    const oThis = this;

    await new WebhookEndpointModel()
      .update({
        status: webhookEndpointsConstants.invertedStatuses[webhookEndpointsConstants.deleteStatus]
      })
      .where({
        uuid: oThis.webhookId
      })
      .fire();
  }

  /**
   * Clear cache.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _clearCache() {
    const oThis = this;

    // Clear webhook subscriptions cache.
    await new WebhookSubscriptionsByUuidCache({ webhookEndpointUuids: [oThis.webhookId] }).clear();
    await new WebhookSubscriptionsByClientIdCache({ clientId: oThis.clientId }).clear();

    // Clear webhook endpoints cache.
    await new WebhookEndpointsByUuidCache({ webhookEndpointUuids: [oThis.webhookId] }).clear();
    await new WebhookEndpointCacheByClientId({ clientId: oThis.clientId }).clear();

    await new WebhookSecretByClientIdCache({ clientId: oThis.clientId }).clear();
  }
}

InstanceComposer.registerAsShadowableClass(DeleteWebhook, coreConstants.icNameSpace, 'DeleteWebhook');

module.exports = {};
