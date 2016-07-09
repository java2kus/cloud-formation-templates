#!/usr/bin/env node

// Create Lamabda Logs Subscription

var AWS = require('aws-sdk');
var async = require('async');
var response = require('./cfn-response');
var http = require('http');
var aws4 = require('aws4');

// AWS.config.update({region: 'us-east-1'});

var cloudwatchlogs = new AWS.CloudWatchLogs();

var templateName = 'cloudtrail';
var mapping =
{
  "template": "cloudtrail-*",
  "order": 1,
  "settings": {
    "analysis": {
      "analyzer": {
        "awsUsername": {
          "tokenizer": "uax_url_email",
          "filter": "lowercase"
        }
      }
    }
  },
  "mappings": {
    "_default_": {
      "_all": {
        "enabled": true
      },
      "properties": {
        "userIdentity.userName": {
          "type": "string",
          "analyzer": "awsUsername"
        },
        "awsRegion": {
          "type": "string",
          "analyzer": "keyword"
        },
        "sourceIPAddress": {
          "type": "ip" //TODO!!!
        },
        "geo": {
          "type": "object",
          "properties":{
            "city": {
              "type": "string",
              "analyzer": "keyword"
            },
            "country": {
              "type": "string",
              "analyzer": "keyword"
            },
            "region": {
              "type": "string",
              "analyzer": "keyword"
            },
            "ll": {
              "type": "geo_point",
               "lat_lon": true
            },
            "point": {
              "type": "geo_point",
               "lat_lon": true
            }
          }
        }
      }
    }
  }
}

function createSub(event, context) {
  async.series([
      function(callback) {
        console.log('Creating Lambda Subscription ...')
        var params = {
          destinationArn: event.ResourceProperties.DestinationArn,
          filterName: event.ResourceProperties.FilterName,
          filterPattern: event.ResourceProperties.FilterPattern,
          logGroupName: event.ResourceProperties.LogGroupName
        };

        cloudwatchlogs.putSubscriptionFilter(params, callback);
      },
      function(callback) {
        console.log('PUTing Log Template Mappings ...')
        json = JSON.stringify(mapping);
        var opts = {
          host: event.ResourceProperties.DomainEndpoint,
          path: '/_template/'+templateName,
          method: 'PUT',
          body: JSON.stringify(mapping),
          headers: {
            'Content-Type': 'application/x-amz-json-1.1'
          }
        };
        aws4.sign(opts);
        https.request(opts).end(json, callback);
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


function deleteSub(event, context) {
  async.series([
      function(callback) {
        console.log('Deleting Lambda Subscription ...')
        var params = {
          filterName: event.ResourceProperties.FilterName,
          logGroupName: event.ResourceProperties.LogGroupName
        };

        cloudwatchlogs.deleteSubscriptionFilter(params, callback);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err, event.PhysicalResourceId);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, data[0].Group, event.PhysicalResourceId);
      }
    }
  );
}

function updateSub(event, context) {
  async.series([
      function(callback) {
        console.log('Deleting Lambda Subscription ...')
        var params = {
          filterName: event.ResourceProperties.FilterName,
          logGroupName: event.ResourceProperties.LogGroupName
        };

        cloudwatchlogs.deleteSubscriptionFilter(params, callback);
      },
      function(callback) {
        createSub(event, content);
      }
    ],
    function(err, data) {
      if (err) {
        console.log(err, err.stack);
        response.send(event, context, response.FAILED, err, event.PhysicalResourceId);
      } else {
        console.log(data);
        response.send(event, context, response.SUCCESS, data[0].Group, event.PhysicalResourceId);
      }
    }
  );
}


exports.handler = function(event, context) {
  console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
  switch (event.RequestType) {
    case 'Delete':
      deleteSub(event, context);
      break;
    case 'Create':
      createSub(event, context);
      break;
    case 'Update':
      updateSub(event, context);
      break;
  }
};