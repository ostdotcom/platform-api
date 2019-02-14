'use strict';

const rootPrefix = '../../..',
  workflowStepConstants = require(rootPrefix + '/lib/globalConstant/workflowStep');

const steps = {
  [workflowStepConstants.authorizeDeviceInit]: {
    kind: workflowStepConstants.authorizeDeviceInit,
    onFailure: workflowStepConstants.markFailure,
    onSuccess: [workflowStepConstants.authorizeDevicePerformTransaction]
  },
  [workflowStepConstants.authorizeDevicePerformTransaction]: {
    kind: workflowStepConstants.authorizeDevicePerformTransaction,
    onFailure: workflowStepConstants.markFailure,
    onSuccess: [workflowStepConstants.authorizeDeviceVerifyTransaction]
  },
  [workflowStepConstants.authorizeDeviceVerifyTransaction]: {
    kind: workflowStepConstants.authorizeDeviceVerifyTransaction,
    readDataFrom: [workflowStepConstants.authorizeDevicePerformTransaction],
    onFailure: workflowStepConstants.markFailure,
    onSuccess: [workflowStepConstants.markSuccess]
  },
  [workflowStepConstants.markSuccess]: {
    kind: workflowStepConstants.markSuccess,
    onFailure: workflowStepConstants.markFailure,
    onSuccess: []
  },
  [workflowStepConstants.markFailure]: {
    kind: workflowStepConstants.markFailure,
    onSuccess: []
  }
};

module.exports = steps;
