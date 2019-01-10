'use strict';

/**
 * This is model for workflow_setup table.
 *
 * @module app/models/mysql/WorkflowStep
 */
const rootPrefix = '../../..',
  util = require(rootPrefix + '/lib/util'),
  coreConstants = require(rootPrefix + '/config/coreConstants'),
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep'),
  ModelBase = require(rootPrefix + '/app/models/mysql/Base');

const dbName = 'kit_saas_' + coreConstants.subEnvironment + '_' + coreConstants.environment,
  statuses = {
    '1': workflowStepConstants.queuedStatus,
    '2': workflowStepConstants.pendingStatus,
    '3': workflowStepConstants.processedStatus,
    '4': workflowStepConstants.failedStatus,
    '5': workflowStepConstants.timeoutStatus
  },
  invertedStatuses = util.invert(statuses),
  kinds = {
    '1': workflowStepConstants.economySetupInit,
    '2': workflowStepConstants.generateTokenAddresses,
    '3': workflowStepConstants.deployOriginTokenOrganization,
    '4': workflowStepConstants.deployAuxTokenOrganization,

    '30': workflowStepConstants.commitStateRootInit,
    '31': workflowStepConstants.commitStateRoot,
    '32': workflowStepConstants.updateCommittedStateRootInfo,

    '1000': workflowStepConstants.testInit,
    '1001': workflowStepConstants.s1,
    '1002': workflowStepConstants.s2,
    '1003': workflowStepConstants.s33,
    '1004': workflowStepConstants.s4,
    '1005': workflowStepConstants.s5,
    '1006': workflowStepConstants.s6,
    '1007': workflowStepConstants.s7
  },
  invertedKinds = util.invert(kinds);

class WorkflowStep extends ModelBase {
  constructor() {
    super({ dbName: dbName });

    const oThis = this;

    oThis.tableName = 'workflow_steps';
  }

  get statuses() {
    return statuses;
  }

  get invertedStatuses() {
    return invertedStatuses;
  }

  get kinds() {
    return kinds;
  }

  get invertedKinds() {
    return invertedKinds;
  }

  /**
   * This function will mark the step as success
   *
   * @param id
   */
  async updateRecord(id, updateData) {
    const oThis = this;

    return oThis
      .update(updateData)
      .where({ id: id })
      .fire();
  }

  /**
   * This function will mark the step as success
   *
   * @param id
   */
  async markAsSuccess(id) {
    const oThis = this;

    return oThis
      .update({ status: invertedStatuses[workflowStepConstants.processedStatus] })
      .where({ id: id })
      .fire();
  }
  /**
   * This function will mark the step as queued
   *
   * @param id
   */
  markAsQueued(id) {
    const oThis = this;

    return oThis
      .update({ status: invertedStatuses[workflowStepConstants.queuedStatus] })
      .where({ id: id })
      .fire();
  }

  markAsFailed(id) {
    const oThis = this;

    return oThis
      .update({ status: invertedStatuses[workflowStepConstants.failedStatus] })
      .where({ id: id })
      .fire();
  }

  markAsPending(id) {
    const oThis = this;

    return oThis
      .update({ status: invertedStatuses[workflowStepConstants.pendingStatus] })
      .where({ id: id })
      .fire();
  }
}

module.exports = WorkflowStep;
