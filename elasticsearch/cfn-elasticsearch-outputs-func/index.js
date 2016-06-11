#!/usr/bin/env node

// Describe ElasticSearch Domain for Cloudformation Outputs

var AWS = require('aws-sdk');
var response = require('./cfn-response');

// AWS.config.update({region: 'us-east-1'});

var es = new AWS.ES();


function describeESDomain(event, context) {
  var params = {
    DomainName: event.ResourceProperties.DomainName
  };

  es.describeElasticsearchDomain(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(data);
      responseData = {};
      responseData['DomainARN'] = data.DomainStatus['ARN'];
      responseData['DomainId'] = data.DomainStatus['DomainId'];
      responseData['DomainName'] = data.DomainStatus['DomainName'];
      responseData['Endpoint'] = data.DomainStatus['Endpoint'];
      response.send(event, context, response.SUCCESS, responseData);
    }
  });
}


exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  if(event.RequestType == 'Delete') {
    response.send(event, context, response.SUCCESS);
    return;
  }
  describeESDomain(event, context);
};