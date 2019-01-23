const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router();

require(rootPrefix + '/app/services/contracts/gatewayComposer');

router.get('/gateway-composer', function(req, res, next) {
  req.decodedParams.apiName = 'gatewayComposer';
  req.decodedParams.configStrategyRequired = 1;

  Promise.resolve(routeHelper.perform(req, res, next, 'GatewayComposer', 'r_ic_1'));
});
module.exports = router;
