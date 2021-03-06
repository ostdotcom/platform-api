/**
 * Module to get funding config.
 *
 * @module config/funding
 */

const rootPrefix = '..',
  chainAddressConstants = require(rootPrefix + '/lib/globalConstant/chainAddress'),
  tokenAddressConstants = require(rootPrefix + '/lib/globalConstant/tokenAddress');

const fundingAmounts = {};

fundingAmounts[chainAddressConstants.masterInternalFunderKind] = {
  originGas: {
    // origin deployer
    [chainAddressConstants.originDeployerKind]: {
      fundAmount: '0.2941',
      thresholdAmount: '0.1541'
    },

    // origin anchor owner
    [chainAddressConstants.originAnchorOrgContractOwnerKind]: {
      fundAmount: '0.00006',
      thresholdAmount: '0.00006'
    },

    // origin ST organization owner
    [chainAddressConstants.stOrgContractOwnerKind]: {
      fundAmount: '0.00012',
      thresholdAmount: '0.00012'
    },

    // origin anchor admin
    [chainAddressConstants.originAnchorOrgContractAdminKind]: {
      fundAmount: '0.0048',
      thresholdAmount: '0.0024'
    },

    // token origin admin
    [chainAddressConstants.originDefaultBTOrgContractAdminKind]: {
      fundAmount: '0.0024',
      thresholdAmount: '0.0012'
    },

    // token origin worker.
    [chainAddressConstants.originDefaultBTOrgContractWorkerKind]: {
      fundAmount: '0.002',
      thresholdAmount: '0.001'
    },

    // facilitator
    [chainAddressConstants.interChainFacilitatorKind]: {
      fundAmount: '0.1044',
      thresholdAmount: '0.0522'
    },

    // stable coin deployer
    [chainAddressConstants.originStableCoinDeployerKind]: {
      fundAmount: '0.00498',
      thresholdAmount: '0.00498'
    }
  },

  auxGas: {
    // aux deployer
    [chainAddressConstants.auxDeployerKind]: {
      fundAmount: '0.537',
      thresholdAmount: '0.2685'
    },

    // aux anchor admin
    [chainAddressConstants.auxAnchorOrgContractAdminKind]: {
      fundAmount: '0.007',
      thresholdAmount: '0.0035'
    },

    // aux Price Oracle workers
    [chainAddressConstants.auxPriceOracleContractWorkerKind]: {
      fundAmount: '0.00384',
      thresholdAmount: '0.00192'
    },

    // facilitator
    [chainAddressConstants.interChainFacilitatorKind]: {
      fundAmount: '0.3124',
      thresholdAmount: '0.1562'
    }
  }
};

fundingAmounts[tokenAddressConstants.auxFunderAddressKind] = {
  originGas: {},
  auxGas: {
    // token aux admin
    [tokenAddressConstants.auxAdminAddressKind]: {
      fundAmount: '0.002',
      thresholdAmount: '0.001'
    },

    // token aux workers
    [tokenAddressConstants.auxWorkerAddressKind]: {
      fundAmount: '0.1678',
      thresholdAmount: '0.0839'
    },

    // token ExTx workers
    [tokenAddressConstants.txWorkerAddressKind]: {
      fundAmount: '3',
      thresholdAmount: '1.5'
    },

    // token user multisig worker
    [tokenAddressConstants.tokenUserOpsWorkerKind]: {
      fundAmount: '2.4661',
      thresholdAmount: '1.23305'
    },

    // recovery controller
    [tokenAddressConstants.recoveryControllerAddressKind]: {
      fundAmount: '0.0415',
      thresholdAmount: '0.02075'
    }
  }
};

module.exports = fundingAmounts;
