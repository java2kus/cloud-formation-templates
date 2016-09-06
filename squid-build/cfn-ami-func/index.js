#!/usr/bin/env node

// Create AMI

var AWS = require('aws-sdk');
var response = require('./cfn-response');
var async = require('async');

// AWS.config.update({region: 'us-east-1'});

var ec2 = new AWS.EC2();

function createAMI(event, context) {
  async.waterfall([
      function(callback) {
        console.log('Creating AMI ...')
        var params = {
          InstanceId: event.ResourceProperties.InstanceId,
          Name: getName(event.ResourceProperties.ServiceName, 
            event.ResourceProperties.StackId, event.ResourceProperties.InstanceId),
          Description: event.ResourceProperties.Description,
          NoReboot: true
        };
        ec2.createImage(params, callback);
      },
      function(data, callback) {
        console.log('Tagging AMI ...')
        var params = {
          Resources: [ 
            data.ImageId
          ],
          Tags: [ 
            {
              Key: 'Name',
              Value: event.ResourceProperties.AMIName
            },          
            {
              Key: 'Version',
              Value: event.ResourceProperties.AMIVersion
            },                      
            {
              Key: 'StackArn',
              Value: event.ResourceProperties.StackId
            }
          ]
        };
        ec2.createTags(params, function(err, notused) {
          if(err) {
             console.log(err); 
            callback(err, null);
          } else {
            callback(null, data);
          }
        });
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, data);
      }
    }    
  );
}


function deleteAMI(event, context) {
  async.waterfall([
      function(callback) {
        console.log('Describing AMIs ...')
        var params = {
          Filters: [
            {
              Name: 'name',
              Values: [
                getName(event.ResourceProperties.ServiceName, 
                  event.ResourceProperties.StackId, event.ResourceProperties.InstanceId)
              ]
            }
          ]
        };
        ec2.describeImages(params, callback);
      },
      function(data, callback) {
        console.log(data);
        console.log('Deregistering AMI ...')
        var params = {
          ImageId: data.Images[0].ImageId
        };
        ec2.deregisterImage(params, callback);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, data);
      }
    }    
  );
}

function getName(serviceName, stackId, instanceId) {
  return serviceName+'-'+stackId.substr(stackId.length - 36)+'-'+instanceId;
}


exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  switch(event.RequestType) {
    case 'Delete':
      deleteAMI(event, context);
      break;
    case 'Create':
      createAMI(event, context);
      break;
    case 'Update':
      response.send(event, context, response.SUCCESS);
      break;      
  }
};
