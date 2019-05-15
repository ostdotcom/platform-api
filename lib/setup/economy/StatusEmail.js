/**
 * Token setup status email
 *
 * @module lib/setup/economy/StatusEmail
 */
const rootPrefix = '../../..',
  TokenByClientIdCache = require(rootPrefix + '/lib/cacheManagement/kitSaas/Token'),
  SendTransactionalMail = require(rootPrefix + '/lib/email/hookCreator/SendTransactionalMail'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  environmentConstants = require(rootPrefix + '/lib/globalConstant/environmentInfo'),
  pepoCampaignsConstants = require(rootPrefix + '/lib/globalConstant/pepoCampaigns'),
  emailServiceConstants = require(rootPrefix + '/lib/globalConstant/emailServiceApiCallHooks');

class SendTokenSetupStatusEmail {
  /**
   * @constructor
   *
   * @param params
   */
  constructor(params) {
    const oThis = this;

    oThis.clientId = params.clientId;
    oThis.setupStatus = params.setupStatus;
  }

  /**
   * Perform
   *
   * @return {Promise<never>}
   */
  async perform() {
    const oThis = this;

    let tokenCache = new TokenByClientIdCache({
      clientId: oThis.clientId
    });

    let response = await tokenCache.fetch();
    if (!response.data) {
      return Promise.reject(
        responseHelper.error({
          internal_error_identifier: 'l_s_e_sse_1',
          api_error_identifier: 'something_went_wrong',
          debug_options: {
            clientId: oThis.clientId
          }
        })
      );
    }

    let templateName =
      oThis.setupStatus === 1
        ? pepoCampaignsConstants.platformTokenSetupStatusSuccessTemplate
        : pepoCampaignsConstants.platformTokenSetupStatusFailedTemplate;

    await new SendTransactionalMail({
      receiverEntityId: oThis.clientId,
      receiverEntityKind: emailServiceConstants.clientReceiverEntityKind,
      templateName: templateName,
      templateVars: {
        subject_prefix: basicHelper.isSandboxSubEnvironment() ? 'OST Platform Sandbox' : 'OST Platform',
        url_prefix: environmentConstants.urlPrefix,
        token_name: response.data.name
      }
    }).perform();

    return responseHelper.successWithData({
      taskStatus: workflowStepConstants.taskDone
    });
  }
}

module.exports = SendTokenSetupStatusEmail;