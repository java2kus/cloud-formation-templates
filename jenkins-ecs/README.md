Jenkins Master CI Server on ECS
===

This builds a Docker based on the [official Jenkins repository](https://hub.docker.com/_/jenkins/). This Docker launches in the provided [EC2 Container Cluster](https://aws.amazon.com/ecs/).

**Note**

You need the [Docker ToolBox](https://www.docker.com/products/docker-toolbox) for the Docker commands below.

Usage
=====
To create a local Docker machine:

```
make docker-machine-create
```

To build Docker image:

```
make docker-build
```

To create an [EC2 Container Repository](https://aws.amazon.com/ecr/) repository
for the image

```make create-repo```

To push the image to the ECR repo:

```
make docker-push
```


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

