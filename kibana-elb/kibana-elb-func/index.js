// !!
// Modified from https://github.com/cboscolo/elb2loggly/
// -KZ

var aws = require('aws-sdk');
var s3 = new aws.S3({
    apiVersion: '2006-03-01'
});

var _ = require('lodash'),
    async = require('async'),
    https = require('https'),
    dns = require('dns'),
    aws4 = require('aws4'),
    Transform = require('stream').Transform,
    es = require('event-stream'),
    geoip = require('geoip-lite'),
    csv = require('csv-streamify'),
    JSONStream = require('JSONStream'),
    attr = require('dynamodb-data-types').AttributeValue,
    uaparser = require('ua-parser-js');


// AWS logs contain the following fields: (Note: a couple are parsed from within the field.)
// http://docs.aws.amazon.com/ElasticLoadBalancing/latest/DeveloperGuide/access-log-collection.html
var COLUMNS = [
    'timestamp', //0
    'elb', //1
    'client_ip', //2
    'client_port', //3 - split from client
    'backend', //4
    'backend_port', //5
    'request_processing_time', //6
    'backend_processing_time', //7
    'response_processing_time', //8
    'elb_status_code', //9
    'backend_status_code', //10
    'received_bytes', //11
    'sent_bytes', //12
    'request_method', //13 - Split from request
    'request_url', //14 - Split from request
    'request_query_params', //15 - Split from request
    'user_agent', //16
    'ssl_cipher', //17
    'ssl_protocol' //18
];

// The following column indexes will be turned into numbers so that
// we can filter within Elasticsearch
var NUMERIC_COL_INDEX = [
    6,
    7,
    8,
    11,
    12
];

//Private query parameters that should be removed/obscured from the URL
var PRIVATE_URL_PARAMS = [];
var PRIVATE_URL_PARAMS_MAX_LENGTH = [];

// default record batch of 100 is
// too large to process. We chunk it.
var recordChunkSz = 15;
// event parsed counter
var eventsParsed = 0;
// the root mnemonic of the index (ES_INDEX_ROOT-YYYY.MM.DD)
var ES_INDEX_ROOT = 'elb';
// the index type
var ES_INDEX_TYPE = ''; // Set to S3 Prefix
// well known hostname for ES domain
var ES_HOSTNAME = 'es-domain-a.es.test.' + process.env.AWS_DEFAULT_REGION + '.zollie.rocks';
// the AWS service endpoint set below
var ES_ENDPOINT = '';

JSON.flatten = function(data) {
    var result = {};
    function recurse (cur, prop) {
        if (Object(cur) !== cur) {
            result[prop] = cur;
        } else if (Array.isArray(cur)) {
             for(var i=0, l=cur.length; i<l; i++)
                 recurse(cur[i], prop ? prop+"."+i : ""+i);
            if (l == 0)
                result[prop] = [];
        } else {
            var isEmpty = true;
            for (var p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop+"."+p : p);
            }
            if (isEmpty)
                result[prop] = {};
        }
    }
    recurse(data, "");
    return result;
}

exports.handler = function(event, context) {
    // console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));
    dns.resolveCname(ES_HOSTNAME, function(err, addresses) {
        if (err) {
            console.log(err);
            return;
        }
        console.log('Looking up CNAME for host', ES_HOSTNAME);
        ES_ENDPOINT = addresses[0];
        console.log('Found CNAME', ES_ENDPOINT);
        processRecords(event, context);
    });
}

//Obscures the provided parameter in the URL
//Returns the URL with the provided parameter obscured
var obscureURLParameter = function(url, parameter, obscureLength) {
    //prefer to use l.search if you have a location/link object
    var urlparts = url.split('?');
    if (urlparts.length >= 2) {

        var prefix = encodeURIComponent(parameter) + '=';
        var pars = urlparts[1].split(/[&;]/g);

        //reverse iteration as may be destructive
        for (var i = pars.length; i-- > 0;) {
            //If the parameter starts with the encoded prefix
            if (pars[i].lastIndexOf(prefix, 0) !== -1) {
                if (obscureLength > 0 && pars[i].length > obscureLength) {
                    //If the total length of of the parameter is greater than
                    //obscureLength we only take the left most characters
                    pars[i] = pars[i].substring(0, prefix.length + obscureLength) + "..."
                } else {
                    //Otherwise we just remove the parameter
                    pars.splice(i, 1);
                }
            }
        }

        url = urlparts[0] + '?' + pars.join('&');
        return url;
    } else {
        return url;
    }
}

