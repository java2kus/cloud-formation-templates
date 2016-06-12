cform = flow-logs.cform
name = FlowLogs
# set with something like aws configure set mnemonic zollie
mnemonic = $(shell aws configure get mnemonic)
region = $(shell aws configure get region)
account = $(shell aws configure get name)
account_lower = $(shell echo $(account) | tr  '[A-Z]' '[a-z]')
env = $(shell aws configure get env)
resource_bucket_name = $(mnemonic)-cfn-resources-$(region)-$(account_lower)
template_bucket_name = $(mnemonic)-cfn-templates-$(region)-$(account_lower)
ifeq ($(NAME),)
	NAME=$(name)
endif

ifeq ($(SERVICE_NAME),)
	SERVICE_NAME=$(name)
endif

ifeq ($(ACCOUNT),)
	ACCOUNT=$(account)
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

RESOURCE_IDS=$(shell cat $(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json | jq -r '.[] \
	| select(.ParameterKey=="ResourceIds") | .ParameterValue')

STACK_NAME=$(NAME)-$(RESOURCE_IDS)

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
	@rm -f *.zip \
		&& aws s3 rm s3://$(RESOURCE_BUCKET_NAME)/$(SERVICE_NAME).zip &>/dev/null

package:
	@cd cfn-flow-logs-func && zip -r ../$(SERVICE_NAME).zip . -x *.git*

upload: upload-package upload-template

upload-package:
	@aws s3 cp $(SERVICE_NAME).zip s3://$(RESOURCE_BUCKET_NAME)

upload-template:
	@aws s3 cp $(cform) s3://$(TEMPLATE_BUCKET_NAME)

create: package upload
	@aws cloudformation create-stack --stack-name=$(STACK_NAME) \
		--template-body=file://$(cform) --capabilities=CAPABILITY_IAM \
	  	--parameters=file://$(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json \

update:
	@aws cloudformation update-stack --stack-name=$(STACK_NAME) \
		--template-body=file://$(cform) --capabilities=CAPABILITY_IAM \
	  	--parameters=file://$(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json \

delete:
	@aws cloudformation delete-stack --stack-name=$(STACK_NAME)

validate:
	@aws cloudformation validate-template --template-body=file://$(cform)

describe:
	@aws cloudformation describe-stacks --stack-name=$(STACK_NAME)

events:
	@aws cloudformation describe-stack-events --stack-name=$(STACK_NAME)

resources:
	@aws cloudformation describe-stack-resources --stack-name=$(STACK_NAME)

_check-env:
	@if [ -z $(RESOURCE_IDS) ]; then echo "RESOURCE_IDS is not set" && exit -1; fi;

