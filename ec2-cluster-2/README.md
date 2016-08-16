Creates an EC2 AutoScale Cluster with Load Balancer based on a given AMI Id
===

A SnapshotId for the root device and also for a data volume is optional. These EBS volumes can also be optionally deleted on instance termination. Works with Linux and Windows. 

This template requires parameters about the VPC, Subnets, and AZs for the cluster. 


Usage
=====
For default Stack

```
make package && create
```

or

```
make create NAME=<stack-name>
```

For a complete list of options use

```
make list
```

