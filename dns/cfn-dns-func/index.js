#!/usr/bin/env node

// Create Route53 Zone with Delegation Set Id

var AWS = require('aws-sdk');
var response = require('./cfn-response');

// AWS.config.update({region: 'us-east-1'});

var route53 = new AWS.Route53();


function createHostedZone(event, context) {
  tag = event.ResourceProperties.Tag;
  stackId = event.ResourceProperties.StackId;
  callerRef = getCallerRef(tag, stackId);
  var params = {
    CallerReference: callerRef,
    Name: event.ResourceProperties.Name,
    DelegationSetId: event.ResourceProperties.DelegationSetId,
    HostedZoneConfig: {
      Comment: event.ResourceProperties.Comment,
      PrivateZone: event.ResourceProperties.PrivateZone
    }
  }

  if(event.ResourceProperties.VPCId) {
    params.VPC = {
      VPCId: event.ResourceProperties.VPCId,
      VPCRegion: event.ResourceProperties.VPCRegion
    }
  }

  describeHostedZone(event, context, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(data);
      data.HostedZones.forEach(function(hz) {
        if(hz.CallerReference.slice(0, 4) == 'root'
          || hz.CallerReference === callerRef) {
          console.log('HostedZone is Root or already exists, exiting.')
          response.send(event, context, response.SUCCESS, hz);
          return;
        }
      });
      route53.createHostedZone(params, function(err, data) {
        if (err) {
          console.log(err, err.stack);
          response.send(event, context, response.FAILED);
        } else {
          console.log(data);
          setTimeout(waitForInsync, 10000, event, context, data);
        }
      });
    }
  });
}

function waitForInsync(event, context, data) {
  params = {Id:data.ChangeInfo.Id}
  route53.getChange(params, function(err, changeData) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(changeData);
      if(changeData.ChangeInfo.Status != 'INSYNC') {
        setTimeout(waitForInsync, 2000, event, context, data);
      } else {
        response.send(event, context, response.SUCCESS, data.HostedZone);
      }
    }
  });
}

function deleteHostedZone(event, context) {
  tag = event.ResourceProperties.Tag;
  stackId = event.ResourceProperties.StackId;
  callerRef = getCallerRef(tag, stackId);
  describeHostedZone(event, context, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      response.send(event, context, response.FAILED);
    } else {
      console.log(data);
      data.HostedZones.forEach(function(hz) {
        if(hz.CallerReference === callerRef) {
          route53.deleteHostedZone({Id:hz.Id}, function(err, data) {
            if (err) {
              console.log(err, err.stack);
              response.send(event, context, response.FAILED);
            } else {
              console.log(data);
              response.send(event, context, response.SUCCESS);
            }
          });
        }
      });
      response.send(event, context, response.SUCCESS);
    }
  });
}

function updateHostedZone(event, context) {
  tag = event.ResourceProperties.Tag;
  stackId = event.ResourceProperties.StackId;
  callerRef = getCallerRef(tag, stackId);
  describeHostedZone(event, context, function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED);
      } else {
        console.log(data);
        data.HostedZones.forEach(function(hz) {
          if(hz.CallerReference === callerRef) {
            route53.deleteHostedZone({Id:hz.Id}, function(err, data) {
              if (err) {
                console.log(err, err.stack);
                response.send(event, context, response.FAILED);
              } else {
                console.log(data);
                createHostedZone(event, context);
              }
            });
          }
        });
        response.send(event, context, response.SUCCESS);
      }
  });
}

function describeHostedZone(event, context, callback) {
  var params = {
    DNSName: event.ResourceProperties.Name
  };

  route53.listHostedZonesByName(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      callback(err, null);
    } else {
      console.log(data);
      callback(null, data);
    }
  });
}

function getCallerRef(tag, stackId) {
  callerRef = tag + stackId.substr(stackId.length - 36); // guid part of StackId
  return callerRef;
}

exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  switch(event.RequestType) {
    case 'Delete':
      deleteHostedZone(event, context);
      break;
    case 'Create':
      createHostedZone(event, context);
      break;
    case 'Update':
      updateHostedZone(event, context);
      break;
  }
};