// Parse elb log into component parts.
var parse_s3_log = function(data, encoding, done) {

    var original_data = data;
  //If this is a HTTP load balander we get 12 fields
  //for HTTPs load balancers we get 15
  if ( data.length == 12 || data.length == 15 ) {

      //Keep an easily boolean depending on the ELB type
      // var isHTTP = data.length == 12;
      //If this is a HTTP ELB we need to get rid of the HTTPs fields in our COLUMNS array
      // if (isHTTP) {
      //   COLUMNS.splice(16,3);
      // }

      //Split clientip:port and backendip:port at index 2,3
      //We need to be carefull here because of potential 5xx errors which may not include
      //backend:port
      if (data[3].indexOf(':') > -1) {
        //If the field contains a colon we perform the normal split to get ip and port
        data.splice(3,1,data[3].split(':'));
      } else {
        //We may get here if there was a 5xx error
        //We will add 'dash' place holders for the missing data
        //This is common for Apache logs when a field is blank, it is also more consistent with
        //the original ELB data
        data.splice(3,1,'-','-');
      }

      //client:port
      data.splice(2,1,data[2].split(':'));


      //Ensure the data is flat
      data = _.flatten(data);

      // Pull the method from the request.  (WTF on Amazon's decision to keep these as one string.)
      // This position depends on the type of ELB
      var initialRequestPosition = /*isHTTP ? data.length - 1 :*/ data.length - 4;
      var url_mash = data[initialRequestPosition];
      data.splice(initialRequestPosition, 1);
      //Ensure the data is flat
      data = _.flatten(data);

      //Split the url, the 2 parameter gives us only the last 2
      //e.g. Split POST https://secure.echoboxapp.com:443/api/authtest HTTP/1.1
      //into [0] - POST, [1] - https://secure.echoboxapp.com:443/api/authtest
      url_mash = url_mash.split(' ',2)
      var request_method = url_mash[0];
      var request_url = url_mash[1];

      //Remove any private URL query parameters
      _.each(PRIVATE_URL_PARAMS, function(param_to_remove, param_index) {
        request_url = obscureURLParameter(request_url,param_to_remove, PRIVATE_URL_PARAMS_MAX_LENGTH[param_index]);
      });

      //Strip the query parameters into a separate field if any exist
      var request_params = "";
      if (request_url.indexOf('?') !== -1) {
        request_params = request_url.substring(request_url.indexOf('?')+1,request_url.length);
        request_url = request_url.substring(0,request_url.indexOf('?'));
      }

      //Add the url request back into data array at the original position
      data.splice(initialRequestPosition,0,request_params);
      data.splice(initialRequestPosition,0,request_url);
      data.splice(initialRequestPosition,0,request_method);
      //Ensure the data is flat
      data = _.flatten(data);

      //Parse the numeric columns to floats
      _.each(NUMERIC_COL_INDEX, function(col_index) {
        data[col_index] = parseFloat(data[col_index]);
      });

      if ( data.length == COLUMNS.length ) {
        doc = _.zipObject(COLUMNS, data);
        doc['@id'] = generateUUID();
        doc['@timestamp'] = new Date(doc.timestamp).toISOString();
        // doc['@message'] = doc;

        var action = {
            "index": {}
        };
        action.index._index = getIndexName(doc);
        action.index._type = ES_INDEX_TYPE.toLowerCase();
        action.index._id = doc['@id'];

        doc.ua = JSON.flatten(uaparser(doc.user_agent));

        var clientgeo = geoip.lookup(doc.client_ip);
        console.log('clientgeo:', clientgeo);

        // client_ip geoip
        doc.clientgeo = clientgeo ||  {
            range: [0,0],
            country: 'US',
            region: process.env.AWS_DEFAULT_REGION,
            city: 'AWS',
            ll: [0,0],
            metro: 0
        };
        doc.clientgeo.point = {};
        doc.clientgeo.point.lat = parseFloat(doc.clientgeo.ll[0]);
        doc.clientgeo.point.lon = parseFloat(doc.clientgeo.ll[1]);

        bulkRequestBody = '';
        bulkRequestBody += [
            JSON.stringify(action),
            JSON.stringify(doc)
        ].join('\n') + '\n';

        this.push(bulkRequestBody);

        eventsParsed++;
      } else {
        var errorLog = {
            'timestamp' : original_data[0],
            'elb' : original_data[1],
            'elb_status_code' : original_data[7],
            'error' : 'ELB log length: ' + original_data.length + ' did not match COLUMNS length ' + COLUMNS.length
        };
        this.push(errorLog);
        //Log an error including the line that was excluded
            console.error('ELB log length ' + data.length + ' did not match COLUMNS length ' + COLUMNS.length + ". " + data.join(" "))
      }

      done();

  } else {
      //Record a useful error in the lambda logs that something was wrong with the input data
      done("Expecting 12 or 15 fields, actual fields " + data.length);
  }
};

