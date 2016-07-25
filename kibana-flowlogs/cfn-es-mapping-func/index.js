#!/usr/bin/env node

// Create Elasticsearch Template Mapping

var response = require('./cfn-response');
var https = require('https');
var aws4 = require('aws4');
var dns = require('dns');
var async = require('async');

// AWS.config.update({region: 'us-east-1'});

var templateName = 'flow';
var mapping =
{
  "template": "flow-*",
  "order": 1,
  "mappings": {
    "_default_": {
      "_all": {
        "enabled": true
      },
      "properties": {
        "action": {
          "type": "string",
          "analyzer": "keyword"
        },
        "bytes": {
          "type": "long"
        },
        "packets": {
          "type": "long"
        },
        "srcaddr": {
          "type": "ip"
        },
        "dstaddr": {
          "type": "ip"
        },
        "srcgeo": {
          "type": "object",
          "null_value" : {},
          "properties": {
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
        },
        "dstgeo": {
          "type": "object",
          "null_value" : {},
          "properties": {
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



function cfnCreate(event, context) {
  async.waterfall([
      function putTemplateMapping(callback) {
        console.log('PUTting Log Template Mappings to Endpoint:',
          event.ResourceProperties.DomainEndpoint);
        var json = JSON.stringify(mapping);
        console.log('JSON', json);
        var opts = {
          host: event.ResourceProperties.DomainEndpoint,
          path: '/_template/'+templateName,
          method: 'PUT',
          body: json,
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
        console.error(err);
        response.send(event, context, response.FAILURE, err);
      } else {
        response.send(event, context, response.SUCCESS);
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
      cfnCreate(event, context);
      break;
    case 'Update':
      cfnCreate(event, context);
      break;
  }
};