cform = jenkins.cform
# set with something like aws configure set mnemonic zollie
mnemonic = $(shell aws configure get mnemonic)
region = $(shell aws configure get region)
account = $(shell aws configure get name)
account_lower = $(shell echo $(account) | tr  '[A-Z]' '[a-z]')
env = $(shell aws configure get env)
resource_bucket_name = $(mnemonic)-cfn-resources-$(region)-$(account_lower)
template_bucket_name = $(mnemonic)-cfn-templates-$(region)-$(account_lower)
account_id = $(shell aws configure get account_id)
# ECR is only in the us-east-1 at the moment
registry=$(account_id).dkr.ecr.us-east-1.amazonaws.com
ifeq ($(ACCOUNT),)
	ACCOUNT=$(account_lower)
endif

ifeq ($(ENV),)
	ENV=$(env)
endif

ifeq ($(RESOURCE_BUCKET_NAME),)
	RESOURCE_BUCKET_NAME=$(resource_bucket_name)
endif

ifeq ($(TEMPLATE_BUCKET_NAME),)
	TEMPLATE_BUCKET_NAME=$(template_bucket_name)
endif


name=$(shell cat $(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json | jq -r '.[] \
	| select(.ParameterKey=="ServiceName") | .ParameterValue')

ifeq ($(NAME),)
	NAME=$(name)
endif

version=$(shell cat $(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json | jq -r '.[] \
	| select(.ParameterKey=="ImageVersion") | .ParameterValue')

ifeq ($(VERSION),)
	VERSION=$(version)
endif

name_lower = $(shell echo $(NAME) | tr  '[A-Z]' '[a-z]')
repo=$(mnemonic)/$(name_lower)

ifeq ($(REPO_NAME),)
	REPO_NAME=$(repo)
endif

ifeq ($(SERVICE_NAME),)
	SERVICE_NAME=$(NAME)
endif


ECS_STACK=$(shell cat $(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json | jq -r '.[] \
	| select(.ParameterKey=="ECSStackName") | .ParameterValue')

STACK_NAME=$(SERVICE_NAME)-$(ECS_STACK)

# lists all available targets
list:
	@echo "List of available targets:"
	@sh -c "$(MAKE) -p no_targets__ | awk -F':' '/^[a-zA-Z0-9][^\$$#\/\\t=]*:([^=]|$$)/ {split(\$$1,A,/ /);for(i in A)print A[i]}' | grep -v '__\$$' | grep -v 'make\[1\]' | grep -v 'Makefile' | sort"
# required for list
no_targets__:

estimate-cost:
	@aws cloudformation estimate-template-cost \
		--template-body=file://$(cform) --output text --query 'Url'

clean:
	@rm -rf Build && rm -rf -- *.zip \
		&& aws s3 rm s3://$(RESOURCE_BUCKET_NAME)/$(SERVICE_NAME)-kibana-elb.zip \
		&& aws s3 rm s3://$(RESOURCE_BUCKET_NAME)/$(SERVICE_NAME)-es.zip \

package:
	@cd kibana-elb-func && zip -r ../$(SERVICE_NAME)-kibana-elb.zip . -x *.git* \
		&& cd ../cfn-es-elb-mapping-func && zip -r ../$(SERVICE_NAME)-es.zip . -x *.git* \

upload: upload-package upload-template

upload-package:
	@aws s3 cp $(SERVICE_NAME)-kibana-elb.zip s3://$(RESOURCE_BUCKET_NAME) \
		&& aws s3 cp $(SERVICE_NAME)-es.zip s3://$(RESOURCE_BUCKET_NAME) \

upload-template:
	@aws s3 cp $(cform) s3://$(TEMPLATE_BUCKET_NAME)

docker-machine-create:
	@docker-machine create --driver virtualbox $(name_lower)

docker-machine-env:
	@eval "$(docker-machine env $(name_lower))"

docker-build:
	@docker build -t $(registry)/$(REPO_NAME):$(VERSION) .

docker-login:
	@$(shell aws ecr get-login --region $(region))

docker-create-repo: docker-login
	@aws ecr create-repository --repository-name $(REPO_NAME)

docker-push: docker-login
	@docker push $(registry)/$(REPO_NAME):$(VERSION)

docker-run:
	@docker run -it -p 8080:8080 $(registry)/$(REPO_NAME):$(VERSION) /bin/bash

create:
	@aws cloudformation create-stack --stack-name=$(STACK_NAME) \
		--template-body=file://$(cform) --capabilities=CAPABILITY_IAM \
		--parameters=file://$(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json \
		--disable-rollback

create-repo:
	@aws ecr create-repository --repository-name=$(REPO_NAME)

update:
	@aws cloudformation update-stack --stack-name=$(STACK_NAME) \
		--template-body=file://$(cform) --capabilities=CAPABILITY_IAM \
		--parameters=file://$(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json \

validate:
	@aws cloudformation validate-template --template-body=file://$(cform)

delete:
	@aws cloudformation delete-stack --stack-name=$(STACK_NAME)

delete-repo:
	@aws ecr delete-repository --repository-name=$(REPO_NAME)

describe:
	@aws cloudformation describe-stacks --stack-name=$(STACK_NAME)

events:
	@aws cloudformation describe-stack-events --stack-name=$(STACK_NAME)

resources:
	@aws cloudformation describe-stack-resources --stack-name=$(STACK_NAME)