function generateUUID() {
    // from http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

var transform = function(data, encoding, done) {
    console.log('TRANSFORMING RECORDS WITH COUNT:', data.length);

    theTransformer = this; // gets out of scope below

    async.eachSeries(data, function(record, callback) {
            switch (record.eventName) {
                case 'INSERT':
                    // turn into Plain Old JSON and index
                    doc = attr.unwrap(record.dynamodb.NewImage);

                    // console.log('FilePath is:', doc.FilePath);
                    // make sure it's an ELB log
                    if (!(_(doc.FilePath).startsWith('ELB'))) {
                        // console.log('FilePath does not start with ELB, skipping ...');
                        callback();
                        return;
                    }

                    console.log('FilePath is:', doc.FilePath);

                    // Get the object from the event and show its content type
                    var bucket = doc.Bucket;
                    var key = doc.FilePath;
                    var keySplit = key.split('/');
                    ES_INDEX_TYPE = keySplit[1];
                    var size = doc.Size;

                    if (_(key).endsWith('ELBAccessLogTestFile')) {
                        console.log('Skipping ELBAccessLogTestFile');
                        callback();
                        return;
                    }

                    if (size == 0) {
                        console.log('Skipping object of size zero');
                        callback();
                        return;
                    }

                    // Download the logfile from S3, and upload to Elasticsearch.
                    async.waterfall([
                            function download(next) {
                                console.log('Downloading ' + key + ' ...');
                                // Download from S3 into a buffer.
                                s3.getObject({
                                        Bucket: bucket,
                                        Key: key
                                    },
                                    next);
                            },

                            function getJson(data, next) {
                                console.log('Getting JSON ...');
                                // need the json for the aws4 signature
                                var csvToJson = csv({
                                    objectMode: true,
                                    delimiter: ' '
                                });

                                var parser = new Transform({
                                    objectMode: true
                                })

                                parser._transform = parse_s3_log;

                                var bufferStream = new Transform();

                                bufferStream.push(data.Body)
                                bufferStream.end();
                                // transform
                                bufferStream
                                    .pipe(csvToJson)
                                    .pipe(parser)
                                    // .pipe(jsonToStrings)
                                    .pipe(es.wait(next));
                            },
                            function upload(data, next) {
                                // Stream the logfile to Elasticsearch.
                                console.log('Using Elasticsearch endpoint:', ES_ENDPOINT);
                                console.log('Using bulk data:', data);

                                if (data.length < 1) {
                                    console.log('Parsed bulkRequestBody is empty, skipping ...');
                                    callback();
                                    return;
                                }

                                var opts = {
                                    host: ES_ENDPOINT,
                                    path: '/_bulk',
                                    method: 'POST',
                                    body: data,
                                    headers: {
                                        'Content-Type': 'application/x-amz-json-1.1'
                                    }
                                };

                                aws4.sign(opts);

                                var httpCallback = function(response) {
                                    var str = '';

                                    // another chunk of data has been recieved, so append it to `str`
                                    response.on('data', function(chunk) {
                                        // console.log(chunk);
                                        str += chunk;
                                    });

                                    // the whole response has been recieved, so we just print it out here
                                    response.on('end', function() {
                                        // console.log(str);
                                        next(null, str);
                                    });

                                    // error recieved
                                    response.on('error', function(err) {
                                        console.log(err);
                                        next(err, null);
                                    });
                                }

                                https.request(opts, httpCallback).end(data);
                            }
                        ],
                        function(err, data) {
                            if (err) {
                                console.error(
                                    'Unable to read ' + bucket + '/' + key +
                                    ' due to an error: ' + err
                                );
                                callback(err);
                            } else {
                                console.log(
                                    'Successfully parsed ' + bucket + '/' + key +
                                    '. Parsed ' + eventsParsed + ' events.'
                                );
                                // theTransformer.push(data);
                                callback();
                            }
                        }
                    );
                    break;

                case 'REMOVE':
                    console.log('Ignoring REMOVE Event');
                    callback();
                    return;

                default:
                    console.log('Unrecognized eventName:', record.eventName)
                    callback();
                    return;
            }
        },
        function(err) {
            if (err) {
                console.log('Transformation error', err);
                done(); // passed err will be uncaught
            } else {
                console.log('Transformed all records');
                done();
            }
        });
}


function getIndexName(doc) {
    // console.log('Getting indexName', doc);
    var timestamp = new Date(doc.timestamp);
    // index name format: ES_INDEX_ROOT-YYYY.MM.DD
    var indexName = [
        ES_INDEX_ROOT + '-' + timestamp.getUTCFullYear(),   // year
        ('0' + (timestamp.getUTCMonth() + 1)).slice(-2),    // month
        ('0' + timestamp.getUTCDate()).slice(-2)            // day
    ].join('.');

    return indexName;
}

function getTableName(streamArn) {
    console.log('streamArn', streamArn)
    return streamArn.split('/')[1];
}

function processRecords(event, context) {
    // console.log("RECEIVED RECORD COUNT OF:", event.Records.length);
    var recordChunks = [];
    while (event.Records.length > 0) {
        recordChunks.push(event.Records.splice(0, recordChunkSz));
    }
    // console.log("CHUNKED RECORDS INTO COUNT OF:", recordChunks.length);

    async.forEachOfSeries(recordChunks, function(records, key, callback) {
        // console.log("Getting Kinesis Records for CHUNK:", key);
        transform(records, 'utf-8', callback);
    }, function(err) {
        if (err) {
            console.log('Chunk error', err);
        } else {
            console.log('Chunked all records');
        }
        context.done();
    });
}