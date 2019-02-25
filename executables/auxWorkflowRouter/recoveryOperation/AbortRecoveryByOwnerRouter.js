/**
 * Abort recovery by owner router.
 *
 * @module executables/auxWorkflowRouter/recoveryOperation/AbortRecoveryByOwnerRouter
 */

const OSTBase = require('@openstfoundation/openst-base'),
  InstanceComposer = OSTBase.InstanceComposer;

const rootPrefix = '../../..',
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  chainConfigProvider = require(rootPrefix + '/lib/providers/chainConfig'),
  workflowConstants = require(rootPrefix + '/lib/globalConstant/workflow'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  AuxWorkflowRouterBase = require(rootPrefix + '/executables/auxWorkflowRouter/Base'),
  abortRecoveryByOwnerConfig = require(rootPrefix +
    '/executables/auxWorkflowRouter/recoveryOperation/abortRecoveryByOwnerConfig');

/**
 * Class for abort recovery by owner router.
 *
 * @class AbortRecoveryByOwnerRouter
 */
class AbortRecoveryByOwnerRouter extends AuxWorkflowRouterBase {
  /**
   * Constructor for abort recovery by owner router.
   *
   * @constructor
   */
  constructor(params) {
    params['workflowKind'] = workflowConstants.abortRecoveryByOwnerKind; // Assign workflowKind.

    super(params);
  }

  /**
   * Fetch current step config for every router.
   *
   * @private
   */
  _fetchCurrentStepConfig() {
    const oThis = this;

    oThis.currentStepConfig = abortRecoveryByOwnerConfig[oThis.stepKind];
  }

  /**
   * Perform step.
   *
   * @return {Promise<*>}
   *
   * @private
   */
  async _performStep() {
    const oThis = this;

    const configStrategy = await oThis.getConfigStrategy(),
      ic = new InstanceComposer(configStrategy);

    switch (oThis.stepKind) {
      case workflowStepConstants.abortRecoveryByOwnerInit:
        logger.step('**********', workflowStepConstants.abortRecoveryByOwnerInit);

        return oThis.insertInitStep();

      // Perform transaction to abort recovery by owner.
      case workflowStepConstants.abortRecoveryByOwnerPerformTransaction:
        logger.step('**********', workflowStepConstants.abortRecoveryByOwnerPerformTransaction);

        require(rootPrefix + '/lib/deviceRecovery/byOwner/abortRecovery/PerformTransaction');

        oThis.requestParams.pendingTransactionExtraData = oThis._currentStepPayloadForPendingTrx();
        oThis.requestParams.workflowId = oThis.workflowId;

        const PerformAbortRecoveryTransaction = ic.getShadowedClassFor(
            coreConstants.icNameSpace,
            'PerformAbortRecoveryTransaction'
          ),
          performAbortRecoveryTransactionObj = new PerformAbortRecoveryTransaction(oThis.requestParams);

        return performAbortRecoveryTransactionObj.perform();

      // Verify abort recovery by owner transaction.
      case workflowStepConstants.abortRecoveryByOwnerVerifyTransaction:
        logger.step('**********', workflowStepConstants.abortRecoveryByOwnerVerifyTransaction);

        require(rootPrefix + '/lib/deviceRecovery/byOwner/abortRecovery/VerifyTransaction');

        const VerifyAbortRecoveryTransaction = ic.getShadowedClassFor(
            coreConstants.icNameSpace,
            'VerifyAbortRecoveryTransaction'
          ),
          verifyAbortRecoveryTransactionObj = new VerifyAbortRecoveryTransaction(oThis.requestParams);

        return verifyAbortRecoveryTransactionObj.perform();

      case workflowStepConstants.markSuccess:
        logger.step('*** Mark Initiate Recovery As Success.');

        return await oThis.handleSuccess();

      case workflowStepConstants.markFailure:
        logger.step('*** Mark Initiate Recovery As Failed');

        return await oThis.handleFailure();

      default:
        return Promise.reject(
          responseHelper.error({
            internal_error_identifier: 'e_awr_ro_arbor_1',
            api_error_identifier: 'something_went_wrong',
            debug_options: { workflowId: oThis.workflowId }
          })
        );
    }
  }

  /**
   * Get next step configs.
   *
   * @param nextStep
   *
   * @return {*}
   */
  getNextStepConfigs(nextStep) {
    return abortRecoveryByOwnerConfig[nextStep];
  }

  /**
   * Get config strategy.
   *
   * @return {Promise<*>}
   */
  async getConfigStrategy() {
    const oThis = this;

    const rsp = await chainConfigProvider.getFor([oThis.chainId]);

    return rsp[oThis.chainId];
  }
}

module.exports = AbortRecoveryByOwnerRouter;
