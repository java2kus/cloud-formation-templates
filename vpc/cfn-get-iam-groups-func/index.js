#!/usr/bin/env node

// List IAM Groups by Name

var AWS = require('aws-sdk');
var async = require('async');
var response = require('./cfn-response');

// AWS.config.update({region: 'us-east-1'});

var iam = new AWS.IAM();

const adminGroupName = 'Adminsistrators';

function listNonAdminGroups(event, context) {
  path = "/";
  if (event.ResourceProperties.Path) {
    path = event.ResourceProperties.Path;
  }

  async.waterfall([
      function(callback) {
        console.log('Listing groups ...')
        iam.listGroups({}, callback);
      },
      function(data, callback) {
        console.log('Filtering groups ...');
        async.filter(data.Groups, function(g, callback) {
          callback(g.GroupName != adminGroupName);
        }, function(results) {
          async.map(results, function(g, callback2) {
            callback2(null, g.GroupName);
          }, callback);
        });
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err);
      } else {
        console.log(data);
        groups = {
          Groups: data
        }
        response.send(event, context, response.SUCCESS, groups);
      }
    }
  );
}


exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  switch (event.RequestType) {
    case 'Delete':
      response.send(event, context, response.SUCCESS);
      break;
    case 'Create':
      listNonAdminGroups(event, context);
      break;
    case 'Update':
      listAdminGroups(event, context);
      break;
  }
};