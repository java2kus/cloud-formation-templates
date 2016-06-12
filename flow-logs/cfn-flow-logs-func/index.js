#!/usr/bin/env node

// Turn On/Off VPC FLow Logs

var AWS = require('aws-sdk');
var async = require('async');
var response = require('./cfn-response');

// AWS.config.update({region: 'us-east-1'});

var ec2 = new AWS.EC2();

function createFlowLogs(event, context) {
  async.series([
      function(callback) {
        console.log('Creating Flow Logs ...')
        stackId = event.ResourceProperties.StackId;
        clientToken = stackId.substr(stackId.length - 36);
        var params = {
          DeliverLogsPermissionArn: event.ResourceProperties.DeliverLogsPermissionArn,
          LogGroupName: event.ResourceProperties.LogGroupName,
          ResourceIds: [
            event.ResourceProperties.ResourceIds
          ],
          ResourceType: event.ResourceProperties.ResourceType,
          TrafficType: event.ResourceProperties.TrafficType,
          ClientToken: clientToken
        };

        ec2.createFlowLogs(params, callback);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err);
      } else {
        console.log(data);
        flowLogs = {FlowLogs: data}
        response.send(event, context, response.SUCCESS, flowLogs);
      }
    }
  );
}

function updateFlowLogs(event, context) {
  response.send(event, context, response.SUCCESS);
}

function deleteFlowLogs(event, context) {
  async.waterfall([
      function(callback) {
        console.log('Describing Flow Logs ...')
        var params = {
          Filter: [
            {
              Name: 'log-group-name',
              Values: [
                event.ResourceProperties.LogGroupName,
              ]
            }
          ]
        };
        ec2.describeFlowLogs(params, callback);
      },
      function(data, callback) {
        console.log('Deleting Flow Logs ...');
        console.log(data);
        if(!data.FlowLogs[0]) {
          callback(null, {Data:'FlowLogs Not Found. Skipping DELETE'});
          return;
        }
        var params = {
          FlowLogIds: [
            data.FlowLogs[0].FlowLogId
          ]
        };
        ec2.deleteFlowLogs(params, callback);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err);
        response.send(event, context, response.FAILED, err);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, data);
      }
    }
  );
}

exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  switch (event.RequestType) {
    case 'Delete':
      deleteFlowLogs(event, context);
      break;
    case 'Create':
      createFlowLogs(event, context);
      break;
    case 'Update':
      updateFlowLogs();
      break;
  }
};