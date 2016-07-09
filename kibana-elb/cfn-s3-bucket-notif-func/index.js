#!/usr/bin/env node

// Create S3 Bucket Notifications on Existing Bucket

var _ = require('lodash');
var aws = require('aws-sdk');
var async = require('async');
var response = require('./cfn-response');

// aws.config.update({region: 'us-east-1'});

var s3 = new aws.S3();


function createNotif(event, context) {
  async.waterfall([
      function(callback) {
        console.log('Getting S3 Notifications ...')
        var params = {
          Bucket: event.ResourceProperties.Bucket
        };
        s3.getBucketNotificationConfiguration(params, callback);
      },
      function(data, callback) {
        console.log('Putting S3 Notifications ...');
        console.log('data:', data);
        var lambdaNotifs = data.LambdaFunctionConfigurations;
        if(event.ResourceProperties.NotificationConfiguration.LambdaConfigurations) {
          lambdaNotifs = _.concat(lambdaNotifs,
            event.ResourceProperties.NotificationConfiguration.LambdaConfigurations);
        }
        var queueNotifs = data.QueueConfigurations;
        if(event.ResourceProperties.NotificationConfiguration.QueueConfigurations) {
          queueNotifs = _.concat(queueNotifs,
            event.ResourceProperties.NotificationConfiguration.QueueConfigurations);
        }
        var topicNotifs = data.TopicConfigurations;
        if(event.ResourceProperties.NotificationConfiguration.TopicConfigurations) {
          topicNotifs = _.concat(topicNotifs,
            event.ResourceProperties.NotificationConfiguration.TopicConfigurations);
        }
        console.log('lambdaNotifs:', lambdaNotifs);
        console.log('queueNotifs:', queueNotifs);
        console.log('topicNotifs:', topicNotifs);
        var params = {
          Bucket: event.ResourceProperties.Bucket,
          NotificationConfiguration: {
            LambdaFunctionConfigurations: lambdaNotifs,
            QueueConfigurations: queueNotifs,
            TopicConfigurations: topicNotifs
          }
        };
        s3.putBucketNotificationConfiguration(params, callback);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err, event.PhysicalResourceId);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, {}, event.PhysicalResourceId);
      }
    }
  );
}


function deleteNotif(event, context) {
  async.waterfall([
      function(callback) {
        console.log('Getting S3 Notifications ...')
        var params = {
          Bucket: event.ResourceProperties.Bucket
        };
        s3.getBucketNotificationConfiguration(params, callback);
      },
      function(data, callback) {
        console.log('Deleting S3 Notification ...');
        console.log('data:', data);
        var lambdaNotifs = data.LambdaFunctionConfigurations;
        if(event.ResourceProperties.NotificationConfiguration.LambdaConfigurations) {
          lambdaNotifs = _.difference(lambdaNotifs,
            event.ResourceProperties.NotificationConfiguration.LambdaConfigurations);
        }
        var queueNotifs = data.QueueConfigurations;
        if(event.ResourceProperties.NotificationConfiguration.QueueConfigurations) {
          queueNotifs = _.difference(queueNotifs,
            event.ResourceProperties.NotificationConfiguration.QueueConfigurations);
        }
        var topicNotifs = data.TopicConfigurations;
        if(event.ResourceProperties.NotificationConfiguration.TopicConfigurations) {
          topicNotifs = _.difference(topicNotifs,
            event.ResourceProperties.NotificationConfiguration.TopicConfigurations);
        }
        console.log('lambdaNotifs:', lambdaNotifs);
        console.log('queueNotifs:', queueNotifs);
        console.log('topicNotifs:', topicNotifs);
        var params = {
          Bucket: event.ResourceProperties.Bucket,
          NotificationConfiguration: {
            LambdaFunctionConfigurations: lambdaNotifs,
            QueueConfigurations: queueNotifs,
            TopicConfigurations: topicNotifs
          }
        };
        s3.putBucketNotificationConfiguration(params, callback);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err, event.PhysicalResourceId);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, {Data:data}, event.PhysicalResourceId);
      }
    }
  );
}

exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  switch (event.RequestType) {
    case 'Delete':
      deleteNotif(event, context);
      break;
    case 'Create':
      createNotif(event, context);
      break;
    case 'Update':
      createNotif(event, context);
      break;
  }
};