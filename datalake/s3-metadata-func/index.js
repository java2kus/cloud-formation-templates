#!/usr/bin/env node
//
// Write S3 Metadata to DynamoDB
//
var _ = require('lodash');
var aws = require('aws-sdk');
var s3 = new aws.S3();
var dynamodb = new aws.DynamoDB.DocumentClient();
var async = require('async');
var http = require('http');
var mime = require('mime');

const DYNAMODB_TABLE_NAME = 'MetaDataLake'; // TODO

// Node in a tree graph
var Node = function(name, parent) {
    'use strict';
    this.name = name;
    this.parent = parent;
    this.children = [];
    if (!this.isRoot()) {
        parent.children = _.concat(parent.children, this);
    }
}

Node.prototype.isRoot = function() {
    'use strict';
    return this.parent == null;
};

Node.prototype.getRoot = function() {
    'use strict';
    if (this.isRoot()) {
        console.log('isRoot true returning', this);
        return this;
    } else {
        console.log('isRoot false');
        return this.parent.getRoot();
    }
};

Node.prototype.isLeaf = function() {
    'use strict';
    return this.children.length == 0;
}

Node.prototype.toJson = function() {
    // modified from
    // http://stackoverflow.com/questions/11616630/json-stringify-avoid-typeerror-converting-circular-structure-to-json
    var cache = [];
    var str = JSON.stringify(this, function(key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Circular reference found, discard key
                return;
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    });
    cache = null; // Enable garbage collection
    return JSON.parse(str);
}


exports.handler = function(event, context) {
    console.log('REQUEST RECEIVED:\\n', JSON.stringify(event));

    _(event.Records).each(function(record) {
        if (_.startsWith(record.eventName, 'ObjectCreated:')) {
            processObjectCreatedEvent(event, context, record);
        } else if (_.startsWith(record.eventName, 'ObjectRemoved:')) {
            processObjectRemovedEvent(event, context, record);
        }
    });
}

function processObjectRemovedEvent(event, context, record) {
    var bucket = record.s3.bucket.name;
    var key = record.s3.object.key;

    console.log('bucket', bucket);
    console.log('key', key);

    async.waterfall([
            function deleteItem(callback) {
                var params = {
                    Key: { FilePath : key },
                    TableName: DYNAMODB_TABLE_NAME,
                    ReturnConsumedCapacity: 'INDEXES',
                    ReturnItemCollectionMetrics: 'SIZE',
                    ReturnValues: 'ALL_OLD'
                };
                dynamodb.delete(params, callback);
            }
        ],
        function(err, data) {
            if (err) {
                console.log(err, err.stack);
                context.fail(err);
            } else {
                console.log(data);
                context.succeed(data);
            }
        }
    );
}

function processObjectCreatedEvent(event, context, record) {
    var bucket = record.s3.bucket.name;
    var key = record.s3.object.key;
    var keySplit = key.split('/');
    var size = record.s3.object.size;

    console.log('bucket', bucket);
    console.log('key', key);
    console.log('keySplit', keySplit);
    console.log('size', size);

    if (size == 0) {
        console.log('Skipping object of zero size');
        return;
    }

    // var node = null; // builing fileTree
    // _(keySplit).each(function(k) {
    //     node = new Node(k, node);
    // });

    // var fileTree = node.getRoot();

    var item = {
        "FilePath": key,
        // "FileTree": fileTree.toJson(), // not sure what the point of this was?
        "LastModTime": record.eventTime,
        "Size": size,
        "Bucket": bucket,
        "Principal": record.userIdentity.principalId,
        "SourceIp": record.requestParameters.sourceIPAddress,
        "ETag": record.s3.object.eTag
    }

    item.ContentType = mime.lookup(item.FilePath);
    if(!item.ContentType) {
        item.ContentType = 'Unknown'; // can't be empty on the upinsert
    }

    async.waterfall([
            function headObject(callback) {
                console.log('Getting HEAD ' + key + ' ...');
                s3.headObject({
                        Bucket: bucket,
                        Key: key
                    },
                    callback);
            },

            function upsertItem(data, callback) {
                console.log('data', data);
                item.Metadata = data.Metadata;
                var params = {
                    Item: item,
                    TableName: DYNAMODB_TABLE_NAME,
                    ReturnConsumedCapacity: 'INDEXES',
                    ReturnItemCollectionMetrics: 'SIZE',
                    ReturnValues: 'ALL_OLD'
                };
                dynamodb.put(params, callback);
            }
        ],
        function(err, data) {
            if (err) {
                console.log(err, err.stack);
                context.fail(err);
            } else {
                console.log(data);
                context.succeed(data);
            }
        }
    );
}