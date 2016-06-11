#!/usr/bin/env node

// Create ElasticSearch Domain

var AWS = require('aws-sdk');
var response = require('./cfn-response');

// AWS.config.update({region: 'us-east-1'});

var es = new AWS.ES();

var accessPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        AWS: '*'
      },
      Action: 'es:*',
      Resource: 'arn:aws:es:'+process.env.AWS_DEFAULT_REGION+':084133473015:domain/',
      Condition: {
        IpAddress: {
          'aws:SourceIp': [
            '96.59.26.51'
          ]
        }
      }
    }
  ]
}

function createESDomain(event, context) {
  var params = {
    DomainName: event.ResourceProperties.DomainName,
    AccessPolicies: JSON.stringify(accessPolicy),
    ElasticsearchClusterConfig: {
      DedicatedMasterEnabled: false,
      InstanceCount: event.ResourceProperties.InstanceCount,
      InstanceType: event.ResourceProperties.InstanceType,
      ZoneAwarenessEnabled: ('true' === event.ResourceProperties.ZoneAwarenessEnabled ? true : false)
    },
    SnapshotOptions: {
      AutomatedSnapshotStartHour: event.ResourceProperties.AutomatedSnapshotStartHour
    }
  };

  es.createElasticsearchDomain(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(data);
      responseData = {};
      responseData['DomainARN'] = data.DomainStatus['ARN'];
      responseData['DomainId'] = data.DomainStatus['DomainId'];
      responseData['DomainName'] = data.DomainStatus['DomainName'];
      response.send(event, context, response.SUCCESS, responseData);
    }
  });
}


function updateESDomain(event, context) {
  var params = {
    DomainName: event.ResourceProperties.DomainName,
    AccessPolicies: JSON.stringify(accessPolicy),
    ElasticsearchClusterConfig: {
      DedicatedMasterEnabled: false,
      InstanceCount: event.ResourceProperties.InstanceCount,
      InstanceType: event.ResourceProperties.InstanceType,
      ZoneAwarenessEnabled: ('true' === event.ResourceProperties.ZoneAwarenessEnabled ? true : false)
    },
    SnapshotOptions: {
      AutomatedSnapshotStartHour: event.ResourceProperties.AutomatedSnapshotStartHour
    }
  };

  es.updateElasticsearchDomain(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(data);
      responseData = {};
      responseData['DomainARN'] = data.DomainStatus['ARN'];
      responseData['DomainId'] = data.DomainStatus['DomainId'];
      responseData['DomainName'] = data.DomainStatus['DomainName'];
      response.send(event, context, response.SUCCESS, responseData);
    }
  });
}


function deleteESDomain(event, context) {
  var params = {
    DomainName: event.ResourceProperties.DomainName
  };

  es.deleteElasticsearchDomain(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(data);
      response.send(event, context, response.SUCCESS);
    }
  });
}


exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  accessPolicy.Statement[0].Resource += (event.ResourceProperties.DomainName+'/*');
  switch(event.RequestType) {
    case 'Delete':
      deleteESDomain(event, context);
      break;
    case 'Create':
      createESDomain(event, context);
      break;
    case 'Update':
      updateESDomain(event, context);
      break;
  }
};

// exports.handler({
//   RequestType:'Create',
//   ResourceProperties: {
//     DomainName: 'test-domain'
//   }
// })
