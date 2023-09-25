import { Stack, App, StackProps, Duration } from '@aws-cdk/core';
import { Vpc, SecurityGroup } from '@aws-cdk/aws-ec2'
import { Cluster, ContainerImage, FargateTaskDefinition, FargateService } from '@aws-cdk/aws-ecs';
import { Bucket } from '@aws-cdk/aws-s3';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { LogGroup, MetricFilter, RetentionDays } from '@aws-cdk/aws-logs';
import { Alarm, ComparisonOperator } from '@aws-cdk/aws-cloudwatch';

export class OrdersStack extends Stack {
    constructor(scope: App, id: string, props?: StackProps) {
        super(scope, id, props);

        // VPC for the ECS cluster
        const vpc = new Vpc(this, 'OrdersVpc');

        // S3 Bucket for the orders
        const ordersBucket = new Bucket(this, 'OrdersBucket');

        // Deploy test data to the S3 Bucket
        new BucketDeployment(this, 'DeployTestData', {
            sources: [Source.asset('./resources')], // path to your resources directory
            destinationBucket: ordersBucket
        });

        // ECS Cluster
        const cluster = new Cluster(this, 'OrdersCluster', { vpc: vpc });

        // Task Definition
        const taskDefinition = new FargateTaskDefinition(this, 'OrdersTaskDefinition');

        const container = taskDefinition.addContainer('OrdersContainer', {
            image: ContainerImage.fromAsset('lib/docker/orders-api'),
            memoryLimitMiB: 512,
            cpu: 256,
            environment: {
                BUCKET_NAME: ordersBucket.bucketName,
                PORT: '8080'
            }
        });

        container.addPortMappings({
          containerPort: 8080,
        })

        // ECS Fargate Service
        const service = new FargateService(this, 'OrdersService', {
            cluster: cluster,
            taskDefinition: taskDefinition,
            securityGroups: [
                new SecurityGroup(this,
                    'OrdersSecurityGroup',
                {
                        vpc: vpc,
                        allowAllOutbound: true,
                        description: 'Allow all outbound traffic',
                     })
            ],
            desiredCount: 1,
        });

        // Logging
        const logGroup = new LogGroup(this, 'OrdersApiLogGroup', {
            logGroupName: `/ecs/event-dynamic-challenge`,
            retention: RetentionDays.ONE_WEEK
        });

        const emptyOrdersMetric = new MetricFilter(this, 'EmptyOrdersMetricFilter', {
            logGroup,
            metricNamespace: 'OrdersApi',
            metricName: 'EmptyOrderResponses',
            filterPattern: { logPatternString: 'Response sent with an empty list of orders' }
        });

        const emptyOrdersMetricPeriod = emptyOrdersMetric.metric().with({ period: Duration.minutes(5) });

        const emptyOrdersAlarm = new Alarm(this, 'EmptyOrdersAlarm', {
            metric: emptyOrdersMetricPeriod,
            threshold: 5,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            alarmDescription: 'Alarm when 5 or more responses with empty order lists are detected in a 5 minute period',
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        });

    }
}